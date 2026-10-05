import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, permitApplicationsTable, permitRejectedAttemptsTable } from "@workspace/db";
import { CreatePermitApplicationBody, CreatePermitApplicationResponse, ListPermitApplicationsQueryParams, ListPermitApplicationsResponse, UpdatePermitApplicationBody, UpdatePermitApplicationParams, UpdatePermitApplicationResponse, ReviewPermitChecksBody, CorrectPermitClassificationBody, checkJurisdiction, OUTSIDE_COUNTY_MESSAGE, screenApplication, EVIDENCE_LABEL, SAFETY_CRITICAL_DOCS, classificationConflicts } from "@workspace/api-zod";
import { requirePortalUser, requireStaff, isStaff, canViewApplication } from "../middlewares/portal-auth";
import { readRuleConfig, screenedResponse, responseForViewer, toValues } from "../lib/permit-screening";
import { validateUploadedDocument } from "./storage";
import { buildPermitTimeline } from "../lib/permit-timeline";

const router = Router();
router.use("/permit-applications", requirePortalUser);
router.get("/permit-applications", async (req, res): Promise<void> => {
  const parsed = ListPermitApplicationsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = res.locals.portalUser;
  // Applicant-supplied email filters can never broaden ownership.
  const rows = await db.select().from(permitApplicationsTable).where(isStaff(user) ? and(eq(permitApplicationsTable.workspaceId, user.workspaceId), parsed.data.applicantEmail ? eq(permitApplicationsTable.email, parsed.data.applicantEmail) : undefined) : eq(permitApplicationsTable.ownerUserId, user.id)).orderBy(desc(permitApplicationsTable.submittedAt));
  const applications = await Promise.all(rows.filter(row => checkJurisdiction(row.projectAddress).status !== "Outside County").map(screenedResponse));
  res.json(ListPermitApplicationsResponse.parse(applications.map(app => responseForViewer(app, user))));
});
router.post("/permit-applications", async (req, res): Promise<void> => {
  const parsed = CreatePermitApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = res.locals.portalUser;
  const jurisdiction = checkJurisdiction(parsed.data.projectAddress);
  if (jurisdiction.status === "Outside County") {
    await db.insert(permitRejectedAttemptsTable).values({ id: randomUUID(), userId: user.id, projectAddress: parsed.data.projectAddress, reason: OUTSIDE_COUNTY_MESSAGE });
    req.log.warn({ userId: user.id, rejectionId: req.id }, "Jurisdiction attempt rejected; not added to permit queue");
    res.status(422).json({ error: OUTSIDE_COUNTY_MESSAGE }); return;
  }
  const claimedAffordable = parsed.data.claimed_affordable ?? parsed.data.affordableHousing;
  try {
    for (const document of parsed.data.documents.filter(d => d.received)) {
      if (!document.objectPath) throw new Error("Received documents must have a completed upload.");
      const upload = await validateUploadedDocument(document.objectPath, user.id);
      document.fileName = upload.name;
    }
  } catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : "A document upload could not be verified." }); return; }
  if (claimedAffordable && !parsed.data.documents.some(d => d.label === EVIDENCE_LABEL)) parsed.data.documents.push({ category: "Priority evidence", label: EVIDENCE_LABEL, required: true, received: false });
  if (jurisdiction.status === "Needs Verification") await db.insert(permitRejectedAttemptsTable).values({ id: randomUUID(), userId: user.id, projectAddress: parsed.data.projectAddress, reason: "Human jurisdiction review — incomplete, ambiguous, or shared-boundary address; not accepted for normal intake." });
  const now = new Date();
  const screened = CreatePermitApplicationResponse.parse(screenApplication({
    ...parsed.data, id: `SCC-${now.getFullYear()}-${randomUUID()}`, ownerUserId: user.id, workspaceId: user.workspaceId,
    email: isStaff(user) ? parsed.data.email : user.email,
    applicantName: isStaff(user) ? parsed.data.applicantName : user.name,
    submittedAt: now, reviewStatus: "New", assignedDepartment: "Building", notes: [], reviewDecisions: {},
    auditHistory: [{ id: randomUUID(), action: "validation", decision: jurisdiction.status, reason: "Deterministic jurisdiction, priority, classification and safety validation performed before queue admission.", workerId: "system", workerName: "Backend validation", at: now.toISOString(), detail: `Address validation: ${parsed.data.projectAddress}; ${jurisdiction.status}` }],
    priorityClaims: { affordable: { status: "Unverified" }, underserved: { status: "Unverified" } },
    claimed_affordable: claimedAffordable, claimed_underserved: parsed.data.claimed_underserved ?? parsed.data.underservedCommunity,
  }, await readRuleConfig()));
  screened.timeline = buildPermitTimeline(screened.reviewStatus, now, screened.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.insert(permitApplicationsTable).values(toValues(screened)).returning();
  res.status(201).json(responseForViewer(await screenedResponse(saved!), user));
});
router.patch("/permit-applications/:id", requirePortalUser, requireStaff, async (req, res): Promise<void> => {
  const params = UpdatePermitApplicationParams.safeParse(req.params);
  const body = UpdatePermitApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid application update." }); return; }
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, params.data.id));
  if (!row || !canViewApplication(res.locals.portalUser, row.ownerUserId, row.workspaceId)) { res.status(404).json({ error: "Saved permit application not found" }); return; }
  const existing = await screenedResponse(row);
  const additions = body.data.notes.filter(n => !row.notes.some(old => old.id === n.id)).map(n => ({ ...n, author: res.locals.portalUser.id, createdAt: new Date() }));
  const next = screenApplication({ ...existing, reviewStatus: body.data.reviewStatus, assignedDepartment: body.data.assignedDepartment, notes: [...additions, ...existing.notes] }, await readRuleConfig());
  if (existing.requiredReviewers?.length && !["More Information Requested", existing.reviewStatus].includes(body.data.reviewStatus)) { res.status(409).json({ error: "Resolve required jurisdiction, classification, and safety reviews before progressing this application." }); return; }
  next.timeline = buildPermitTimeline(next.reviewStatus, row.submittedAt, next.recommendedRouting.includes("Fire Marshal"));
  next.auditHistory = [...(row.auditHistory ?? []), { id: randomUUID(), action: "progression", decision: next.reviewStatus, reason: additions.map(n => n.body).join("; ") || "Authorized workspace staff updated review state.", workerId: res.locals.portalUser.id, workerName: res.locals.portalUser.name, at: new Date().toISOString(), detail: `Status ${existing.reviewStatus} → ${next.reviewStatus}; department ${next.assignedDepartment}` }];
  const [saved] = await db.update(permitApplicationsTable).set({ ...toValues(UpdatePermitApplicationResponse.parse(next)), revision: sql`${permitApplicationsTable.revision} + 1` }).where(and(eq(permitApplicationsTable.id, params.data.id), eq(permitApplicationsTable.revision, row.revision))).returning();
  if (!saved) { res.status(409).json({ error: "Application changed during review. Reload before saving." }); return; }
  res.json(await screenedResponse(saved!));
});
router.post("/permit-applications/:id/review-checks", requirePortalUser, requireStaff, async (req, res): Promise<void> => {
  const body = ReviewPermitChecksBody.safeParse(req.body);
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!body.success || !body.data.note.trim() || !id) { res.status(400).json({ error: "A review action and a non-empty staff note are required." }); return; }
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, id));
  if (!row || !canViewApplication(res.locals.portalUser, row.ownerUserId, row.workspaceId)) { res.status(404).json({ error: "Application not found." }); return; }
  const application = await screenedResponse(row);
  const audit = { note: body.data.note.trim(), by: res.locals.portalUser.id, at: new Date().toISOString() };
  if (body.data.action === "claim" || body.data.action === "request_documentation") {
    const { claim, decision } = body.data;
    const additional = application.priorityClaims?.additional?.find(c => c.category === claim);
    const active = claim === "affordable" ? application.claimed_affordable : claim === "underserved" ? application.claimed_underserved : Boolean(additional);
    if (!claim || !active || (body.data.action === "claim" && !decision)) { res.status(400).json({ error: "Select an active priority claim and a valid decision." }); return; }
    if (body.data.action === "claim" && claim === "affordable" && decision === "Verified" && !application.documents.some(d => d.label === EVIDENCE_LABEL && d.received && d.objectPath)) { res.status(422).json({ error: "Affordable housing evidence must be uploaded before verification." }); return; }
    const status = body.data.action === "request_documentation" ? "Unverified" as const : decision!;
    if (claim === "affordable" || claim === "underserved") application.priorityClaims![claim] = { status, ...audit };
    else if (additional) Object.assign(additional, { status, ...audit });
  } else if (body.data.action === "safety") {
    if (res.locals.portalUser.role !== "fire_marshal") { res.status(403).json({ error: "Only staff with Fire Marshal permissions may clear or override a safety-critical flag." }); return; }
    if (!body.data.document || !SAFETY_CRITICAL_DOCS.some(r => r.label === body.data.document)) { res.status(400).json({ error: "Select a configured safety-critical document." }); return; }
    if (!application.ruleChecks?.safetyCriticalFlags.length) { res.status(409).json({ error: "There is no active safety-critical flag to clear." }); return; }
    application.reviewDecisions = { ...application.reviewDecisions, safety: [...(application.reviewDecisions?.safety ?? []), { ...audit, document: body.data.document }] };
  } else if (body.data.action === "conflict") {
    if (!application.ruleChecks?.classificationConflicts.length) { res.status(409).json({ error: "There is no active information conflict." }); return; }
    const { projectType, housingUnits, description, permitType } = body.data;
    if (!projectType?.trim() || housingUnits === undefined || !description?.trim()) { res.status(400).json({ error: "Record corrected project type, unit count, description, and a resolution reason." }); return; }
    const corrected = { ...application, projectType: projectType.trim(), housingUnits, description: description.trim(), permitType: permitType?.trim() || application.permitType };
    if (classificationConflicts(corrected).length) { res.status(422).json({ error: "The proposed correction still contains conflicting application information." }); return; }
    Object.assign(application, corrected, { reviewDecisions: { ...application.reviewDecisions, classification: audit, safety: [] } });
  } else {
    if (application.ruleChecks?.jurisdictionStatus !== "Needs Verification") { res.status(400).json({ error: "Only ambiguous County jurisdiction can be confirmed. Outside-County addresses cannot be overridden." }); return; }
    application.reviewDecisions = { ...application.reviewDecisions, jurisdiction: audit };
  }
  const decisionLabel = body.data.action === "claim" ? `${body.data.claim}: ${body.data.decision}` : body.data.action === "request_documentation" ? `${body.data.claim}: Supporting documentation requested` : body.data.action === "safety" ? `Safety flag cleared / overridden: ${body.data.document}` : body.data.action === "conflict" ? "Classification conflict resolved with corrected fields" : "Service jurisdiction confirmed";
  application.auditHistory = [...(row.auditHistory ?? []), { id: randomUUID(), action: body.data.action, decision: decisionLabel ?? body.data.action, reason: audit.note, workerId: res.locals.portalUser.id, workerName: res.locals.portalUser.name, at: audit.at, detail: body.data.action === "conflict" ? `Before: ${row.projectType}, ${row.permitType}, ${row.housingUnits} units, ${row.description}. After: ${application.projectType}, ${application.permitType}, ${application.housingUnits} units, ${application.description}` : decisionLabel ?? body.data.action }];
  application.notes.unshift({ id: randomUUID(), author: audit.by, body: `${body.data.action} review — ${decisionLabel}: ${audit.note}`, createdAt: new Date(audit.at) });
  const screened = CreatePermitApplicationResponse.parse(screenApplication(application, await readRuleConfig()));
  screened.timeline = buildPermitTimeline(screened.reviewStatus, row.submittedAt, screened.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.update(permitApplicationsTable).set({ ...toValues(screened), revision: sql`${permitApplicationsTable.revision} + 1` }).where(and(eq(permitApplicationsTable.id, id), eq(permitApplicationsTable.revision, row.revision))).returning();
  if (!saved) { res.status(409).json({ error: "Application changed during review. Reload before recording your decision." }); return; }
  res.json(await screenedResponse(saved!));
});
router.patch("/permit-applications/:id/classification", requirePortalUser, async (req, res): Promise<void> => {
  const parsed = CorrectPermitClassificationBody.safeParse(req.body);
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!parsed.success) { res.status(400).json({ error: "Valid project type, units, and description are required." }); return; }
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, id));
  if (!row || !canViewApplication(res.locals.portalUser, row.ownerUserId, row.workspaceId)) { res.status(404).json({ error: "Application not found." }); return; }
  const original = await screenedResponse(row);
  if (!isStaff(res.locals.portalUser) && (!original.ruleChecks?.classificationConflicts.length || ["Approved", "Denied"].includes(row.reviewStatus))) {
    res.status(403).json({ error: "Applicants may correct only pending classification conflicts, not finalized or otherwise reviewed records." }); return;
  }
  const next = CreatePermitApplicationResponse.parse(screenApplication({ ...original, ...parsed.data, reviewStatus: "On Hold — Information Review Required", reviewDecisions: { ...original.reviewDecisions, classification: undefined, safety: [] }, auditHistory: [...(row.auditHistory ?? []), { id: randomUUID(), action: "correction_proposed", decision: "Awaiting staff resolution", reason: "Project classification correction submitted for staff review.", workerId: res.locals.portalUser.id, workerName: res.locals.portalUser.name, at: new Date().toISOString(), detail: `${row.projectType}, ${row.housingUnits} units → ${parsed.data.projectType}, ${parsed.data.housingUnits} units` }], notes: [{ id: randomUUID(), author: res.locals.portalUser.id, body: `Classification correction proposed from ${row.projectType}, ${row.housingUnits} units to ${parsed.data.projectType}, ${parsed.data.housingUnits} units.`, createdAt: new Date() }, ...original.notes] }, await readRuleConfig()));
  next.timeline = buildPermitTimeline(next.reviewStatus, row.submittedAt, next.recommendedRouting.includes("Fire Marshal"));
  const [saved] = await db.update(permitApplicationsTable).set({ ...toValues(next), revision: sql`${permitApplicationsTable.revision} + 1` }).where(and(eq(permitApplicationsTable.id, id), eq(permitApplicationsTable.revision, row.revision))).returning();
  if (!saved) { res.status(409).json({ error: "Application changed during correction. Reload before retrying." }); return; }
  res.json(responseForViewer(await screenedResponse(saved!), res.locals.portalUser));
});
export default router;