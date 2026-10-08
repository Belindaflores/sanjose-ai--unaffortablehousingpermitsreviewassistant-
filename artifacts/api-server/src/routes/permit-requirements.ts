import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, permitApplicationsTable } from "@workspace/db";
import {
  GetPermitRequirementsCatalogResponse, GetPermitRequirementsEvaluationResponse, UpdatePermitRequirementDocumentBody,
  PERMIT_REQUIREMENTS, evaluatePermitRequirements, matchingRequirementDocuments, screenApplication,
} from "@workspace/api-zod";
import { requirePortalUser, requireStaff, canViewApplication } from "../middlewares/portal-auth";
import { readRuleConfig, screenedResponse, toValues } from "../lib/permit-screening";
import { refreshIntakeChecklist } from "../lib/intake-analysis";

const router = Router();
router.get("/permit-requirements/catalog", requirePortalUser, (_req, res) => {
  res.json(GetPermitRequirementsCatalogResponse.parse(PERMIT_REQUIREMENTS));
});
router.get("/permit-applications/:id/requirements", requirePortalUser, async (req, res): Promise<void> => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, id));
  if (!row || !canViewApplication(res.locals.portalUser, row.ownerUserId)) { res.status(404).json({ error: "Application not found." }); return; }
  const application = await screenedResponse(row);
  res.json(GetPermitRequirementsEvaluationResponse.parse(application.requirementsEvaluation));
});
router.patch("/permit-applications/:id/requirement-documents", requirePortalUser, requireStaff, async (req, res): Promise<void> => {
  const input = UpdatePermitRequirementDocumentBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "A requirement ID and boolean simulated document status are required." }); return; }
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const [row] = await db.select().from(permitApplicationsTable).where(eq(permitApplicationsTable.id, id));
  const definition = PERMIT_REQUIREMENTS.find(rule => rule.requirement_id === input.data.requirement_id);
  if (!row || !definition) { res.status(404).json({ error: "Application or requirement not found." }); return; }
  const application = await screenedResponse(row);
  const result = evaluatePermitRequirements(application).requirements.find(rule => rule.requirement_id === definition.requirement_id)!;
  if (result.applicability !== "APPLIES") { res.status(409).json({ error: "Establish project applicability and jurisdiction before changing this requirement's checklist status." }); return; }
  const matched = matchingRequirementDocuments(definition, application);
  const selected = matched.find(document => document.label === definition.required_document) ?? matched[0];
  const documents = selected
    ? application.documents.map(document => document.label === selected.label ? { ...document, received: input.data.received } : document)
    : [...application.documents, { label: definition.required_document, category: `Rules engine · ${definition.group}`, required: true, received: input.data.received }];
  const next = screenApplication({ ...application, documents }, await readRuleConfig());
  const intakeAnalysis = refreshIntakeChecklist(next);
  // Do not overwrite simultaneous staff notes, claim decisions, ownership or classification.
  const [saved] = await db.update(permitApplicationsTable).set({
    documents: toValues(next).documents, intakeAnalysis, completenessScore: next.completenessScore, aiStatus: next.aiStatus,
    flags: next.flags, aiSummary: next.aiSummary, recommendedRouting: next.recommendedRouting,
    requiredReviewers: next.requiredReviewers ?? [],
  }).where(eq(permitApplicationsTable.id, id)).returning();
  res.json(await screenedResponse(saved!));
});
export default router;
