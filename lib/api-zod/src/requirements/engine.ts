import { GetPermitRequirementsEvaluationResponse } from "../generated/api";
import { PERMIT_REQUIREMENTS, SB35_REFERENCE, type RequirementDefinition } from "./catalog";
import { applicationEvidence, projectFacts, type Fact, type RequirementEvidence, type RequirementProject } from "./facts";
import { checkJurisdiction } from "../permit-rules";

export type RequirementsEvaluation = typeof GetPermitRequirementsEvaluationResponse._output;
const disclaimer = "Prototype reference screening only. Simulated Submitted statuses do not verify files, plan components, clearances or legal eligibility. Staff must confirm current requirements and jurisdiction. Existing priority and safety reviews remain independent.";
export function requirementApplicability(rule: RequirementDefinition, facts: Record<string, Fact>): "APPLIES" | "UNKNOWN" | "DOES_NOT_APPLY" {
  const values = rule.applicable_when.all.map(key => facts[key]?.value ?? null);
  return values.includes(false) ? "DOES_NOT_APPLY" : values.includes(null) ? "UNKNOWN" : "APPLIES";
}
const normalize = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, "");
export const isSanJoseReferenceScope = (address: string) => {
  const jurisdiction = checkJurisdiction(address);
  return jurisdiction.status === "In County" && jurisdiction.city.toLowerCase() === "san jose";
};
export function matchingRequirementDocuments(rule: RequirementDefinition, project: Pick<RequirementProject, "documents">) {
  return project.documents.filter(document => rule.document_aliases.some(alias => normalize(alias) === normalize(document.label)));
}
function screening(project: RequirementProject, facts: Record<string, Fact>): RequirementsEvaluation["sb35_screening"] {
  type Criterion = RequirementsEvaluation["sb35_screening"]["criteria"][number];
  const criteria: Criterion[] = [];
  const criterion = (id: string, label: string, value: boolean | null, explanation: string, evidence: RequirementEvidence[], adverse = false) => {
    criteria.push({ id, label, status: value === null ? "UNKNOWN" : value === adverse ? "ISSUE" : "OBSERVED", explanation, evidence, source: SB35_REFERENCE });
  };
  const requested = facts.sb35Requested!.value !== false || project.affordableHousing;
  criterion("housing", "Applicant-stated housing development (two or more units)", project.housingUnits >= 2,
    "Unit count is applicant-stated; classification conflicts and the actual residential scope require staff verification.", [applicationEvidence("housingUnits", String(project.housingUnits))]);
  const countField = project.intakeAnalysis?.fields.find(field => field.key === "affordableUnits");
  const count = countField?.value === null || !countField ? NaN : Number(countField.value.replaceAll(",", ""));
  criterion("affordability", "Applicant-stated affordable/restricted units", Number.isFinite(count) ? count > 0 : null,
    "This observes only a stated count. Income levels, recorded restrictions, the applicable percentage and current legal criteria are not verified.", countField?.evidence ?? []);
  for (const [id, label, key, adverse] of [
    ["infill", "Urbanized / infill site", "urbanInfill", false],
    ["zoning", "Residential zoning / General Plan use", "residentialZoning", false],
    ["site", "Potential site exclusions", "restrictedSite", true],
    ["demolition", "Potential anti-demolition issue", "demolition", true],
  ] as const) {
    const fact = facts[key]!;
    criterion(id, label, fact.value, `${fact.explanation} Applicant text is not independent site or legal verification.`, fact.evidence, adverse);
  }
  criterion("standards", "Objective standards, residential floor-area ratio and remaining statutory criteria", null,
    "Not verified in application-only mode. Staff must review current law, zoning/design standards, tribal consultation, labor provisions and all other criteria; missing data is not a pass.", []);
  const issue = requested && criteria.some(item => item.status === "ISSUE");
  return {
    status: !requested ? "NOT_REQUESTED" : issue ? "ISSUE" : "POTENTIAL",
    message: !requested ? "No SB 35 process or affordable housing claim identified."
      : issue ? "Potential eligibility issue identified — Staff review required."
        : "Potentially eligible — Staff verification required",
    disclaimer: "This is NOT a final SB 35 eligibility decision. Potential means only preliminary applicant-stated signals; UNKNOWN criteria remain unresolved. An affordable housing claim alone does not establish an SB 35 pathway. Current law supersedes historical reference forms.",
    criteria,
  };
}

