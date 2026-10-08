import { GetPermitRequirementsCatalogResponse } from "../generated/api";

export type RequirementDefinition = typeof GetPermitRequirementsCatalogResponse._output[number];
export const MULTIFAMILY_REFERENCE = {
  title: "City of San José — Multifamily Projects Submittal Checklist (#355)",
  url: "https://www.sanjoseca.gov/home/showpublisheddocument/25935/638572621875230000",
  section: "Sections 4–5",
};
export const SB35_REFERENCE = {
  title: "City of San José — SB 35 Streamlined Ministerial Project Application",
  url: "https://www.sanjoseca.gov/home/showpublisheddocument/74240/637584037003830000",
  section: "Application package, page 1; eligibility checklist, pages 5–6",
};
function rule(id: string, name: string, conditions: string[], when: string, section: string, aliases: string[] = [], sb35 = false): RequirementDefinition {
  return {
    requirement_id: id, requirement_name: name,
    project_types: sb35 ? ["Affordable housing / potential SB 35"] : ["Multifamily housing", "Small multifamily housing", "Mixed-use housing"],
    applicable_when: { all: [sb35 ? "sb35Requested" : "multifamily", ...conditions], description: when },
    required_document: name, document_aliases: [...new Set([name, ...aliases])],
    validation_type: "document-content",
    source: { ...(sb35 ? SB35_REFERENCE : MULTIFAMILY_REFERENCE), section },
    group: sb35 ? "Affordable housing / SB 35" : "Multifamily",
  };
}

/** Reference data, not final legal requirements. Conditional predicates are evaluated outside the UI. */
export const PERMIT_REQUIREMENTS: RequirementDefinition[] = [
  rule("MF-COVER", "Cover Sheet with project description", [], "Multifamily project requiring plan review.", "4 — Plans"),
  rule("MF-ARCH", "Architectural Plans / Site Plan / Floor Plan / Elevations", [], "Multifamily project requiring plan review; verify all plan components.", "4 — Plans", ["Architectural plans", "Site plan and survey", "Floor Plan", "Elevations"]),
  rule("MF-STRUCT", "Structural Plans and Details", ["structuralScope"], "New construction or stated structural work.", "4 — Plans", ["Structural plans"]),
  rule("MF-ELEC", "Electrical Plan", ["electricalScope"], "New construction or stated electrical work.", "4 — Plans"),
  rule("MF-MECH", "Mechanical Plan", ["mechanicalScope"], "New construction or stated mechanical work.", "4 — Plans"),
  rule("MF-PLUMB", "Plumbing Plan", ["plumbingScope"], "New construction or stated plumbing work.", "4 — Plans"),
  rule("MF-CALC", "Structural Calculations", ["structuralScope"], "New construction or stated structural work.", "4 — Calculations & design documents"),
  rule("MF-ENERGY", "Energy Calculations / Title 24 documents", ["energyScope"], "New construction or stated energy-related work.", "4 — Calculations & design documents", ["Title 24 energy forms"]),
  rule("MF-SOIL", "Soil Report", ["groundWork"], "New construction or stated foundation, excavation, grading or geotechnical work; staff confirms scope.", "4 — Calculations & design documents"),
  rule("MF-INSPECTION", "Special Inspection Form", ["specialInspection"], "New construction or explicitly identified special inspections.", "4 — Calculations & design documents"),
  rule("MF-ACCESS", "Accessibility Compliance Form", [], "Multifamily plan review; staff verifies applicable accessibility provisions.", "4 — Form #300"),
  rule("MF-APPLICATION", "Building Permit Application", [], "Multifamily plan review; the City's form #310 is distinct from this prototype record.", "4 — Form #310"),
  rule("MF-DEFERRED", "Deferred Submittal Form", ["deferredSubmittals"], "A deferred submittal is identified in the project information.", "4 — Form #319"),
  rule("MF-NEW-INSPECTION", "Special Inspection New Building Form", ["newConstruction"], "The project is identified as new construction.", "4 — Form #345"),
  rule("MF-PW", "Public Works clearances", ["publicWorks"], "Flood/geologic hazards, grading, driveway/sidewalk work or other Public Works scope is identified.", "5 — Public Works"),
  rule("MF-FIRE", "Fire Department clearances", ["fireFeatures"], "Fire sprinklers, fire alarms or hazardous storage is identified.", "5 — Fire Department", ["Fire Department review / clearance"]),
  rule("MF-ENV", "Environmental Services approvals", ["environmentalFeatures"], "Food/drinking establishment, public swimming pool or manufacturing discharge is identified.", "5 — Environmental Services / Regional Wastewater Facility"),
  rule("MF-HEALTH", "County Health Department approvals", ["healthFeatures"], "Food service or a public swimming pool is identified.", "5 — County Health Department", ["County Health Department approval plans"]),
  rule("SB35-APPLICATION", "SB 35 Streamlined Ministerial Project Application", [], "An SB 35 process is explicitly identified; an affordable claim alone does not establish this pathway.", "Application package — page 1", [], true),
  rule("SB35-TDM", "Transportation Demand Management Checklist", [], "An SB 35 process is identified; the referenced package requests the checklist even for exempt projects.", "Application package — page 1", ["TDM Checklist"], true),
  rule("SB35-DESIGN", "Citywide Design Guidelines Checklist", ["citywideDesign"], "SB 35 project outside the Downtown design-guideline area; staff verifies location.", "Application package — page 1", [], true),
  rule("SB35-STORM-EVAL", "Stormwater Evaluation Form", [], "An SB 35 process is explicitly identified.", "Application package — page 1", [], true),
  rule("SB35-STORM-LIST", "Stormwater Submittal Checklist", [], "An SB 35 process is explicitly identified.", "Application package — page 1", [], true),
  rule("SB35-LEGAL", "Legal Description", [], "An SB 35 process is explicitly identified.", "Application package — page 1", [], true),
  rule("SB35-TITLE", "Preliminary Title Report", ["newConstruction"], "An SB 35 process and new construction are identified; staff verifies report recency and referenced documents.", "Application package — page 1: new construction; report dated within six months", [], true),
  rule("SB35-PLANS", "Plan Set", [], "An SB 35 process is identified; verify every required sheet/component.", "Application package — page 1", ["Architectural plans", "Architectural Plans / Site Plan / Floor Plan / Elevations"], true),
  rule("SB35-DENSITY", "Density Bonus Application", ["densityBonus"], "A density bonus request is explicitly identified.", "Application package — page 1; project description 2b", [], true),
  rule("SB35-WAGE", "Prevailing Wage Certification", ["prevailingWage"], "Referenced package trigger: more than 10 units or stated public funding; staff confirms current labor-law applicability.", "Application package — page 1; certification — page 7", [], true),
  rule("SB35-WORKFORCE", "Skilled and Trained Workforce Certification", ["skilledWorkforce"], "Applicability is explicitly identified; income restrictions, exemptions and current thresholds require staff review.", "Application package — page 1; certification — page 8 (historical thresholds require verification)", [], true),
];
