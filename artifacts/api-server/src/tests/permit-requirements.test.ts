import test from "node:test";
import assert from "node:assert/strict";
import { CreatePermitApplicationResponse, screenApplication } from "@workspace/api-zod";
import { buildDocumentVerifications, buildSB35Screening, evaluatePermitRequirements } from "../lib/permit-requirements";

const checklistLabels = [
  "Architectural plans", "Structural plans", "Site plan and survey", "Fire and life safety plan",
  "Title 24 energy forms", "Owner authorization", "Planning / zoning forms",
  "Cover sheet with project description", "Electrical plan", "Mechanical plan", "Plumbing plan",
  "Structural calculations", "Soil report", "Special Inspection Form", "Accessibility compliance form",
  "Building permit application", "Deferred submittal form", "Special inspection new building form",
  "Public Works clearance", "Fire Department clearance", "Environmental Services approval",
  "County Health approval", "Preliminary title report", "Stormwater Evaluation Form",
  "Stormwater Submittal Checklist", "SB 35 application",
  "Transportation Demand Management (TDM) checklist", "Citywide Design Guidelines checklist",
  "Legal description", "Density Bonus application", "Prevailing Wage certification",
  "Skilled and Trained Workforce certification",
];

function application({
  description = "New construction of a 24-unit multifamily housing project.",
  projectType = "Multifamily housing",
  projectAddress = "123 Main St, San Jose, CA 95112",
  affordableHousing = false,
  received = [] as string[],
}: {
  description?: string;
  projectType?: string;
  projectAddress?: string;
  affordableHousing?: boolean;
  received?: string[];
} = {}) {
  return CreatePermitApplicationResponse.parse(screenApplication({
    id: "SCC-requirements-test",
    ownerUserId: "requirements-test-owner",
    applicantName: "Test Applicant",
    companyName: "Test Developer",
    email: "test@example.com",
    projectName: "Test Multifamily",
    projectAddress,
    permitType: "Building permit",
    projectType,
    housingUnits: 24,
    affordableHousing,
    underservedCommunity: false,
    estimatedCost: 1000,
    description,
    submittedAt: "2026-10-07T12:00:00.000Z",
    reviewStatus: "New",
    assignedDepartment: "Building",
    documents: checklistLabels.map((label, index) => ({
      label,
      category: index < 3 ? "Plans" : "Additional intake",
      required: false,
      received: received.includes(label),
      ...(received.includes(label) ? { fileName: "do-not-return-this-filename.pdf" } : {}),
    })),
    notes: [],
    timeline: [],
  }));
}

function requirement(id: string, input = application()) {
  return evaluatePermitRequirements(input).find(item => item.requirementId === id)!;
}

test("a simulated submitted plan set remains REVIEW and claims no page, component or code verification", () => {
  const input = application({ received: ["Architectural plans"] });
  const result = requirement("mf-plan-set", input);
  assert.equal(result.status, "REVIEW");
  assert.equal(result.documentChecklistStatus, "submitted");
  assert.match(result.explanation, /no file, page, or document content was read|contents, pages, and project match were not inspected|Submitted \(simulated\)/i);
  assert.ok(result.evidence.every(item => item.documentName === null && item.page === null));
  assert.ok(evaluatePermitRequirements(input).every(item => item.status !== "PASS"));
  assert.match(result.source.reference, /Form 355, Sections 4–5.*Section 4 — Plans/);
});

test("an explicitly applicable rule may be MISSING only from an explicit missing checklist category", () => {
  const input = application();
  assert.equal(requirement("mf-electrical-plan", input).status, "MISSING");
  assert.equal(requirement("mf-electrical-plan", input).documentChecklistStatus, "missing");
  assert.equal(requirement("mf-electrical-plan", input).applicability, "applicable");
});

test("missing status metadata and unclear conditional applicability go to REVIEW, not MISSING", () => {
  const priorRecord = CreatePermitApplicationResponse.parse(screenApplication({
    ...application(),
    id: "SCC-historical-requirements-test",
    documents: [],
  }));
  const result = requirement("mf-electrical-plan", priorRecord);
  assert.equal(result.status, "REVIEW");
  assert.equal(result.documentChecklistStatus, "unavailable");
  assert.equal(requirement("mf-fire-clearance", application()).status, "REVIEW");
  assert.equal(requirement("mf-county-health", application()).status, "REVIEW");
});

