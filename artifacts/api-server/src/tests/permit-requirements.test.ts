import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMIT_REQUIREMENTS, evaluatePermitRequirements, extendRequirementChecklist,
  declaredFeature, CreatePermitApplicationResponse, screenApplication,
} from "@workspace/api-zod";
import { assembleIntakeAnalysis, refreshIntakeChecklist } from "../lib/intake-analysis";
import { toValues } from "../lib/permit-screening";

function application(description: string, overrides: Record<string, unknown> = {}) {
  return CreatePermitApplicationResponse.parse(screenApplication({
    id: "requirements-test", applicantName: "Synthetic Applicant", companyName: "Synthetic Co",
    email: "test@example.com", projectName: "Synthetic project", projectAddress: "123 Main St, San Jose, CA",
    permitType: "Building permit", projectType: "Multifamily housing", housingUnits: 120, estimatedCost: 100,
    affordableHousing: false, underservedCommunity: false, description,
    submittedAt: new Date().toISOString(), reviewStatus: "New", assignedDepartment: "Building",
    documents: [
      { label: "Architectural plans", category: "Plans", required: true, received: true },
      { label: "Structural plans", category: "Engineering", required: true, received: false },
      { label: "Fire and life safety plan", category: "Safety", required: false, received: false },
    ], timeline: [], notes: [], ...overrides,
  }));
}
const result = (description: string, id: string, overrides: Record<string, unknown> = {}) =>
  evaluatePermitRequirements(application(description, overrides)).requirements.find(rule => rule.requirement_id === id)!;

