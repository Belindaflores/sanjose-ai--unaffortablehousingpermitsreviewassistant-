import { checkJurisdiction, CreatePermitApplicationResponse } from "@workspace/api-zod";

type Application = typeof CreatePermitApplicationResponse._output;
type Analysis = NonNullable<Application["intakeAnalysis"]>;
type PermitRequirement = NonNullable<Analysis["requirements"]>[number];
type PermitDocumentVerification = NonNullable<Analysis["documentVerifications"]>[number];
type SB35Screening = NonNullable<Analysis["sb35Screening"]>;
type SB35Criterion = SB35Screening["criteria"][number];
type RequirementEvidence = PermitRequirement["evidence"][number];
type RequirementSource = PermitRequirement["source"];
type Signal = "always" | "new-construction" | "construction-unspecified" | "deferred-submittal" |
  "affordable-or-sb35" | "sb35-requested" | "density-bonus-requested" |
  "public-works-signal" | "fire-feature-signal" | "food-or-pool-signal" |
  "environmental-services-signal" | "stormwater-project-signal" | "stormwater-trigger" |
  "wage-review" | "workforce-review";
type Rule = {
  id: string;
  name: string;
  requiredDocument: string;
  labels: string[];
  condition: Signal;
  applicableWhen: string;
  section: string;
  source: RequirementSource;
  validationType: PermitRequirement["validationType"];
};
type Facts = {
  text: string;
  isMultifamily: boolean;
  cityScope: "san-jose" | "other-city" | "unknown";
  newConstruction: boolean;
  constructionSpecified: boolean;
  deferred: boolean;
  affordableOrSb35: boolean;
  sb35Requested: boolean;
  densityBonusRequested: boolean;
  publicWorksSignal: boolean;
  fireFeatureSignal: boolean;
  foodOrPoolSignal: boolean;
  environmentalServicesSignal: boolean;
  stormwaterProjectSignal: boolean;
  stormwaterTrigger: boolean;
  stormwaterTriggerUnknown: boolean;
};

const checklistUrl = "https://www.sanjoseca.gov/home/showpublisheddocument/25935/638572621875230000";
const buildingFormsUrl = "https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement/building-division/bulletins-forms";
const planningApplicationsUrl = "https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement/planning-division/start-a-new-project-or-use/applications-and-appointments";
const stormwaterUrl = "https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement/planning-division/start-a-new-project-or-use/stormwater-management-measures";
const ministerialUrl = "https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement/planning-division/start-a-new-project-or-use/applications-and-appointments/housing-ministerial-approvals";
const tdmUrl = "https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement/planning-division/ordinances-proposed-updates/parking-policy-evaluation";
const coreSource: RequirementSource = {
  title: "City of San José Multifamily Projects Submittal Checklist",
  reference: "Form 355, Sections 4–5: submittal documents and project-specific clearances",
  url: checklistUrl,
};
const affordableSource: RequirementSource = {
  title: "City of San José Planning Applications and Appointments",
  reference: "Affordable-housing applications, checklist resources, and application-specific submissions",
  url: planningApplicationsUrl,
};
const stormwaterSource: RequirementSource = {
  title: "City of San José Stormwater Management Measures",
  reference: "Required forms for regulated projects; project-specific applicability must be determined by staff",
  url: stormwaterUrl,
};
const sb35Source: RequirementSource = {
  title: "City of San José Housing Ministerial Approvals",
  reference: "SB 35 overview, application steps, and requirements that need agency verification",
  url: ministerialUrl,
};
const tdmSource: RequirementSource = {
  title: "City of San José Parking and Transportation Demand Management",
  reference: "Transportation Demand Management checklist and exemptions; see the current form and project-specific path",
  url: tdmUrl,
};
const permitSource = (title: string, reference: string, url: string): RequirementSource => ({ title, reference, url });

