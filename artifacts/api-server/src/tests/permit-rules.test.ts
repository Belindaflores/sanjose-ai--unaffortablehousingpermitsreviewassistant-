import test from "node:test";
import assert from "node:assert/strict";
import { screenApplication, checkJurisdiction, descriptionUnitCounts, FIRE_UNIT_THRESHOLD, type ScreeningInput } from "@workspace/api-zod";
import { canViewApplication, isStaff } from "../middlewares/portal-auth";
const completeDocs = ["Architectural plans", "Structural plans", "Site plan and survey", "Energy compliance", "Fire and life safety plan"].map(label => ({ label, required: true, received: true }));
const base: ScreeningInput = { projectAddress: "123 Main Street, San Jose, CA 95112", projectType: "Single-family residential", housingUnits: 1, description: "New single-family home with 1 unit.", affordableHousing: false, underservedCommunity: false, documents: completeDocs };
test("Oakland is rejected by jurisdiction check and is never eligible for priority", () => {
  assert.equal(checkJurisdiction("123 H Street, Oakland, CA 94612").status, "Outside County");
  assert.equal(screenApplication({ ...base, projectAddress: "123 H Street, Oakland, CA 94612", affordableHousing: true }).priority, "Normal");
});
test("San Jose is accepted; a complete consistent single-family application is ready for human review", () => {
  assert.equal(checkJurisdiction(base.projectAddress).status, "In County");
  const result = screenApplication(base);
  assert.equal(result.completenessScore, 100);
  assert.equal(result.aiStatus, "Ready for Human Review");
});
test("unverified claims never boost priority", () => {
  const result = screenApplication({ ...base, affordableHousing: true, underservedCommunity: true });
  assert.equal(result.priority, "Normal");
  assert.equal(result.verification_status, "Unverified");
  assert.ok(result.flags.includes("Priority claim pending staff verification."));
});
test("verified claims boost priority, rejected claims do not, and partial verification stays standard", () => {
  const verified = { status: "Verified" as const, by: "staff-test", note: "Evidence reviewed", at: "2026-10-03T00:00:00Z" };
  const claims = { affordable: verified, underserved: { status: "Unverified" as const } };
  assert.equal(screenApplication({ ...base, affordableHousing: true, priorityClaims: claims }).priority, "High");
  assert.equal(screenApplication({ ...base, affordableHousing: true, underservedCommunity: true, priorityClaims: claims }).priority, "Normal");
  assert.equal(screenApplication({ ...base, affordableHousing: true, priorityClaims: { ...claims, affordable: { status: "Rejected" } } }).priority, "Normal");
});
test("missing fire plan on 48-unit multifamily requires Fire Marshal and blocks progress", () => {
  const result = screenApplication({ ...base, projectType: "Multifamily housing", housingUnits: 48, description: "48-unit apartment complex", reviewStatus: "Ready for Review", documents: completeDocs.filter(d => !d.label.includes("Fire")) });
  assert.equal(result.reviewStatus, "Blocked — Safety Review Required");
  assert.ok(result.requiredReviewers.includes("Fire Marshal"));
  assert.ok(result.recommendedRouting.includes("Fire Marshal"));
  assert.ok(result.flags.includes("Safety-Critical: Missing fire/life-safety plan — Fire Marshal review required."));
  assert.ok(result.completenessScore < 100);
  assert.notEqual(result.aiStatus, "Ready for Human Review");
});
test("fire threshold includes exactly five units and descriptive unit counts", () => {
  assert.equal(FIRE_UNIT_THRESHOLD, 5);
  for (const units of [5, 48]) assert.ok(screenApplication({ ...base, housingUnits: units, description: `${units} units`, documents: [] }).requiredReviewers.includes("Fire Marshal"));
  assert.ok(screenApplication({ ...base, description: "48 units", documents: [] }).requiredReviewers.includes("Fire Marshal"));
});
test("120-unit apartment complex selected as ADU requires human classification review, even with all documents", () => {
  const result = screenApplication({ ...base, projectType: "Accessory dwelling unit", housingUnits: 120, description: "120-unit apartment complex" });
  assert.equal(result.reviewStatus, "Needs Human Review — Data Inconsistency");
  assert.equal(result.ruleChecks.completenessLabel, "Incomplete — needs clarification");
  assert.ok(result.ruleChecks.classificationConflicts.some(f => f.includes("120-unit apartment complex")));
  assert.ok(result.requiredReviewers.includes("County Intake — Human Reviewer"));
  assert.equal(result.completenessScore, 99);
});
test("fire blocks take precedence while retaining classification conflicts", () => {
  const result = screenApplication({ ...base, projectType: "ADU", housingUnits: 120, description: "120-unit apartment complex", documents: [] });
  assert.equal(result.reviewStatus, "Blocked — Safety Review Required");
  assert.ok(result.ruleChecks.classificationConflicts.length);
  assert.equal(result.ruleChecks.completenessLabel, "Incomplete — needs clarification");
});
test("descriptive numeric and word counts are checked against field, including hyphenated words", () => {
  assert.deepEqual(descriptionUnitCounts("forty-eight units and 120-unit apartment complex"), [120, 48]);
  assert.ok(screenApplication({ ...base, description: "Three units" }).ruleChecks.classificationConflicts.some(f => f.includes("3 units")));
  assert.ok(screenApplication({ ...base, housingUnits: 20, description: "ADU addition" }).ruleChecks.classificationConflicts.length);
});
test("ambiguous address routes to human verification; street containing San Jose cannot disguise Oakland", () => {
  assert.equal(checkJurisdiction("Address pending").status, "Needs Verification");
  assert.equal(checkJurisdiction("123 San Jose Avenue, Oakland, CA 95112").status, "Outside County");
  assert.equal(checkJurisdiction("123 Main Street, San Jose, TX 95112").status, "Outside County");
  assert.equal(checkJurisdiction("123 Main Street, Palo Alto, CA 94303").status, "Needs Verification");
  const result = screenApplication({ ...base, projectAddress: "Address pending" });
  assert.equal(result.reviewStatus, "Needs Jurisdiction Verification");
  assert.ok(result.requiredReviewers.includes("County Intake — Human Reviewer"));
});
test("placeholder underserved-area match is informational only", () => {
  const result = screenApplication({ ...base, projectAddress: "123 Main Street, San Jose, CA 95116", underservedCommunity: true });
  assert.equal(result.priority, "Normal");
  assert.match(result.ruleChecks.underservedMatch, /PLACEHOLDER DATA/);
  assert.match(result.ruleChecks.underservedMatch, /matches configured list/);
});
test("documented staff safety resolution unblocks review but never makes missing plan complete", () => {
  const result = screenApplication({ ...base, projectType: "Multifamily housing", housingUnits: 48, description: "48 units", documents: completeDocs.filter(d => !d.label.includes("Fire")), reviewDecisions: { safety: [{ document: "Fire and life safety plan", by: "staff-test", at: "2026-10-03T00:00:00Z", note: "Reviewed alternative safety documents." }] } });
  assert.ok(!result.requiredReviewers.includes("Fire Marshal"));
  assert.ok(result.completenessScore < 100);
  assert.notEqual(result.aiStatus, "Ready for Human Review");
});
test("ownership and privileged-role policy does not trust applicant role selection or email", () => {
  assert.equal(isStaff({ role: "applicant" }), false);
  assert.equal(isStaff({ role: "worker" }), true);
  assert.equal(isStaff({ role: "fire_marshal" }), true);
  assert.equal(canViewApplication({ id: "owner-a", role: "applicant" }, "owner-b"), false);
  assert.equal(canViewApplication({ id: "owner-a", role: "applicant" }, null), false);
  assert.equal(canViewApplication({ id: "owner-a", role: "applicant" }, "owner-a"), true);
});