test("all 29 structured rules carry predicates, document names and official references", () => {
  assert.equal(PERMIT_REQUIREMENTS.length, 29);
  assert.equal(new Set(PERMIT_REQUIREMENTS.map(rule => rule.requirement_id)).size, 29);
  for (const rule of PERMIT_REQUIREMENTS) {
    assert.ok(rule.applicable_when.all.length && rule.applicable_when.description);
    assert.ok(rule.required_document && rule.source.section);
    assert.match(rule.source.url, /^https:\/\/www\.sanjoseca\.gov\//);
  }
});
test("new construction and an explicit SB 35 request activate title-report and core reference rules", () => {
  assert.equal(result("New construction. Applicant requests SB 35.", "SB35-TITLE").status, "MISSING");
  assert.equal(result("New construction. Applicant requests SB 35.", "MF-ELEC").status, "MISSING");
  const plans = result("New construction. Applicant requests SB 35.", "SB35-PLANS");
  assert.equal(plans.status, "REVIEW");
  assert.deepEqual(plans.matched_documents, ["Architectural plans"]);
  assert.match(plans.explanation, /all plan components/);
});
test("unknown conditional applicability is REVIEW, never MISSING", () => {
  for (const id of ["MF-FIRE", "MF-HEALTH", "MF-ENV", "MF-PW", "MF-DEFERRED", "MF-SOIL", "MF-ELEC", "SB35-WORKFORCE", "SB35-TITLE", "SB35-DESIGN"]) {
    const rule = result("Applicant requests SB 35.", id);
    assert.equal(rule.status, "REVIEW", id);
    assert.equal(rule.applicability, "UNKNOWN", id);
    assert.match(rule.explanation, /unknown|not established|did not establish|unresolved/i);
  }
});
test("food service, public swimming pools and fire sprinklers trigger only their applicable clearances", () => {
  for (const id of ["MF-FIRE", "MF-HEALTH", "MF-ENV"]) {
    assert.equal(result("Includes fire sprinklers, food service and a public swimming pool.", id).status, "MISSING");
  }
  assert.equal(result("Manufacturing discharge.", "MF-ENV").status, "MISSING");
  assert.equal(result("Manufacturing discharge.", "MF-HEALTH").status, "REVIEW");
});
test("negated and uncertain project features cannot become affirmative conditional requirements", () => {
  assert.equal(result("No fire sprinklers. No food service. No public swimming pool.", "MF-FIRE").status, "NOT_APPLICABLE");
  assert.equal(result("No food service. No public swimming pool.", "MF-HEALTH").status, "NOT_APPLICABLE");
  assert.equal(result("May include fire sprinklers.", "MF-FIRE").status, "REVIEW");
  assert.equal(result("Not sure about fire sprinklers.", "MF-FIRE").status, "REVIEW");
  assert.equal(result("Are fire sprinklers required?", "MF-FIRE").status, "REVIEW");
  assert.equal(declaredFeature("No fire sprinklers. Fire sprinklers included.", /\bfire sprinklers\b/, "Sprinklers").value, null);
});
test("contradictory or uncertain construction descriptions are not asserted as new-building requirements or exemptions", () => {
  assert.equal(result("No new construction. New construction is proposed. Remodel. SB 35 requested.", "SB35-TITLE").status, "REVIEW");
  assert.equal(result("May include new construction. Remodel. SB 35 requested.", "SB35-TITLE").status, "REVIEW");
});
test("an affordable checkbox alone does not invent an SB 35 application pathway", () => {
  const rule = result("Affordable housing.", "SB35-APPLICATION", { affordableHousing: true });
  assert.equal(rule.status, "REVIEW");
  assert.equal(rule.applicability, "UNKNOWN");
  assert.equal(result("Applicant requests SB 35.", "SB35-DENSITY").status, "NOT_APPLICABLE");
  assert.equal(result("Applicant requests SB 35 and a density bonus.", "SB35-DENSITY").status, "MISSING");
});
test("San José references never become missing legal requirements for another County city or a street-name match", () => {
  const other = result("New construction. SB 35 requested.", "SB35-TITLE", { projectAddress: "123 San Jose Drive, Campbell, CA" });
  assert.equal(other.status, "REVIEW");
  assert.equal(other.applicability, "UNKNOWN");
  assert.match(other.explanation, /reference rule/);
  assert.equal(result("New construction. SB 35 requested.", "SB35-TITLE", { projectAddress: "123 Main St, San José, CA" }).status, "MISSING");
});
test("Downtown guideline uncertainty is not a missing Citywide checklist", () => {
  assert.equal(result("SB 35 requested.", "SB35-DESIGN").status, "REVIEW");
  assert.equal(result("SB 35 requested. Downtown project.", "SB35-DESIGN").status, "NOT_APPLICABLE");
  assert.equal(result("SB 35 requested. Project outside Downtown.", "SB35-DESIGN").status, "MISSING");
});
test("simulation-only evaluation never generates PASS or fictitious filename/page evidence", () => {
  const input = application("New construction. SB 35 requested. Fire sprinklers, food service, grading and density bonus.");
  input.documents = PERMIT_REQUIREMENTS.map(rule => ({ label: rule.required_document, category: rule.group, required: true, received: true }));
  const evaluation = evaluatePermitRequirements(input);
  assert.ok(evaluation.requirements.every(rule => rule.status !== "PASS"));
  assert.ok(evaluation.requirements.every(rule => rule.evidence.every(evidence => evidence.documentName === null && evidence.page === null)));
  assert.ok(evaluation.requirements.some(rule => rule.status === "REVIEW"));
});
test("checklist extension keeps original entries and file metadata, adds only established requirements, and never duplicates aliases", () => {
  const input = application("New construction. SB 35 requested.");
  const original = input.documents.map(doc => ({ ...doc, fileName: "historical.pdf", objectPath: "/objects/historical" }));
  const extended = extendRequirementChecklist(input, original);
  assert.deepEqual(extended.slice(0, original.length), original);
  assert.equal(extended.filter(doc => /Architectural/i.test(doc.label)).length, 1);
  assert.ok(extended.some(doc => doc.label === "Preliminary Title Report" && doc.required));
  assert.ok(!extended.some(doc => doc.label === "County Health Department approvals"));
  const changed = extendRequirementChecklist({ ...input, description: "Remodel. No SB 35 request." }, extended);
  assert.equal(changed.find(doc => doc.label === "Preliminary Title Report")?.required, false);
  assert.deepEqual(changed.find(doc => doc.label === "Architectural plans"), original[0]);
});
test("low-confidence or missing construction information from AI does not activate a title-report requirement", () => {
  const input = application("New construction. SB 35 requested.");
  input.intakeAnalysis = assembleIntakeAnalysis(input, { fields: [{ key: "constructionType", value: "New construction", quote: "New construction", confidence: "LOW" }] });
  const title = evaluatePermitRequirements(input).requirements.find(rule => rule.requirement_id === "SB35-TITLE")!;
  assert.equal(title.status, "REVIEW");
  assert.equal(title.applicability, "UNKNOWN");
});
test("potential SB 35 screening never establishes legal eligibility and identifies a stated zero-affordable-unit issue", () => {
  const input = application("New construction. SB 35 requested. 0 affordable units.", { affordableHousing: true });
  input.intakeAnalysis = assembleIntakeAnalysis(input, { fields: [{ key: "affordableUnits", value: "0", quote: "0 affordable units", confidence: "HIGH" }] });
  const screening = evaluatePermitRequirements(input).sb35_screening;
  assert.equal(screening.status, "ISSUE");
  assert.equal(screening.message, "Potential eligibility issue identified — Staff review required.");
  assert.match(screening.disclaimer, /NOT a final/);
  assert.ok(screening.criteria.some(item => item.status === "UNKNOWN"));
  const potential = evaluatePermitRequirements(application("SB 35 requested.", { affordableHousing: true })).sb35_screening;
  assert.equal(potential.message, "Potentially eligible — Staff verification required");
  assert.equal(evaluatePermitRequirements(application("Housing.", { affordableHousing: false })).sb35_screening.status, "NOT_REQUESTED");
});
test("changing a simulated requirement refreshes checklist counts without deleting stored intake field evidence", () => {
  const input = application("SB 35 requested.");
  input.intakeAnalysis = assembleIntakeAnalysis(input, { fields: [] });
  const fields = input.intakeAnalysis.fields;
  const timestamp = input.intakeAnalysis.analyzedAt;
  input.documents.push({ label: "Preliminary Title Report", category: "Rules engine", required: true, received: true });
  const refreshed = refreshIntakeChecklist(input)!;
  assert.deepEqual(refreshed.fields, fields);
  assert.equal(refreshed.analyzedAt, timestamp);
  assert.equal(refreshed.checklistSubmitted, 2);
  assert.equal(refreshed.actualDocumentsAnalyzed, 0);
});
test("requirements evaluation is server-derived and cannot overwrite priority, safety rules or DB columns", () => {
  const input = application("New construction. SB 35 requested.", { affordableHousing: true });
  input.requirementsEvaluation = evaluatePermitRequirements(input);
  assert.equal(input.priority, "Normal");
  assert.ok(input.requiredReviewers?.includes("Fire Marshal"));
  assert.ok(!("requirementsEvaluation" in toValues(input)));
});
