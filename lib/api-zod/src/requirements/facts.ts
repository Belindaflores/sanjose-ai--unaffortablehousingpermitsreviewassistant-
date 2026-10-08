import { CreatePermitApplicationResponse } from "../generated/api";

type Application = typeof CreatePermitApplicationResponse._output;
export type RequirementProject = Pick<Application, "projectAddress" | "projectType" | "housingUnits" | "affordableHousing" | "description"> & {
  intakeAnalysis?: Application["intakeAnalysis"];
  documents: { label: string; received: boolean }[];
};
export type RequirementEvidence = NonNullable<Application["intakeAnalysis"]>["fields"][number]["evidence"][number];
export type Fact = { value: boolean | null; explanation: string; evidence: RequirementEvidence[] };
export function applicationEvidence(sourceField: string, quote: string): RequirementEvidence {
  return { source: "Application", sourceField, quote, documentName: null, page: null };
}
/** Literal declarations only; absence, uncertainty and contradictory statements are not affirmative facts. */
export function declaredFeature(description: string, pattern: RegExp, name: string, absent: boolean | null = null): Fact {
  const signals: boolean[] = [];
  const evidence: RequirementEvidence[] = [];
  let uncertain = false;
  for (const clause of description.split(/[.;\n]|\bbut\b/i)) {
    for (const match of clause.matchAll(new RegExp(pattern.source, "gi"))) {
      const before = clause.slice(Math.max(0, match.index! - 60), match.index);
      const after = clause.slice(match.index! + match[0].length, match.index! + match[0].length + 35);
      const negative = /\b(?:no|not|without|never)\s+(?:[\w-]+\s+){0,5}$/i.test(before) ||
        /^\s+(?:(?:is|are|will be)\s+)?(?:not|excluded|absent)\b/i.test(after);
      const maybe = clause.includes("?") ||
        /\b(?:not sure|uncertain|undecided|unknown)\b[^.!;]*$/i.test(before) ||
        /\b(?:possible|possibly|may|might|if|optional|considering|consideration)\s+(?:[\w-]+\s+){0,4}$/i.test(before);
      if (maybe) uncertain = true;
      else signals.push(!negative);
      evidence.push(applicationEvidence("description", clause.trim()));
    }
  }
  const value = uncertain || (signals.includes(true) && signals.includes(false)) ? null : signals[0] ?? absent;
  return { value, evidence,
    explanation: value === true ? `${name} is explicitly identified in applicant text.`
      : value === false ? (signals.length ? `${name} is explicitly excluded in applicant text.` : `No ${name.toLowerCase()} request or feature was identified; this conditional trigger is not activated.`)
        : `${name} applicability is unknown or ambiguous; staff must establish it before reporting a missing requirement.` };
}
export function projectFacts(project: RequirementProject): Record<string, Fact> {
  const field = (key: string) => project.intakeAnalysis?.fields.find(item => item.key === key);
  const multifamilyType = /multifamily|mixed[- ]use|apartments?|condominiums?|townhomes?/i.test(project.projectType);
  const describedMultifamily = declaredFeature(project.description, /\b(?:multifamily|apartment complex|apartment building|mixed[- ]use housing)\b/, "Multifamily project", false);
  const multifamily: Fact = {
    value: multifamilyType || project.housingUnits > 2 || describedMultifamily.value === true,
    explanation: "Category uses applicant project type, stated units and available intake/project text; it does not resolve classification conflicts.",
    evidence: [applicationEvidence("projectType", project.projectType), applicationEvidence("housingUnits", String(project.housingUnits)), ...describedMultifamily.evidence],
  };
  let newConstruction = declaredFeature(project.description, /\b(?:new construction|new building|ground[- ]up construction)\b/, "New construction");
  const construction = field("constructionType");
  if (project.intakeAnalysis?.status === "completed" && construction) {
    if (construction.value === null || construction.confidence === "LOW") newConstruction = { value: null, explanation: "AI intake did not establish construction type with sufficient confidence.", evidence: construction.evidence };
    else if (/\bnew construction|new building|ground[- ]up\b/i.test(construction.value) && newConstruction.value !== false) newConstruction = { ...newConstruction, value: newConstruction.value, evidence: construction.evidence };
    else if (/remodel|alteration|addition|renovation/i.test(construction.value)) newConstruction = {
      value: newConstruction.value === true ? null : false,
      explanation: newConstruction.value === true ? "Intake alteration/remodel classification conflicts with new-construction language; staff must resolve applicability." : "Intake identifies an alteration/remodel/addition, not a new-building project.",
      evidence: [...construction.evidence, ...newConstruction.evidence],
    };
  } else if (newConstruction.value === null && newConstruction.evidence.length === 0 && /remodel|alteration|renovation|addition/i.test(project.description + " " + project.projectType)) {
    newConstruction = { value: false, explanation: "Applicant describes an existing-building alteration/remodel/addition, not new construction.", evidence: [applicationEvidence("description", project.description)] };
  }
  function scope(pattern: RegExp, name: string): Fact {
    const stated = declaredFeature(project.description, pattern, name);
    if (newConstruction.value === true) {
      return stated.value === false ? { ...stated, value: null, explanation: `New construction conflicts with the stated exclusion of ${name.toLowerCase()}; staff review required.` }
        : { value: true, explanation: `New construction indicates ${name.toLowerCase()} scope under the reference checklist.`, evidence: [...newConstruction.evidence, ...stated.evidence] };
    }
    return stated;
  }
  const sb35Requested = declaredFeature(project.description, /\bSB[\s-]*35\b/, "SB 35 process", project.affordableHousing ? null : false);
  const publicFunding = declaredFeature(project.description, /\bpublic funding|publicly funded|public money\b/, "Public funding");
  const prevailingWage: Fact = project.housingUnits > 10 ? {
    value: true, explanation: "Stated unit count exceeds the reference form's 10-unit certification trigger; current applicability remains for staff verification.",
    evidence: [applicationEvidence("housingUnits", String(project.housingUnits))],
  } : publicFunding;
  const downtown = declaredFeature(project.description, /\bdowntown\b/, "Downtown project");
  const outsideDowntown = declaredFeature(project.description, /\boutside (?:of )?(?:the )?downtown\b/, "Outside Downtown");
  const citywideDesign: Fact = { value: outsideDowntown.value === true || downtown.value === false ? true : downtown.value === true ? false : null,
    explanation: outsideDowntown.value === true || downtown.value === false ? "Applicant states the project is outside Downtown; staff verifies the guideline area."
      : downtown.value === true ? "Applicant identifies Downtown; the reference package directs staff to Downtown Design Guidelines instead."
        : "Downtown guideline-area location is not established; do not report the Citywide checklist missing.",
    evidence: [...downtown.evidence, ...outsideDowntown.evidence] };
  return { multifamily, newConstruction, sb35Requested, prevailingWage, citywideDesign,
    structuralScope: scope(/\bstructural work|structural alterations?|structural modification|load[- ]bearing\b/, "Structural work"),
    electricalScope: scope(/\belectrical (?:work|system|plan|installation)|rewiring\b/, "Electrical work"),
    mechanicalScope: scope(/\bmechanical (?:work|system|plan)|HVAC\b/, "Mechanical work"),
    plumbingScope: scope(/\bplumbing (?:work|system|plan)|water[- ]line installation\b/, "Plumbing work"),
    energyScope: scope(/\benergy[- ]related work|Title 24|HVAC|building envelope\b/, "Energy-related work"),
    groundWork: scope(/\bgrading|excavation|foundation work|soil investigation|geotechnical\b/, "Ground/geotechnical work"),
    specialInspection: scope(/\bspecial inspections?\b/, "Special inspections"),
    deferredSubmittals: declaredFeature(project.description, /\bdeferred submittals?\b/, "Deferred submittal"),
    publicWorks: declaredFeature(project.description, /\bflood zone|geologic hazards?|grading|driveway(?: work| construction)?|sidewalk(?: work| construction)?|public works clearance\b/, "Public Works feature"),
    fireFeatures: declaredFeature(project.description, /\b(?:fire )?sprinklers?|fire alarms?|hazardous storage\b/, "Fire review feature"),
    environmentalFeatures: declaredFeature(project.description, /\bfood service|food establishment|drinking establishment|public swimming pool|manufacturing discharge\b/, "Environmental Services feature"),
    healthFeatures: declaredFeature(project.description, /\bfood service|public swimming pool\b/, "County Health feature"),
    densityBonus: declaredFeature(project.description, /\bdensity bonus\b/, "Density bonus", false),
    skilledWorkforce: declaredFeature(project.description, /\bskilled and trained workforce (?:certification|required)|requires? (?:a )?skilled and trained workforce\b/, "Skilled and trained workforce certification"),
    residentialZoning: declaredFeature(project.description, /\bresidential zoning|zoned for residential|zoning permits residential|general plan allows residential\b/, "Residential zoning"),
    urbanInfill: declaredFeature(project.description, /\burbanized infill|urban infill|urbanized area\b/, "Urbanized infill site"),
    restrictedSite: declaredFeature(project.description, /\bprotected wetlands|prime farmland|hazardous waste site|FEMA floodway\b/, "Potential restricted site"),
    demolition: declaredFeature(project.description, /\bdemolition of (?:deed[- ]restricted|rent[- ]controlled|historic|tenant[- ]occupied) housing|demolish (?:deed[- ]restricted|rent[- ]controlled|historic|tenant[- ]occupied) housing\b/, "Potentially restricted demolition"),
  };
}