test("only a described new-construction scope marks the requested title-report category missing", () => {
  assert.equal(requirement("mf-preliminary-title-report").status, "MISSING");
  const notStated = application({ description: "Multifamily housing application." });
  assert.equal(requirement("mf-preliminary-title-report", notStated).status, "REVIEW");
  const alteration = application({ description: "Structural alteration and addition to an existing multifamily building." });
  assert.equal(requirement("mf-preliminary-title-report", alteration).status, "NOT_APPLICABLE");
  assert.match(requirement("mf-preliminary-title-report").explanation, /applicable date window.*required/i);
});

test("project-specific Fire and Health clearances require a stated triggering feature", () => {
  const noTriggers = application();
  assert.equal(requirement("mf-fire-clearance", noTriggers).status, "REVIEW");
  assert.equal(requirement("mf-county-health", noTriggers).status, "REVIEW");
  const triggers = application({ description: "New construction; includes fire sprinklers and food service." });
  assert.equal(requirement("mf-fire-clearance", triggers).status, "MISSING");
  assert.equal(requirement("mf-county-health", triggers).status, "MISSING");
  assert.equal(requirement("mf-environmental-clearance", triggers).status, "MISSING");
});

test("unknown stormwater applicability is not represented as a missing form", () => {
  const newConstruction = application({ description: "New construction of a multifamily apartment project." });
  assert.equal(requirement("mf-stormwater-evaluation", newConstruction).status, "REVIEW");
  assert.equal(requirement("mf-stormwater-checklist", newConstruction).status, "REVIEW");
  const explicitTrigger = application({ description: "New construction; project has 7,000 square feet of new impervious surface." });
  assert.equal(requirement("mf-stormwater-evaluation", explicitTrigger).status, "MISSING");
});

test("San José multifamily source rules are not applied to non-multifamily or other-city projects", () => {
  assert.ok(evaluatePermitRequirements(application({ projectType: "Single-family residential", description: "New construction of one detached home." }))
    .every(item => item.status === "NOT_APPLICABLE"));
  assert.ok(evaluatePermitRequirements(application({ projectAddress: "123 Main St, Campbell, CA 95008" }))
    .every(item => item.status === "NOT_APPLICABLE"));
  assert.ok(evaluatePermitRequirements(application({ projectAddress: "123 Main St, San Jose, TX 95112" }))
    .every(item => item.status === "NOT_APPLICABLE"));
});

test("SB 35 screening uses stated application signals and never makes a final eligibility claim", () => {
  const identified = buildSB35Screening(application({
    description: "Multifamily new construction. Potential SB 35 request and 12 affordable units.",
  }));
  assert.equal(identified.screeningMessage, "Potentially eligible — Staff verification required");
  assert.match(identified.explanation, /not an SB 35 eligibility finding/i);
  assert.match(identified.disclaimer, /not a legal eligibility determination/i);
  assert.ok(identified.criteria.some(item => item.name.includes("SB 35") && item.observation === "OBSERVED"));
  const notIdentified = buildSB35Screening(application());
  assert.equal(notIdentified.screeningMessage, "Potential eligibility issue identified — Staff review required");
  assert.match(notIdentified.explanation, /not a finding of ineligibility/i);
});

test("document verification never copies submitted filenames or invents confidence, components, or project matching", () => {
  const input = application({ received: ["Architectural plans"] });
  const [result] = buildDocumentVerifications(input);
  assert.ok(result);
  assert.equal(result.status, "REVIEW");
  assert.deepEqual(result.detected, []);
  assert.equal(result.aiConfidence, null);
  assert.equal(result.projectMatch, "Not assessed");
  assert.ok(result.couldNotVerify.length > 0);
  assert.doesNotMatch(JSON.stringify(result), /do-not-return-this-filename|\.pdf|page \d/i);
  assert.match(result.recommendation, /no uploaded file/i);
});

test("an absent applicant address cannot trigger a City-specific MISSING result", () => {
  const input = application({ projectAddress: "Address not stated" });
  assert.ok(evaluatePermitRequirements(input).every(item => item.status === "REVIEW"));
});
