import { db, permitRuleConfigsTable, permitApplicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { screenApplication, PLACEHOLDER_UNDERSERVED_CONFIG, CreatePermitApplicationResponse } from "@workspace/api-zod";
import { buildPermitTimeline } from "./permit-timeline";

export async function readRuleConfig() {
  const [config] = await db.select().from(permitRuleConfigsTable).where(eq(permitRuleConfigsTable.id, "underserved-areas"));
  return config ? { ...config, updatedAt: config.updatedAt.toISOString() } : PLACEHOLDER_UNDERSERVED_CONFIG;
}
export type PermitRow = typeof permitApplicationsTable.$inferSelect;
export async function screenedResponse(row: PermitRow) {
  const screened = CreatePermitApplicationResponse.parse(screenApplication({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    claimed_affordable: row.priorityClaims ? row.claimed_affordable : row.affordableHousing,
    claimed_underserved: row.priorityClaims ? row.claimed_underserved : row.underservedCommunity,
    priorityClaims: row.priorityClaims ?? undefined,
    reviewDecisions: row.reviewDecisions ?? {},
  }, await readRuleConfig()));
  // Old stored stages cannot imply progress beyond a newly enforced server hold.
  if (screened.reviewStatus !== row.reviewStatus) {
    screened.timeline = buildPermitTimeline(screened.reviewStatus, row.submittedAt, screened.recommendedRouting.includes("Fire Marshal"));
  }
  return screened;
}
export function toValues(application: typeof CreatePermitApplicationResponse._output) {
  const { ruleChecks: _checks, ...values } = application;
  return {
    ...values, dataSource: "Prototype Submission",
    submittedAt: new Date(application.submittedAt),
    documents: application.documents.map(d => ({ ...d, receivedAt: d.receivedAt ? new Date(d.receivedAt).toISOString() : undefined })),
    notes: application.notes.map(n => ({ ...n, createdAt: new Date(n.createdAt).toISOString() })),
    requiredReviewers: application.requiredReviewers ?? [],
    claimed_affordable: application.claimed_affordable ?? application.affordableHousing,
    claimed_underserved: application.claimed_underserved ?? application.underservedCommunity,
  };
}