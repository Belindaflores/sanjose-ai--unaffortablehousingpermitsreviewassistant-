import { db, permitRuleConfigsTable, permitApplicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { screenApplication, PLACEHOLDER_UNDERSERVED_CONFIG, CreatePermitApplicationResponse } from "@workspace/api-zod";
import type { PortalUser } from "../middlewares/portal-auth";
import { isStaff } from "../middlewares/portal-auth";

export async function readRuleConfig() {
  const [config] = await db.select().from(permitRuleConfigsTable).where(eq(permitRuleConfigsTable.id, "underserved-areas"));
  return config ? { ...config, updatedAt: config.updatedAt.toISOString() } : PLACEHOLDER_UNDERSERVED_CONFIG;
}
export type PermitRow = typeof permitApplicationsTable.$inferSelect;
type PermitIssue = NonNullable<ReturnType<typeof CreatePermitApplicationResponse.parse>["issues"]>[number];
export async function screenedResponse(row: PermitRow) {
  const screened = CreatePermitApplicationResponse.parse(screenApplication({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
    claimed_affordable: row.priorityClaims ? row.claimed_affordable : row.affordableHousing,
    claimed_underserved: row.priorityClaims ? row.claimed_underserved : row.underservedCommunity,
    priorityClaims: row.priorityClaims ?? undefined,
    reviewDecisions: row.reviewDecisions ?? {},
  }, await readRuleConfig()));
  const issues: PermitIssue[] = [];
  const add = (type: PermitIssue["type"], severity: PermitIssue["severity"], reason: string, requiredAction: string, assignedDepartment: string, status = "Open") => issues.push({ type, severity, reason, requiredAction, assignedDepartment, status, flaggedAt: row.submittedAt.toISOString() });
  if (screened.ruleChecks?.safetyCriticalFlags.length) add("safety", "critical", screened.ruleChecks.safetyCriticalFlags.join("; "), "Fire Marshal must review the missing Fire/Life-Safety Plan; no normal progression", "Fire Marshal");
  if (screened.ruleChecks?.jurisdictionStatus === "Needs Verification" && !screened.reviewDecisions?.jurisdiction) add("jurisdiction", "review", screened.ruleChecks.jurisdictionReason ?? "Ambiguous address", "Confirm service jurisdiction with a documented reason", "County Intake");
  if (screened.ruleChecks?.classificationConflicts.length) add("conflict", "review", screened.ruleChecks.classificationConflicts.join("; "), "Resolve conflict and record corrected fields and reason", "County Intake");
  if (screened.flags.includes("Priority claim requires verification")) add("priority", "verification", "Priority claim requires verification", "Verify claim, request supporting documentation, or reject claim", "Housing Review");
  if (screened.documents.some(d => d.required && !d.received)) add("documents", "review", screened.documents.filter(d => d.required && !d.received).map(d => d.label).join("; "), "Request missing required documents", "Building");
  for (const event of (row.auditHistory ?? []).slice().reverse().filter(e => ["safety", "jurisdiction", "conflict", "claim"].includes(e.action))) {
    const type = event.action === "claim" ? "priority" : event.action as PermitIssue["type"];
    if (!issues.some(i => i.type === type)) add(type, "resolved", event.reason, event.detail, type === "safety" ? "Fire Marshal" : type === "priority" ? "Housing Review" : "County Intake", "Cleared or resolved");
  }
  return { ...screened, issues };
}
export function responseForViewer(application: Awaited<ReturnType<typeof screenedResponse>>, user: PortalUser) {
  if (isStaff(user)) return application;
  return {
    ...application, notes: [], auditHistory: [], reviewDecisions: {}, recommendedRouting: [], requiredReviewers: [],
    assignedDepartment: "Permit intake",
    priorityClaims: application.priorityClaims ? {
      affordable: { status: application.priorityClaims.affordable.status },
      underserved: { status: application.priorityClaims.underserved.status },
      additional: application.priorityClaims.additional?.map(c => ({ category: c.category, status: c.status })),
    } : undefined,
    issues: application.issues.filter(i => i.severity !== "resolved").map(i => ({
      ...i, assignedDepartment: "Permit intake", requiredAction: i.type === "safety" ? "Provide the required Fire/Life-Safety Plan. Your application is on hold pending authorized safety review." : i.type === "conflict" ? "Correct the conflicting project details; staff must review the resolution." : i.type === "priority" ? "Provide supporting documentation for your priority claim." : i.type === "jurisdiction" ? "Provide a complete address for human jurisdiction review." : "Provide missing required documents.",
    })),
    aiSummary: `${application.ruleChecks?.completenessLabel ?? "Human review required"}. ${application.ruleChecks?.safetyCriticalFlags.join("; ") ?? ""}`,
  };
}
export function toValues(application: typeof CreatePermitApplicationResponse._output) {
  const { ruleChecks: _checks, issues: _issues, ...values } = application;
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