import { createHash } from "node:crypto";
import { CreatePermitApplicationResponse, checkJurisdiction, screenApplication, type RuleConfig } from "@workspace/api-zod";
import type { CountyPublicRecord } from "@workspace/db";
import { buildPermitTimeline } from "./permit-timeline";

export const APPLICANT_ADU_IDS = ["2024-089733-RS", "2024-089749-RS"] as const;
export type SeedOwner = { id: string; email: string };

/** Stable identifiers only; this hash is not an authorization mechanism. */
export function applicantAduId(ownerId: string, sourceId: string) {
  const hash = createHash("md5").update(`${ownerId}:${sourceId}`).digest("hex");
  return `SCC-${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

export function validateAduSources(sources: CountyPublicRecord[]) {
  const ordered = APPLICANT_ADU_IDS.map(id => sources.find(source => source.sourceRecordId === id));
  if (ordered.some(source => !source)) throw new Error("Both specified ADU permits must be present before seeding.");
  const records = ordered as CountyPublicRecord[];
  for (const source of records) {
    const details = source.housingDetails;
    if (!source.businessName?.trim() || !source.siteLocation?.trim() ||
        !details?.officialApplicant?.trim() || !details.workDescription?.trim() ||
        !/ADU|accessory dwelling/i.test(details.projectType) ||
        details.dwellingUnits !== 1 || checkJurisdiction(source.siteLocation).status !== "In County") {
      throw new Error(`Incomplete or inconsistent ADU permit: ${source.sourceRecordId}`);
    }
  }
  const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase();
  if (normalize(records[0]!.housingDetails!.officialApplicant!) !== normalize(records[1]!.housingDetails!.officialApplicant!)) {
    throw new Error("The ADU permits must name the same official applicant.");
  }
  return records;
}

export function buildApplicantAdu(source: CountyPublicRecord, owner: SeedOwner, config: RuleConfig, now = new Date()) {
  const details = source.housingDetails!;
  const screened = screenApplication({
    id: applicantAduId(owner.id, source.sourceRecordId),
    ownerUserId: owner.id,
    applicantName: details.officialApplicant!,
    companyName: details.officialApplicant!,
    email: owner.email,
    projectName: source.businessName!,
    projectAddress: source.siteLocation!,
    permitType: "Residential Building",
    projectType: details.projectType,
    housingUnits: details.dwellingUnits,
    description: details.workDescription,
    estimatedCost: details.permitValuation ?? 0,
    submittedAt: now.toISOString(),
    affordableHousing: false,
    underservedCommunity: false,
    claimed_affordable: false,
    claimed_underserved: false,
    censusTract: "",
    reviewDecisions: {},
    reviewStatus: "In County Intake",
    assignedDepartment: "County Intake",
    documents: [
      { label: "Architectural plans", category: "Building", required: true, received: false },
      { label: "Structural plans", category: "Building", required: true, received: false },
      { label: "Site plan and survey", category: "Planning", required: true, received: false },
      { label: "Energy compliance", category: "Building", required: true, received: false },
      { label: "Owner authorization", category: "Administrative", required: true, received: false },
    ],
    notes: [],
    timeline: [],
    dataSource: "Prototype Submission",
  }, config);
  return CreatePermitApplicationResponse.parse({
    ...screened,
    timeline: buildPermitTimeline(screened.reviewStatus, now, screened.recommendedRouting.includes("Fire Marshal")),
  });
}