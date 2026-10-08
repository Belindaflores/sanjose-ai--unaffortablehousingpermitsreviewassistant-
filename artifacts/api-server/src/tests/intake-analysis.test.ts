import test from "node:test";
import assert from "node:assert/strict";
import { CreatePermitApplicationResponse, screenApplication, simulatedDocumentStatuses } from "@workspace/api-zod";
import { analyzeIntake, assembleIntakeAnalysis, type ExtractedIntake } from "../lib/intake-analysis";
import { toValues } from "../lib/permit-screening";

function application(description = "New construction of 120 units; 120 affordable units. APN 123-45-678. Potential SB 35. 3 buildings, 6 stories, 150000 square feet and 80 parking spaces.") {
  return CreatePermitApplicationResponse.parse(screenApplication({
    id: "SCC-intake-test", ownerUserId: "intake-test-owner", dataSource: "Prototype Submission",
    applicantName: "Test Applicant", companyName: "Test Developer", email: "test@example.com",
    projectName: "Test Housing", projectAddress: "123 Main St, San Jose, CA",
    projectType: "Multifamily housing", permitType: "Building permit", description, housingUnits: 120,
    estimatedCost: 1000, affordableHousing: true, underservedCommunity: false,
    submittedAt: "2026-10-07T12:00:00.000Z", reviewStatus: "New", assignedDepartment: "Building",
    documents: simulatedDocumentStatuses([
      { label: "Architectural plans", category: "Plans", required: true, received: true },
      { label: "Fire and life safety plan", category: "Safety", required: false, received: false },
    ]), notes: [], timeline: [],
  }));
}
const extracted: ExtractedIntake = { fields: [
  { key: "apn", value: "123-45-678", confidence: "HIGH", quote: "APN 123-45-678" },
  { key: "affordableUnits", value: "120", confidence: "HIGH", quote: "120 affordable units" },
  { key: "housingProcess", value: "SB 35", confidence: "HIGH", quote: "Potential SB 35" },
] };

test("intake extracts only traceable application text and derives the stated affordable percentage", () => {
  const input = application();
  const result = assembleIntakeAnalysis(input, extracted);
  assert.equal(result.status, "completed");
  assert.equal(result.fields.find(field => field.key === "apn")?.value, "123-45-678");
  assert.equal(result.fields.find(field => field.key === "affordablePercentage")?.value, "100%");
  const process = result.fields.find(field => field.key === "housingProcess")!;
  assert.equal(process.confidence, "MEDIUM");
  assert.match(process.value!, /Potential SB 35.*staff verification required/);
  assert.ok(result.fields.every(field => field.evidence.every(source => source.documentName === null && source.page === null)));
  assert.equal(result.actualDocumentsAnalyzed, 0);
  assert.equal(result.checklistSubmitted, 1);
  assert.equal(result.requiredDocumentsExpected, 2);
  assert.equal(result.missingRequired, 1);
  assert.equal(result.potentialDocumentMismatches, null);
  assert.equal(input.priority, "Normal");
  assert.ok(input.requiredReviewers?.includes("Fire Marshal"));
});

test("fabricated values, fabricated quotes, duplicated keys, and unsupported process claims cannot become findings", () => {
  const result = assembleIntakeAnalysis(application(), { fields: [
    { key: "apn", value: "999-99-999", confidence: "HIGH", quote: "APN 123-45-678" },
    { key: "storyCount", value: "8", confidence: "HIGH", quote: "8 stories" },
    { key: "buildingCount", value: "3", confidence: "HIGH", quote: "3 buildings" },
    { key: "buildingCount", value: "6", confidence: "HIGH", quote: "6 stories" },
    { key: "housingProcess", value: "120", confidence: "HIGH", quote: "120 units" },
  ] });
  for (const key of ["apn", "storyCount", "buildingCount", "housingProcess"]) {
    const field = result.fields.find(field => field.key === key)!;
    assert.equal(field.value, null);
    assert.equal(field.confidence, "LOW");
    assert.deepEqual(field.evidence, []);
  }
});

test("a checked affordable claim does not invent affordable units, percent, APN or document contents", () => {
  const result = assembleIntakeAnalysis(application("Applicant says affordable housing."), { fields: [] });
  for (const key of ["affordableUnits", "affordablePercentage", "apn"]) assert.equal(result.fields.find(field => field.key === key)?.value, null);
  const document = result.documents[0]!;
  assert.equal(document.fields.find(field => field.key === "documentType")?.value, "Architectural plans");
  for (const field of document.fields.filter(field => field.key !== "documentType")) {
    assert.equal(field.value, null);
    assert.equal(field.note, "Not found in submitted documents.");
    assert.deepEqual(field.evidence, []);
  }
});
test("a verbatim total-unit quote cannot be misrepresented as an affordable-unit count", () => {
  const result = assembleIntakeAnalysis(application("120 units. Applicant claims affordable housing."), { fields: [
    { key: "affordableUnits", value: "120", confidence: "HIGH", quote: "120 units" },
  ] });
  assert.equal(result.fields.find(field => field.key === "affordableUnits")?.value, null);
  assert.equal(result.fields.find(field => field.key === "affordablePercentage")?.value, null);
});
test("even an applicant's legal approval claim is displayed only as a potential named process", () => {
  const result = assembleIntakeAnalysis(application("SB 35 legally approved."), { fields: [
    { key: "housingProcess", value: "SB 35 legally approved", confidence: "HIGH", quote: "SB 35 legally approved." },
  ] });
  assert.equal(result.fields.find(field => field.key === "housingProcess")?.value, "Potential SB 35 — staff verification required");
});

test("zero affordable units is distinct from unknown and inconsistent counts never produce a percentage", () => {
  const zero = assembleIntakeAnalysis(application("0 affordable units."), { fields: [
    { key: "affordableUnits", value: "0", confidence: "HIGH", quote: "0 affordable units" },
  ] });
  assert.equal(zero.fields.find(field => field.key === "affordablePercentage")?.value, "0%");
  const inconsistent = assembleIntakeAnalysis(application("200 affordable units."), { fields: [
    { key: "affordableUnits", value: "200", confidence: "HIGH", quote: "200 affordable units" },
  ] });
  assert.equal(inconsistent.fields.find(field => field.key === "affordablePercentage")?.value, null);
  assert.equal(inconsistent.fields.find(field => field.key === "affordableUnits")?.confidence, "LOW");
});

test("provider failures and invalid results are explicit and do not block storing the application", async () => {
  for (const extractor of [
    async () => { throw new Error("Unavailable"); },
    async () => ({ unexpected: "result" }),
  ]) {
    const input = application();
    const result = await analyzeIntake(input, extractor);
    assert.equal(result.status, "failed");
    assert.match(result.error!, /application was saved.*retry/);
    const saved = toValues({ ...input, intakeAnalysis: result });
    assert.equal(saved.intakeAnalysis?.status, "failed");
    assert.equal(saved.priority, input.priority);
    assert.deepEqual(saved.documents, input.documents);
  }
});

test("completed findings and source evidence survive the actual database JSON mapper", async () => {
  const input = application();
  const result = await analyzeIntake(input, async () => extracted);
  const saved = toValues({ ...input, intakeAnalysis: result });
  const roundTrip = CreatePermitApplicationResponse.parse({ ...saved, submittedAt: saved.submittedAt.toISOString() });
  assert.deepEqual(roundTrip.intakeAnalysis, result);
});
