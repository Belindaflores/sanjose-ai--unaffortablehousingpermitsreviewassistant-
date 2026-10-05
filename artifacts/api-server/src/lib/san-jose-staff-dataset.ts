import { screenApplication, CreatePermitApplicationResponse, EVIDENCE_LABEL } from "@workspace/api-zod";
import { buildPermitTimeline } from "./permit-timeline";

/** Fictional projects inspired by City housing categories, never imported private applicants.
 * Pattern references: sanjoseca.gov Housing Data / AB 987 and housing.sanjoseca.gov/listings.
 * Received files are synthetic checklist metadata, not claims of actual uploaded plan files.
 */
export const SAN_JOSE_DATASET_PREFIX = "SJ-AH-2026-";
const projects = [
  ["Riverview Affordable Homes", "1462 North 4th Street", "95112", "Multifamily housing", "Affordable multifamily housing", 64, "Ready for Review", "Building"],
  ["Creekside Supportive Residences", "2108 Monterey Road", "95112", "Multifamily housing", "Supportive housing", 42, "Ready for Review", "Housing Review"],
  ["Garden Walk Mixed-Income Homes", "1188 South 2nd Street", "95112", "Multifamily housing", "Mixed-income housing", 36, "Ready for Review", "Planning"],
  ["Willow Affordable Rehabilitation", "684 Willow Street", "95125", "Multifamily housing", "Affordable housing rehabilitation", 48, "On Hold — Safety Review Required", "Fire Marshal"],
  ["Alum Rock Senior Affordable Homes", "1768 Alum Rock Avenue", "95116", "Senior residential care", "Senior affordable housing", 32, "Missing Required Documents", "Building"],
  ["Seven Trees Workforce Court", "3186 Senter Road", "95111", "Multifamily housing", "Workforce housing", 28, "Priority Claim Requires Verification", "Housing Review"],
  ["Southside Permanent Supportive Homes", "724 Keyes Street", "95112", "Multifamily housing", "Permanent supportive housing", 40, "Human Review Required", "Housing Review"],
  ["Blossom Affordable ADU Cottages", "612 Blossom Hill Road", "95123", "Accessory dwelling unit", "Affordable ADU or small-scale housing", 2, "Additional Agency Review", "Planning"],
  ["Eastside Density-Bonus Commons", "2282 Story Road", "95122", "Multifamily housing", "Density-bonus housing", 60, "Potential Issues Detected", "Planning"],
  ["Rose Garden Family Affordable Homes", "942 West San Carlos Street", "95126", "Multifamily housing", "Family affordable housing", 24, "Under Initial Review", "Building"],
] as const;

export function buildSanJoseStaffDataset(workspaceId: string) {
  return projects.map(([projectName, street, zip, projectType, housingCategory, housingUnits, reviewStatus, assignedDepartment], index) => {
    const id = `${SAN_JOSE_DATASET_PREFIX}${String(index + 1).padStart(3, "0")}`;
    const submittedAt = new Date(Date.UTC(2026, 8, 15 + index, 16));
    const at = "2026-09-26T16:00:00.000Z";
    const pending = reviewStatus === "Priority Claim Requires Verification";
    const verified = { status: "Verified" as const, by: "synthetic-housing-reviewer", at, note: "Synthetic demonstration: affordability documentation reviewed; not a real staff decision." };
    const documents = [
      ["Plans", "Architectural plans"], ["Engineering", "Structural plans"], ["Site", "Site plan and survey"],
      ["Energy", "Title 24 energy forms"], ["Ownership", "Owner authorization"],
      ["Priority evidence", EVIDENCE_LABEL], ["Fire / life safety", "Fire and life safety plan"],
    ].map(([category, label]) => {
      const received = !(index === 3 && category === "Fire / life safety") && !(index === 4 && category === "Energy");
      return { category: category!, label: label!, required: category !== "Fire / life safety" || housingUnits >= 20, received,
        ...(received ? { fileName: `synthetic-checklist-${index + 1}-${category!.replace(/\W+/g, "-")}.pdf`, receivedAt: at } : {}) };
    });
    const screened = screenApplication({
      id, workspaceId, ownerUserId: null, dataSource: "Synthetic" as const,
      applicantName: "Synthetic Housing Applicant", companyName: "Fictional housing sponsor", email: `project-${index + 1}@example.invalid`,
      projectName, projectAddress: `${street}, ${index % 2 ? "San José" : "San Jose"}, CA ${zip}`,
      projectType, housingCategory, housingUnits, permitType: "Building permit",
      description: `Synthetic ${housingCategory.toLowerCase()} proposal with ${housingUnits} units. Income-restricted homes and accessible community spaces; modeled on public housing patterns, not a real permit filing.`,
      affordableHousing: true, underservedCommunity: false, claimed_affordable: true, claimed_underserved: false, claimedPriorityCategories: [],
      priorityClaims: { affordable: pending ? { status: "Unverified" as const } : verified, underserved: { status: "Unverified" as const } },
      reviewDecisions: {}, reviewStatus, assignedDepartment, documents, submittedAt: submittedAt.toISOString(),
      estimatedCost: housingUnits * (index === 3 ? 160_000 : 420_000),
      notes: [], auditHistory: [{ id: `${id}-fixture`, action: "synthetic_fixture", decision: reviewStatus, reason: "Clearly disclosed fictional staff-review example, not an official City application.", workerId: "synthetic-dataset", workerName: "Synthetic dataset", at, detail: housingCategory }],
      timeline: buildPermitTimeline(reviewStatus, submittedAt, housingUnits >= 20),
    });
    return CreatePermitApplicationResponse.parse(screened);
  });
}