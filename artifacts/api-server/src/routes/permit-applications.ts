import { Router } from "express";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, permitApplicationsTable, permitRejectedAttemptsTable } from "@workspace/db";
import { CreatePermitApplicationBody, CreatePermitApplicationResponse, ListPermitApplicationsQueryParams, ListPermitApplicationsResponse, UpdatePermitApplicationBody, UpdatePermitApplicationParams, UpdatePermitApplicationResponse, ReviewPermitChecksBody, CorrectPermitClassificationBody, checkJurisdiction, OUTSIDE_COUNTY_MESSAGE, screenApplication, EVIDENCE_LABEL, SAFETY_CRITICAL_DOCS } from "@workspace/api-zod";
import { requirePortalUser, requireStaff, isStaff, canViewApplication } from "../middlewares/portal-auth";
import { readRuleConfig, screenedResponse, toValues } from "../lib/permit-screening";
import { validateUploadedDocument } from "./storage";
import { buildPermitTimeline } from "../lib/permit-timeline";

const router = Router();
router.use("/permit-applications", requirePortalUser);
router.get("/permit-applications", async (req, res): Promise<void> => {
  const parsed = ListPermitApplicationsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = res.locals.portalUser;
  // Applicant-supplied email filters can never broaden ownership.
  const rows = await db.select().from(permitApplicationsTable).where(isStaff(user) ? (parsed.data.applicantEmail ? eq(permitApplicationsTable.email, parsed.data.applicantEmail) : undefined) : eq(permitApplicationsTable.ownerUserId, user.id)).orderBy(desc(permitApplicationsTable.submittedAt));
  const applications = await Promise.all(rows.filter(row => checkJurisdiction(row.projectAddress).status !== "Outside County").map(screenedResponse));
  res.json(ListPermitApplicationsResponse.parse(applications));
});
router.post("/permit-applications", async (req, res): Promise<void> => {
  const parsed = CreatePermitApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = res.locals.portalUser;
  if (checkJurisdiction(parsed.data.projectAddress).status === "Outside County") {
    await db.insert(permitRejectedAttemptsTable).values({ id: randomUUID(), userId: user.id, projectAddress: parsed.data.projectAddress, reason: OUTSIDE_COUNTY_MESSAGE });
    req.log.warn({ userId: user.id, rejectionId: req.id }, "Jurisdiction attempt rejected; not added to permit queue");
    res.status(422).json({ error: OUTSIDE_COUNTY_MESSAGE }); return;
  }
  const claimedAffordable = parsed.data.claimed_affordable ?? parsed.data.affordableHousing;
  const evidence = parsed.data.documents.find(d => d.label === EVIDENCE_LABEL && d.received && d.objectPath);
  if (claimedAffordable && !evidence) { res.status(422).json({ error: "Upload supporting evidence for the applicant-claimed affordable housing project." }); return; }
  try {
    for (const document of parsed.data.documents.filter(d => d.received)) {
      if (!document.objectPath) throw new Error("Received documents must have a completed upload.");
      const upload = await validateUploadedDocument(document.objectPath, user.id);
      document.fileName = upload.name;
    }
  } catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : "A document upload could not be verified." }); return; }
  const now = new Date();
  const screened = CreatePermitApplicationResponse.parse(screenApplication({
    ...parsed.data, id: `SCC-${now.getFullYear()}-${randomUUID()}`, ownerUserId: user.id,
    email: isStaff(user) ? parsed.data.email : user.email,
    applicantName: isStaff(user) ? parsed.data.applicantName : user.name,
    submittedAt: now, reviewStatus: "New", notes: [], reviewDecisions: {},
    priorityClaims: { affordable: { status: "Unverified" }, underserved: { status: "Unverified" } },
    claimed_affordable: claimedAffordable, claimed_underserved: parsed.data.claimed_underserved ?? parsed.data.underservedCommunity,
  }, await readRuleConfig()));
  screened.timeline = buildPermitTimeline(screened.reviewStatus, now, screened.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.insert(permitApplicationsTable).values(toValues(screened)).returning();
  res.status(201).json(await screenedResponse(saved!));
});
router.patch("/permit-applications/:id", requirePortalUser, requireStaff, async (req, res): Promise<void> => {
  const params = UpdatePermitApplicationParams.safeParse(req.params);
  const body = UpdatePermitApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid application update." }); return; }
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Saved permit application not found" }); return; }
  const existing = await screenedResponse(row);
  const additions = body.data.notes.filter(n => !row.notes.some(old => old.id === n.id)).map(n => ({ ...n, author: res.locals.portalUser.id, createdAt: new Date() }));
  const next = screenApplication({ ...existing, reviewStatus: body.data.reviewStatus, assignedDepartment: body.data.assignedDepartment, notes: [...additions, ...existing.notes] }, await readRuleConfig());
  if (existing.requiredReviewers?.length && !["More Information Requested", existing.reviewStatus].includes(body.data.reviewStatus)) { res.status(409).json({ error: "Resolve required jurisdiction, classification, and safety reviews before progressing this application." }); return; }
  next.timeline = buildPermitTimeline(next.reviewStatus, row.submittedAt, next.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.update(permitApplicationsTable).set(toValues(UpdatePermitApplicationResponse.parse(next))).where(eq(permitApplicationsTable.id, params.data.id)).returning();
  res.json(await screenedResponse(saved!));
});
router.post("/permit-applications/:id/review-checks", requirePortalUser, requireStaff, async (req, res): Promise<void> => {
  const body = ReviewPermitChecksBody.safeParse(req.body);
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!body.success || !body.data.note.trim() || !id) { res.status(400).json({ error: "A review action and a non-empty staff note are required." }); return; }
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, id));
  if (!row) { res.status(404).json({ error: "Application not found." }); return; }
  const application = await screenedResponse(row);
  const audit = { note: body.data.note.trim(), by: res.locals.portalUser.id, at: new Date().toISOString() };
  if (body.data.action === "claim") {
    const { claim, decision } = body.data;
    if (!claim || !decision || !(claim === "affordable" ? application.claimed_affordable : application.claimed_underserved)) { res.status(400).json({ error: "Select an active claim and Verified or Rejected." }); return; }
    if (claim === "affordable" && decision === "Verified" && !application.documents.some(d => d.label === EVIDENCE_LABEL && d.received && d.objectPath)) { res.status(422).json({ error: "Affordable housing evidence must be uploaded before verification." }); return; }
    application.priorityClaims![claim] = { status: decision, ...audit };
  } else if (body.data.action === "safety") {
    if (!body.data.document || !SAFETY_CRITICAL_DOCS.some(r => r.label === body.data.document)) { res.status(400).json({ error: "Select a configured safety-critical document." }); return; }
    application.reviewDecisions = { ...application.reviewDecisions, safety: [...(application.reviewDecisions?.safety ?? []), { ...audit, document: body.data.document }] };
  } else {
    if (application.ruleChecks?.jurisdictionStatus !== "Needs Verification") { res.status(400).json({ error: "Only ambiguous County jurisdiction can be confirmed. Outside-County addresses cannot be overridden." }); return; }
    application.reviewDecisions = { ...application.reviewDecisions, jurisdiction: audit };
  }
  const decisionLabel = body.data.action === "claim" ? `${body.data.claim}: ${body.data.decision}` : body.data.action === "safety" ? body.data.document : "County jurisdiction confirmed";
  application.notes.unshift({ id: randomUUID(), author: audit.by, body: `${body.data.action} review — ${decisionLabel}: ${audit.note}`, createdAt: new Date(audit.at) });
  const screened = CreatePermitApplicationResponse.parse(screenApplication(application, await readRuleConfig()));
  screened.timeline = buildPermitTimeline(screened.reviewStatus, row.submittedAt, screened.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.update(permitApplicationsTable).set(toValues(screened)).where(eq(permitApplicationsTable.id, id)).returning();
  res.json(await screenedResponse(saved!));
});
router.patch("/permit-applications/:id/classification", requirePortalUser, async (req, res): Promise<void> => {
  const parsed = CorrectPermitClassificationBody.safeParse(req.body);
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!parsed.success) { res.status(400).json({ error: "Valid project type, units, and description are required." }); return; }
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, id));
  if (!row || !canViewApplication(res.locals.portalUser, row.ownerUserId)) { res.status(404).json({ error: "Application not found." }); return; }
  const original = await screenedResponse(row);
  if (!isStaff(res.locals.portalUser) && (!original.ruleChecks?.classificationConflicts.length || ["Approved", "Denied"].includes(row.reviewStatus))) {
    res.status(403).json({ error: "Applicants may correct only pending classification conflicts, not finalized or otherwise reviewed records." }); return;
  }
  const next = CreatePermitApplicationResponse.parse(screenApplication({ ...original, ...parsed.data, reviewDecisions: { ...original.reviewDecisions, safety: [] }, notes: [{ id: randomUUID(), author: res.locals.portalUser.id, body: `Classification corrected from ${row.projectType}, ${row.housingUnits} units to ${parsed.data.projectType}, ${parsed.data.housingUnits} units.`, createdAt: new Date() }, ...original.notes] }, await readRuleConfig()));
  next.timeline = buildPermitTimeline(next.reviewStatus, row.submittedAt, next.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.update(permitApplicationsTable).set(toValues(next)).where(eq(permitApplicationsTable.id, id)).returning();
  res.json(await screenedResponse(saved!));
});
export default router;