const rules: Rule[] = [
  { id: "mf-cover-sheet", name: "Cover sheet with project description", requiredDocument: "Cover Sheet", labels: ["Cover sheet with project description"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Plans", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-plan-set", name: "Architectural and site plan set", requiredDocument: "Architectural plans, site plan, floor plans, and elevations", labels: ["Architectural plans", "Site plan and survey"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Plans", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-structural-plans", name: "Structural plans and details", requiredDocument: "Structural Plans", labels: ["Structural plans"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Plans", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-electrical-plan", name: "Electrical plan", requiredDocument: "Electrical Plan", labels: ["Electrical plan"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Plans", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-mechanical-plan", name: "Mechanical plan", requiredDocument: "Mechanical Plan", labels: ["Mechanical plan"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Plans", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-plumbing-plan", name: "Plumbing plan", requiredDocument: "Plumbing Plan", labels: ["Plumbing plan"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Plans", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-structural-calculations", name: "Structural calculations and details", requiredDocument: "Structural Calculations", labels: ["Structural calculations"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Calculations and design documents", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-energy-title24", name: "Energy calculations and Title 24 energy documents", requiredDocument: "Title 24 energy forms", labels: ["Title 24 energy forms"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Calculations and design documents", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-soil-report", name: "Soil report", requiredDocument: "Soil Report", labels: ["Soil report"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Calculations and design documents", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-special-inspection-form", name: "Special Inspection Form", requiredDocument: "Special Inspection Form", labels: ["Special Inspection Form"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Calculations and design documents", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-accessibility", name: "Accessibility Compliance Form", requiredDocument: "Accessibility Compliance Form", labels: ["Accessibility compliance form"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Calculations and design documents", source: permitSource("City of San José Building Forms", "Form 300 — Accessibility Compliance Form", "https://www.sanjoseca.gov/home/showpublisheddocument/25903/639184308279530000"), validationType: "simulated-checklist" },
  { id: "mf-building-application", name: "Building Permit Application", requiredDocument: "Building Permit Application", labels: ["Building permit application"], condition: "always", applicableWhen: "San José multifamily checklist scope", section: "Section 4 — Calculations and design documents", source: permitSource("City of San José Building Forms", "Form 310 — Building Permit Application", "https://www.sanjoseca.gov/home/showpublisheddocument/25915/638350368936670000"), validationType: "simulated-checklist" },
  { id: "mf-deferred-submittal", name: "Deferred Submittal Form", requiredDocument: "Deferred Submittal Form", labels: ["Deferred submittal form"], condition: "deferred-submittal", applicableWhen: "A deferred submittal is identified in the application; otherwise this conditional item is not treated as missing.", section: "Section 4 — Calculations and design documents", source: permitSource("City of San José Building Forms", "Form 319 — Deferred Submittal Form", "https://www.sanjoseca.gov/home/showpublisheddocument/25923/637443387263470000"), validationType: "simulated-checklist" },
  { id: "mf-special-inspection-new-building", name: "Special Inspection New Building Form", requiredDocument: "Special Inspection New Building Form", labels: ["Special inspection new building form"], condition: "always", applicableWhen: "San José multifamily checklist scope; staff confirms any project-specific exceptions.", section: "Section 4 — Calculations and design documents", source: coreSource, validationType: "simulated-checklist" },
  { id: "mf-public-works", name: "Public Works clearances", requiredDocument: "Public Works clearance", labels: ["Public Works clearance"], condition: "public-works-signal", applicableWhen: "Application text identifies grading, flood/geologic hazards, driveway or sidewalk work, or off-site/public infrastructure; otherwise staff must confirm applicability.", section: "Section 5 — Approvals or clearances", source: coreSource, validationType: "conditional-referral" },
  { id: "mf-fire-clearance", name: "Fire Department clearance", requiredDocument: "Fire Department clearance", labels: ["Fire Department clearance"], condition: "fire-feature-signal", applicableWhen: "Application text mentions fire sprinklers, fire alarms, or hazardous storage.", section: "Section 5 — Approvals or clearances", source: coreSource, validationType: "conditional-referral" },
  { id: "mf-environmental-clearance", name: "Environmental Services clearance", requiredDocument: "Environmental Services approval", labels: ["Environmental Services approval"], condition: "environmental-services-signal", applicableWhen: "Application text mentions a food/drinking establishment, public pool, or manufacturing discharge; staff must confirm agency routing.", section: "Section 5 — Approvals or clearances", source: coreSource, validationType: "conditional-referral" },
  { id: "mf-county-health", name: "County Health Department approval", requiredDocument: "County Health Department approval", labels: ["County Health approval"], condition: "food-or-pool-signal", applicableWhen: "Application text mentions food service or a public swimming pool.", section: "Section 4 — Forms; Section 5 — Approvals or clearances", source: coreSource, validationType: "conditional-referral" },
  { id: "mf-stormwater-evaluation", name: "Stormwater Evaluation Form", requiredDocument: "Stormwater Evaluation Form", labels: ["Stormwater Evaluation Form"], condition: "stormwater-project-signal", applicableWhen: "New development or redevelopment is identified; regulated-project thresholds and applicability are not established from this intake.", section: "Stormwater application requirements", source: stormwaterSource, validationType: "conditional-referral" },
  { id: "mf-stormwater-checklist", name: "Stormwater Submittal Checklist", requiredDocument: "Stormwater Submittal Checklist", labels: ["Stormwater Submittal Checklist"], condition: "stormwater-trigger", applicableWhen: "Regulated-project applicability is explicitly stated or a stated impervious-surface area meets the cited intake trigger; otherwise staff must determine scope.", section: "Stormwater required forms — if applicable", source: stormwaterSource, validationType: "conditional-referral" },
  { id: "mf-preliminary-title-report", name: "Preliminary Title Report", requiredDocument: "Preliminary Title Report", labels: ["Preliminary title report"], condition: "new-construction", applicableWhen: "New construction is explicitly identified. Whether a report is required and the accepted date window require staff confirmation.", section: "Project-specific intake rule; see notes", source: permitSource("City of San José Planning Applications", "Title Report Example is a planning resource; this prototype does not establish a universal requirement or report-age window.", "https://www.sanjoseca.gov/home/showpublisheddocument/38974/637012989884630000"), validationType: "conditional-referral" },
  { id: "aff-sb35-application", name: "SB 35 Streamlined Ministerial Project Application", requiredDocument: "SB 35 application", labels: ["SB 35 application"], condition: "sb35-requested", applicableWhen: "Applicant text identifies SB 35; staff must determine whether this is the appropriate process and whether additional filings apply.", section: "Affordable housing applications", source: permitSource("City of San José Planning Applications", "SB 35 Streamlined Ministerial Project Application", "https://www.sanjoseca.gov/home/showpublisheddocument/74240/638901748786770000"), validationType: "applicant-statement" },
  { id: "aff-tdm-checklist", name: "Transportation Demand Management (TDM) Checklist", requiredDocument: "TDM Checklist", labels: ["Transportation Demand Management (TDM) checklist"], condition: "affordable-or-sb35", applicableWhen: "Applicant identifies affordable housing or an SB 35 request; the City TDM form contains project-specific exemptions and required sections.", section: "TDM development application process", source: tdmSource, validationType: "conditional-referral" },
  { id: "aff-design-guidelines", name: "Citywide Design Guidelines Checklist", requiredDocument: "Citywide Design Guidelines Checklist", labels: ["Citywide Design Guidelines checklist"], condition: "affordable-or-sb35", applicableWhen: "Applicant identifies affordable housing or an SB 35 request; the City lists this checklist as submit-if-required, so staff must confirm applicability.", section: "Development-Use-Zoning applications and worksheets", source: permitSource("City of San José Planning Applications", "Design Guidelines Checklist — Citywide; submit if required with Development Application", "https://www.sanjoseca.gov/home/showpublisheddocument/96037/639184342173070000"), validationType: "conditional-referral" },
  { id: "aff-legal-description", name: "Legal Description", requiredDocument: "Legal Description", labels: ["Legal description"], condition: "affordable-or-sb35", applicableWhen: "Applicant identifies affordable housing or an SB 35 request; the City publishes a legal-description example, not a determination for this individual project.", section: "Planning application resources", source: permitSource("City of San José Planning Applications", "Legal Description Example", "https://www.sanjoseca.gov/home/showpublisheddocument/38970/639184346035630000"), validationType: "conditional-referral" },
  { id: "aff-density-bonus", name: "Density Bonus Application", requiredDocument: "Density Bonus Application", labels: ["Density Bonus application"], condition: "density-bonus-requested", applicableWhen: "Applicant text explicitly identifies a density-bonus request.", section: "Affordable housing project applications", source: permitSource("City of San José Planning Applications", "Density Bonus Application", "https://www.sanjoseca.gov/home/showpublisheddocument/74238/638525122819970000"), validationType: "applicant-statement" },
  { id: "sb35-prevailing-wage", name: "Prevailing Wage documentation", requiredDocument: "Prevailing Wage Certification", labels: ["Prevailing Wage certification"], condition: "wage-review", applicableWhen: "Applicant identifies SB 35. Public-work status and project-specific exemptions are not verified here, so this item is sent to staff review rather than being marked missing.", section: "SB 35 — additional requirements", source: sb35Source, validationType: "conditional-referral" },
  { id: "sb35-skilled-workforce", name: "Skilled and Trained Workforce documentation", requiredDocument: "Skilled and Trained Workforce Certification", labels: ["Skilled and Trained Workforce certification"], condition: "workforce-review", applicableWhen: "Applicant identifies SB 35. Unit-count, affordable-housing, and public-work conditions need staff verification before classifying this item.", section: "SB 35 — additional requirements", source: sb35Source, validationType: "conditional-referral" },
];

function getFacts(application: Application): Facts {
  const text = `${application.description}\n${application.permitType}`;
  const constructionMatch = text.match(/\bnew(?:ly)?[-\s]+construct(?:ion|ed)?\b|\bground[-\s]+up\b|\bnew build\b|\baddition\b|\bremodel(?:ing)?\b|\balteration\b|\bredevelop(?:ment|ing)?\b/i);
  const newConstruction = /\bnew(?:ly)?[-\s]+construct(?:ion|ed)?\b|\bground[-\s]+up\b|\bnew build\b/i.test(text);
  const jurisdiction = checkJurisdiction(application.projectAddress);
  const city = jurisdiction.city.toLowerCase();
  const sb35Requested = /\bSB\s*[-]?\s*35\b|\bstreamlined ministerial\b/i.test(text);
  const affordable = application.affordableHousing || /\baffordable housing\b|\bincome[- ]restricted\b|\bdeed[- ]restricted\b/i.test(text);
  const densityBonusRequested = /\bdensity bonus\b/i.test(text);
  const publicWorksSignal = /\bflood zone\b|\bgeologic(?:al)? hazard\b|\bgrading\b|\bdriveway\b|\bsidewalk\b|\bpublic works\b|\broad(?:way)? work\b|\bstreet work\b|\boff[- ]site (?:infrastructure|utility|improvement)\b|\bsewer extension\b|\bpublic infrastructure\b/i.test(text);
  const fireFeatureSignal = /\bfire sprinklers?\b|\bsprinkler system\b|\bfire alarms?\b|\bhazardous storage\b/i.test(text);
  const foodOrPoolSignal = /\bfood service\b|\bfood[- ]service\b|\brestaurant\b|\bdrinking establishment\b|\bpublic swimming pool\b|\bpublic pool\b/i.test(text);
  const environmentalServicesSignal = /\bfood service\b|\brestaurant\b|\bdrinking establishment\b|\bpublic swimming pool\b|\bpublic pool\b|\bmanufacturing discharge\b/i.test(text);
  const stormwaterProjectSignal = /\bnew construction\b|\bnew development\b|\bredevelopment\b|\bstormwater\b|\bimpervious surface\b/i.test(text);
  const stormArea = text.match(/(?:\bregulated project\b|\bC\.3\b)|(\d[\d,]*)\s*(?:square feet|sq\.?\s*ft\.?|sf)\s*(?:of\s+)?(?:new\s+)?impervious(?:\s+surface)?/i);
  const statedImperviousArea = stormArea?.[1] ? Number(stormArea[1].replaceAll(",", "")) : null;
  const stormwaterTrigger = /\bregulated project\b|\bC\.3\b/i.test(text) ||
    (statedImperviousArea !== null && Number.isFinite(statedImperviousArea) && statedImperviousArea >= 5000);
  const stormwaterTriggerUnknown = stormwaterProjectSignal && statedImperviousArea === null && !/\bnot (?:a )?regulated project\b/i.test(text);
  return {
    text,
    isMultifamily: /multi[- ]?family|multifamily|apartments?|condominiums?|townhomes?|sro\b/i.test(`${application.projectType} ${text}`),
    cityScope: jurisdiction.status === "Outside County"
      ? "other-city"
      : jurisdiction.status === "In County" && city === "san jose"
        ? "san-jose"
        : jurisdiction.status === "In County"
          ? "other-city"
          : "unknown",
    newConstruction,
    constructionSpecified: Boolean(constructionMatch),
    deferred: /\bdeferred submittal\b|\bdeferred submission\b|\bdeferred permit\b/i.test(text),
    affordableOrSb35: affordable || sb35Requested,
    sb35Requested,
    densityBonusRequested,
    publicWorksSignal,
    fireFeatureSignal,
    foodOrPoolSignal,
    environmentalServicesSignal,
    stormwaterProjectSignal,
    stormwaterTrigger,
    stormwaterTriggerUnknown,
  };
}

function evidence(source: RequirementEvidence["source"], description: string, quote: string): RequirementEvidence {
  return { source, description, quote, documentName: null, page: null };
}

function applicable(rule: Rule, facts: Facts): { state: PermitRequirement["applicability"]; explanation: string } {
  if (!facts.isMultifamily) return { state: "not_applicable", explanation: "This initial rule set is scoped to multifamily housing; the submitted project type does not identify a multifamily project." };
  if (facts.cityScope === "other-city") return { state: "not_applicable", explanation: "The application names a city other than San José. San José checklist rules are not applied to that location; confirm the correct reviewing jurisdiction." };
  if (facts.cityScope === "unknown") return { state: "needs_review", explanation: "The address text does not establish a San José project location. Confirm which jurisdiction's requirements apply; no document is labeled missing." };
  switch (rule.condition) {
    case "always": return { state: "applicable", explanation: "Included in the City of San José multifamily submittal checklist for this prototype screen." };
    case "new-construction":
      if (facts.newConstruction) return { state: "applicable", explanation: "New construction is explicitly described; staff must confirm whether a preliminary title report and an applicable date window are required." };
      if (facts.constructionSpecified) return { state: "not_applicable", explanation: "The application describes an alteration, addition, or redevelopment rather than new construction; this prototype does not flag a new-construction title report as missing." };
      return { state: "needs_review", explanation: "Construction scope is not stated clearly enough to decide whether this conditional title-report item applies; not marked missing." };
    case "construction-unspecified":
      return { state: "needs_review", explanation: "The prototype's title-report screening requires staff to confirm project scope and any applicable report-age window; it is never treated as verified by a checklist status." };
    case "deferred-submittal":
      return facts.deferred
        ? { state: "applicable", explanation: "A deferred submittal is explicitly mentioned in the application." }
        : { state: "not_applicable", explanation: "No deferred submittal is identified in the application; this conditional form is not marked missing." };
    case "affordable-or-sb35":
      return facts.affordableOrSb35
        ? { state: "applicable", explanation: "Affordable housing is an applicant-reported claim or SB 35 appears in the application; staff must verify the appropriate process." }
        : { state: "not_applicable", explanation: "The application does not identify affordable housing or SB 35; these conditional items are not marked missing." };
    case "sb35-requested":
      return facts.sb35Requested
        ? { state: "applicable", explanation: "SB 35 is explicitly named in the application; staff must verify the requested process and any required filings." }
        : { state: "not_applicable", explanation: "The application does not identify an SB 35 request; no SB 35 application is marked missing." };
    case "density-bonus-requested":
      return facts.densityBonusRequested
        ? { state: "applicable", explanation: "A density-bonus request is explicitly named in the application." }
        : { state: "not_applicable", explanation: "The application does not identify a density-bonus request; no density-bonus application is marked missing." };
    case "public-works-signal":
      return facts.publicWorksSignal
        ? { state: "applicable", explanation: "Project text mentions an item that can require Public Works coordination; staff must confirm the relevant clearance." }
        : { state: "needs_review", explanation: "The application does not establish whether project-specific Public Works triggers apply. Staff must confirm; no clearance is marked missing." };
    case "fire-feature-signal":
      return facts.fireFeatureSignal
        ? { state: "applicable", explanation: "Project text mentions sprinklers, fire alarms, or hazardous storage; staff must confirm Fire Prevention clearance." }
        : { state: "needs_review", explanation: "Fire sprinkler, alarm, and hazardous-storage details are not established by this intake. Confirm whether Fire Prevention clearance applies; not marked missing." };
    case "food-or-pool-signal":
      return facts.foodOrPoolSignal
        ? { state: "applicable", explanation: "Project text mentions food service or a public pool, which the City checklist identifies for County Health coordination." }
        : { state: "needs_review", explanation: "The application does not establish whether food service or a public swimming pool is part of this project. Staff must confirm; not marked missing." };
    case "environmental-services-signal":
      return facts.environmentalServicesSignal
        ? { state: "applicable", explanation: "Project text mentions a use listed for potential Regional Wastewater Facility coordination; staff must confirm Environmental Services review." }
        : { state: "needs_review", explanation: "Food/drinking establishment, public-pool, and manufacturing-discharge details are not established. Confirm Environmental Services applicability; not marked missing." };
    case "stormwater-project-signal":
      return facts.stormwaterTrigger
        ? { state: "applicable", explanation: "The application states a regulated-project or stormwater indicator; staff must verify the current forms and project-specific applicability." }
        : facts.stormwaterTriggerUnknown
          ? { state: "needs_review", explanation: "New development or redevelopment appears in the description, but the intake does not establish impervious area or regulated-project status. Staff must determine applicability; not marked missing." }
          : { state: "not_applicable", explanation: "No stormwater trigger is established by the submitted description. This is not an engineering determination and does not rule out a project-specific trigger." };
    case "stormwater-trigger":
      return facts.stormwaterTrigger
        ? { state: "applicable", explanation: "A stormwater regulated-project indicator appears in the application; staff must determine whether this checklist applies." }
        : { state: "needs_review", explanation: "This form is conditional. The intake does not establish regulated-project applicability; staff must confirm and it is not marked missing." };
    case "wage-review":
    case "workforce-review":
      return facts.sb35Requested
        ? { state: "needs_review", explanation: "SB 35 is identified, but project-specific wage/workforce conditions and exemptions are not assessed. Staff must determine applicability; this is not marked missing." }
        : { state: "not_applicable", explanation: "No SB 35 request is identified, so this SB 35-specific conditional item is not marked missing." };
  }
}

function checklistState(application: Application, labels: string[]): { status: PermitRequirement["documentChecklistStatus"]; submittedLabel: string | null } {
  const normalized = new Set(labels.map(label => label.toLowerCase()));
  const matching = application.documents.filter(document => normalized.has(document.label.toLowerCase()));
  if (!matching.length) return { status: "unavailable", submittedLabel: null };
  const submitted = matching.find(document => document.received);
  if (submitted) return { status: "submitted", submittedLabel: submitted.label };
  return { status: "missing", submittedLabel: null };
}

function resultStatus(applicabilityState: PermitRequirement["applicability"], checklist: PermitRequirement["documentChecklistStatus"]): PermitRequirement["status"] {
  if (applicabilityState === "not_applicable") return "NOT_APPLICABLE";
  if (applicabilityState === "needs_review") return "REVIEW";
  if (checklist === "missing") return "MISSING";
  return "REVIEW";
}

export function evaluatePermitRequirements(application: Application): PermitRequirement[] {
  const facts = getFacts(application);
  return rules.map(rule => {
    const applicability = applicable(rule, facts);
    const document = checklistState(application, rule.labels);
    const status = resultStatus(applicability.state, document.status);
    const ev: RequirementEvidence[] = [
      evidence("Application", "Project type selected by applicant", application.projectType || "Not stated"),
      ...(application.projectAddress
        ? [evidence("Application", "Address text entered by applicant; not an official jurisdiction determination", application.projectAddress)]
        : []),
    ];
    const triggerPatterns: Partial<Record<Signal, RegExp>> = {
      "new-construction": /\bnew(?:ly)?[-\s]+construct(?:ion|ed)?\b|\bground[-\s]+up\b|\bnew build\b/i,
      "construction-unspecified": /\baddition\b|\bremodel(?:ing)?\b|\balteration\b|\bredevelop(?:ment|ing)?\b/i,
      "deferred-submittal": /\bdeferred submittal\b|\bdeferred submission\b|\bdeferred permit\b/i,
      "sb35-requested": /\bSB\s*[-]?\s*35\b|\bstreamlined ministerial\b/i,
      "density-bonus-requested": /\bdensity bonus\b/i,
      "public-works-signal": /\bflood zone\b|\bgeologic(?:al)? hazard\b|\bgrading\b|\bdriveway\b|\bsidewalk\b|\bpublic works\b|\broad(?:way)? work\b|\bstreet work\b|\boff[- ]site (?:infrastructure|utility|improvement)\b|\bsewer extension\b|\bpublic infrastructure\b/i,
      "fire-feature-signal": /\bfire sprinklers?\b|\bsprinkler system\b|\bfire alarms?\b|\bhazardous storage\b/i,
      "food-or-pool-signal": /\bfood service\b|\bfood[- ]service\b|\brestaurant\b|\bdrinking establishment\b|\bpublic swimming pool\b|\bpublic pool\b/i,
      "environmental-services-signal": /\bfood service\b|\brestaurant\b|\bdrinking establishment\b|\bpublic swimming pool\b|\bpublic pool\b|\bmanufacturing discharge\b/i,
      "stormwater-project-signal": /\bnew construction\b|\bnew development\b|\bredevelopment\b|\bstormwater\b|\bimpervious surface\b/i,
      "stormwater-trigger": /\bregulated project\b|\bC\.3\b|\d[\d,]*\s*(?:square feet|sq\.?\s*ft\.?|sf)\s*(?:of\s+)?(?:new\s+)?impervious(?:\s+surface)?/i,
      "wage-review": /\bSB\s*[-]?\s*35\b|\bstreamlined ministerial\b/i,
      "workforce-review": /\bSB\s*[-]?\s*35\b|\bstreamlined ministerial\b/i,
    };
    if (rule.condition === "affordable-or-sb35" && application.affordableHousing) {
      ev.push(evidence("Application", "Applicant-provided affordable housing checkbox; claim is not verified", "true"));
    } else {
      const triggerQuote = triggerPatterns[rule.condition]?.exec(facts.text)?.[0];
      if (triggerQuote) ev.push(evidence("Application", "Exact phrase from applicant description or permit type; staff verification required", triggerQuote));
    }
    if (document.status !== "unavailable") {
      ev.push(evidence("Checklist", "Simulated document-status checklist only; no file, page, or document content was read",
        `${document.submittedLabel ?? rule.labels[0]}: ${document.status === "submitted" ? "Marked submitted (simulated)" : "Marked missing (simulated)"}`));
    }
    const explanation = status === "MISSING"
      ? `${applicability.explanation} Checklist status is Missing; this indicates no simulated submission for this applicable category, not a document-content review.`
      : status === "REVIEW" && document.status === "submitted"
        ? `${applicability.explanation} Checklist status is Submitted (simulated), but document contents, pages, and project match were not inspected.`
        : status === "REVIEW" && document.status === "unavailable" && applicability.state === "applicable"
          ? `${applicability.explanation} No status for this document category was saved, so it is not labeled missing.`
          : status === "NOT_APPLICABLE"
            ? applicability.explanation
            : applicability.explanation;
    return {
      requirementId: rule.id,
      requirementName: rule.name,
      projectTypes: ["Multifamily housing", "Small multifamily housing"],
      applicableWhen: rule.applicableWhen,
      requiredDocument: rule.requiredDocument,
      validationType: rule.validationType,
      applicability: applicability.state,
      status,
      explanation,
      documentChecklistStatus: document.status,
      evidence: ev,
      source: { ...rule.source, reference: `${rule.source.reference}; ${rule.section}` },
      recommendation: status === "MISSING"
        ? "Staff review and follow-up required; this is a simulated checklist signal, not a legal completeness decision."
        : status === "REVIEW"
          ? "Staff review required to confirm scope and inspect actual supporting materials."
          : "No action from this prototype rule; confirm jurisdiction and project-specific requirements with staff.",
    };
  });
}

function verificationNeeds(label: string): string[] {
  const normalized = label.toLowerCase();
  const needs = ["Document contents and required sections", "Readability and completeness", "Project-address/APN match"];
  if (normalized.includes("title")) needs.push("Report date and any applicable date window");
  if (/plan|sheet|structural|architectural|site/i.test(normalized)) needs.push("Sheet types, page numbers, and detected components");
  if (normalized.includes("stormwater")) needs.push("Address/APN, required responses, and blank or unreadable fields");
  if (normalized.includes("tdm")) needs.push("Required TDM sections and blank or unreadable fields");
  return needs;
}

export function buildDocumentVerifications(application: Application): PermitDocumentVerification[] {
  return application.documents.filter(document => document.received).map(document => ({
    documentLabel: document.label,
    checklistStatus: "submitted",
    status: "REVIEW",
    detected: [],
    couldNotVerify: verificationNeeds(document.label),
    projectMatch: "Not assessed",
    projectMatchNotes: ["No uploaded file or document text was available; address and APN were not compared."],
    aiConfidence: null,
    explanation: "Checklist status is marked Submitted in simulation-only mode. No file contents or pages were inspected; no components or fields have been detected.",
    source: permitSource("Permit Portal simulated checklist", "Applicant-selected document-category status only; it is not file evidence.", buildingFormsUrl),
    recommendation: "Staff review required. This prototype has no uploaded file for staff to open.",
  }));
}

function screeningEvidence(name: string, value: string): RequirementEvidence[] {
  return [evidence("Application", name, value)];
}

function criterion(name: string, observed: boolean, explanation: string, evidenceItems: RequirementEvidence[] = []): SB35Criterion {
  return { name, observation: observed ? "OBSERVED" : "NOT_STATED", explanation, evidence: evidenceItems };
}

export function buildSB35Screening(application: Application): SB35Screening {
  const facts = getFacts(application);
  const affordableClaim = application.affordableHousing || /\baffordable housing\b|\bincome[- ]restricted\b|\bdeed[- ]restricted\b/i.test(facts.text);
  const sb35Quote = facts.text.match(/\bSB\s*[-]?\s*35\b|\bstreamlined ministerial\b/i)?.[0];
  const candidate = facts.isMultifamily && (facts.sb35Requested || affordableClaim);
  const criteria = [
    criterion("Applicant identifies SB 35 or a streamlined ministerial process", facts.sb35Requested,
      facts.sb35Requested ? "The application names a process; this does not establish that SB 35 is the appropriate or available pathway." : "No SB 35 process is stated in the application.",
      sb35Quote ? screeningEvidence("Project description", sb35Quote) : []),
    criterion("Applicant identifies affordable housing", affordableClaim,
      affordableClaim ? "Applicant-reported claim only; affordability restrictions were not verified." : "No affordable-housing claim was identified.",
      application.affordableHousing
        ? screeningEvidence("Affordable housing checkbox", String(application.affordableHousing))
        : affordableClaim ? screeningEvidence("Project description", facts.text.match(/\baffordable housing\b|\bincome[- ]restricted\b|\bdeed[- ]restricted\b/i)?.[0] ?? "") : []),
    criterion("Project type as entered", facts.isMultifamily,
      facts.isMultifamily ? `Application identifies "${application.projectType}" or multifamily housing in its description; this is not a zoning or legal-use determination.` : "Application does not identify multifamily housing.",
      screeningEvidence("Project type", application.projectType || "Not stated")),
    criterion("San José location text", facts.cityScope === "san-jose",
      facts.cityScope === "san-jose" ? "Applicant address text names San José. City-boundary and permitting-jurisdiction status are not verified." : "A San José jurisdiction has not been established from the entered address; an address is not a jurisdiction determination.",
      application.projectAddress ? screeningEvidence("Project address", application.projectAddress) : []),
    criterion("Applicant states new construction", facts.newConstruction,
      facts.newConstruction ? "New construction is stated in the project description; no SB 35 construction criterion is evaluated here." : "New construction is not stated in the application.",
      facts.newConstruction ? screeningEvidence("Project description", facts.text.match(/\bnew(?:ly)?[-\s]+construct(?:ion|ed)?\b|\bground[-\s]+up\b|\bnew build\b/i)?.[0] ?? "") : []),
  ];
  const screeningMessage: SB35Screening["screeningMessage"] = candidate
    ? "Potentially eligible — Staff verification required"
    : facts.isMultifamily
      ? "Potential eligibility issue identified — Staff review required"
      : "No potential SB 35 screening triggered — Staff review required";
  const explanation = candidate
    ? "This is a preliminary intake flag based only on applicant statements and project type. It is not an SB 35 eligibility finding; all required City, state, site, affordability, workforce, wage, and document conditions need staff verification."
    : facts.isMultifamily
      ? "No affordable-housing claim or SB 35 request was identified in the application. That information gap is not a finding of ineligibility; staff must determine whether any streamlined-housing pathway is relevant."
      : "This initial SB 35 screen is scoped to multifamily intake; no eligibility outcome is generated for this project type.";
  return {
    screeningMessage,
    applicantIdentifiesAffordableHousing: affordableClaim,
    criteria,
    explanation,
    disclaimer: "AI performs preliminary intake and consistency checks only. This is not a legal eligibility determination. It does not establish compliance with San José building, zoning, fire, accessibility, engineering, environmental, or other regulatory requirements; staff must make those determinations.",
    source: sb35Source,
  };
}