export function evaluatePermitRequirements(project: RequirementProject): RequirementsEvaluation {
  const facts = projectFacts(project);
  const sanJose = isSanJoseReferenceScope(project.projectAddress);
  const requirements = PERMIT_REQUIREMENTS.map(rule => {
    const applicability = requirementApplicability(rule, facts);
    const supporting = rule.applicable_when.all.flatMap(key => facts[key]?.evidence ?? []);
    const matched = matchingRequirementDocuments(rule, project);
    const received = matched.filter(document => document.received);
    const checks: RequirementEvidence[] = matched.map(document => ({ source: "Checklist", sourceField: document.label,
      quote: document.received ? "Submitted (simulated status)" : "Missing (simulated status)", documentName: null, page: null }));
    let status: "PASS" | "MISSING" | "REVIEW" | "NOT_APPLICABLE";
    let explanation: string;
    if (applicability === "DOES_NOT_APPLY") {
      status = "NOT_APPLICABLE";
      explanation = rule.applicable_when.all.filter(key => facts[key]?.value === false).map(key => facts[key]!.explanation).join(" ");
    } else if (!sanJose) {
      status = "REVIEW";
      explanation = "This is a San José reference rule. The address is not confirmed as San José; staff must establish local jurisdiction and requirements. No missing-document conclusion is made.";
    } else if (applicability === "UNKNOWN") {
      status = "REVIEW";
      explanation = rule.applicable_when.all.filter(key => facts[key]?.value === null).map(key => facts[key]!.explanation).join(" ");
      explanation += received.length ? " A simulated category is submitted, but applicability and satisfaction remain unverified." : " Applicability is unresolved; this is not a missing-document finding.";
    } else if (!received.length) {
      status = "MISSING";
      explanation = `${rule.applicable_when.description} The required category is not marked Submitted in the simulated checklist. No actual files were inspected.`;
      if (!matched.length) checks.push({ source: "Checklist", sourceField: rule.required_document, quote: "No matching submitted checklist category. Not found in submitted documents.", documentName: null, page: null });
    } else {
      status = "REVIEW";
      explanation = `${received.map(document => document.label).join(", ")} is marked Submitted. Without file contents, the AI cannot verify the required information, all plan components, signatures, recency or clearance; no PASS is asserted.`;
    }
    return { ...rule, applicability: !sanJose && applicability !== "DOES_NOT_APPLY" ? "UNKNOWN" as const : applicability, status, explanation, evidence: [...supporting, ...checks],
      matched_documents: received.map(document => document.label) };
  });
  return GetPermitRequirementsEvaluationResponse.parse({
    mode: "simulation-only", ruleset_version: "san-jose-reference-2026-10",
    project_category: facts.multifamily!.value ? (project.affordableHousing || facts.sb35Requested!.value === true ? "Multifamily / affordable housing or potential SB 35" : "Multifamily") : "Other / non-multifamily project",
    category_explanation: facts.multifamily!.explanation,
    jurisdiction_scope: sanJose ? "San José reference checklist; local and current requirements still require staff verification." : "Other or unconfirmed County city — San José template is reference-only.",
    disclaimer, intake_status: project.intakeAnalysis?.status ?? "not-run",
    evaluated_at: new Date().toISOString(), requirements, sb35_screening: screening(project, facts),
  });
}

/** Add only confirmed-applicable categories; preserve existing checklist entries, statuses and file metadata. */
export function extendRequirementChecklist<T extends { label: string; category: string; required: boolean; received: boolean }>(
  project: Omit<RequirementProject, "documents">, documents: T[],
): (T | { label: string; category: string; required: boolean; received: boolean })[] {
  const facts = projectFacts({ ...project, documents });
  const active = PERMIT_REQUIREMENTS.filter(rule => isSanJoseReferenceScope(project.projectAddress) && requirementApplicability(rule, facts) === "APPLIES");
  const next: (T | { label: string; category: string; required: boolean; received: boolean })[] = documents.map(document =>
    document.category.startsWith("Rules engine") ? { ...document, required: active.some(rule => rule.required_document === document.label) } : document);
  for (const rule of active) {
    if (!matchingRequirementDocuments(rule, { documents: next }).length) next.push({ label: rule.required_document, category: `Rules engine · ${rule.group}`, required: true, received: false });
  }
  return next;
}
