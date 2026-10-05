import { checkJurisdiction, ListPortalReviewRecordsResponse } from "@workspace/api-zod";

type PortalReviewRecord = (typeof ListPortalReviewRecordsResponse._output)["records"][number];

// SEED FIXTURES ONLY. Imported by the explicit seed command and unit tests,
// never by API routes. Runtime records come from city_worker_application_records.
export const OFFICIAL_CITY_SOURCE_COUNT = 17_272;
export const OFFICIAL_CITY_SOURCE_URL = "https://data.sanjoseca.gov/dataset/active-building-permits";
const countySourceUrl = "https://data.sccgov.org/";
const housingPatterns = [
  ["Affordable multifamily housing", "Multifamily", "New construction", 64],
  ["Mixed-income housing", "Multifamily", "New construction", 90],
  ["Supportive housing", "Supportive", "New construction", 42],
  ["Affordable housing rehabilitation", "Multifamily", "Rehabilitation", 48],
  ["Senior housing", "Senior", "New construction", 36],
  ["Workforce housing", "Multifamily", "New construction", 56],
  ["Permanent supportive housing", "Supportive", "Adaptive reuse", 40],
  ["Density-bonus housing", "Multifamily", "New construction", 84],
  ["New apartment construction", "Multifamily", "New construction", 72],
  ["Accessory dwelling units", "ADU", "New construction", 2],
  ["Family affordable housing", "Multifamily", "New construction", 60],
  ["Preservation of existing affordable units", "Multifamily", "Preservation", 32],
] as const;
const streets = [
  ["North 4th Street", "95112", "Riverview"],
  ["Monterey Road", "95112", "Creekside"],
  ["South 2nd Street", "95112", "Garden Walk"],
  ["Willow Street", "95125", "Willow"],
  ["Alum Rock Avenue", "95116", "Alum Rock"],
  ["Senter Road", "95111", "Seven Trees"],
  ["Keyes Street", "95112", "Southside"],
  ["Blossom Hill Road", "95123", "Blossom"],
  ["Story Road", "95122", "Eastside"],
  ["West San Carlos Street", "95126", "Rose Garden"],
] as const;
const reviewStates = ["Under Initial Review", "Ready for Review", "Human Review Required", "Additional Agency Review", "Missing Required Documents", "Potential Issues Detected"];
const sourceStates = ["Application received", "Under review", "Issued", "Finaled"];
const date = (month: number, day: number) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function buildPortalReviewRecords(): PortalReviewRecord[] {
  const makeHousing = (index: number, prototype: boolean): PortalReviewRecord => {
    const patternIndex = index % housingPatterns.length;
    const [housingCategory, housingType, workType, baseUnits] = housingPatterns[patternIndex]!;
    const [street, zipCode, neighborhood] = streets[index % streets.length]!;
    const affordableHousing = patternIndex !== 8 && patternIndex !== 9;
    const totalHousingUnits = baseUnits + (housingType === "ADU" ? index % 2 : Math.floor(index / 12) * 4);
    const affordableHousingUnits = affordableHousing
      ? Math.max(1, Math.floor(totalHousingUnits * ([1, 7].includes(patternIndex) ? 0.3 : 1))) : 0;
    const suffix = String(index + 1).padStart(3, "0");
    const recordCategory = prototype ? "Prototype Submissions" : "City Housing Permits";
    const sourceStatus = prototype ? "Portal preview — not filed" : sourceStates[index % sourceStates.length]!;
    const issued = sourceStatus === "Issued" || sourceStatus === "Finaled";
    return {
      id: `PREVIEW-SJ-${prototype ? "P" : "H"}-${suffix}`,
      permitNumber: `SYN-SJ-2026-${prototype ? "P" : "H"}${suffix}`,
      recordCategory,
      projectName: `${neighborhood} ${prototype ? "Prototype" : "Housing"} ${housingType === "ADU" ? "Cottages" : "Residences"} ${suffix}`,
      address: `${(prototype ? 3200 : 1000) + index * 12} ${street}, San José, CA ${zipCode}`,
      city: "San José", state: "California", zipCode,
      applicationType: housingType === "ADU" ? "ADU building permit" : workType === "Rehabilitation" || workType === "Preservation" ? "Residential alteration permit" : "Residential building permit",
      housingType, totalHousingUnits, affordableHousingUnits, affordableHousing, housingCategory, workType,
      sourceStatus,
      issuedDate: issued ? date(6, 1 + index % 25) : null,
      finalDate: sourceStatus === "Finaled" ? date(8, 1 + index % 25) : null,
      submittedDate: date(3, 1 + index % 25),
      reviewStatus: reviewStates[index % reviewStates.length]!,
      dataSource: "Synthetic",
      priority: "Normal",
      department: housingType === "ADU" ? "Building" : "Housing and Planning",
      sourceType: "Synthetic data modeled on public records", isSynthetic: true,
      createdAt: `${date(3, 1 + index % 25)}T12:00:00.000Z`,
      updatedAt: `${date(3, 1 + index % 25)}T12:00:00.000Z`,
      sourceUrl: OFFICIAL_CITY_SOURCE_URL,
      description: `Fictional ${housingCategory.toLowerCase()} project with ${totalHousingUnits} homes and ${affordableHousingUnits} affordable units. ${affordableHousing ? "Income-restricted and below-market-rate homes support housing availability." : "Market-rate housing production example."} Dates, permit identifiers and source statuses are hypothetical; no private applicant information or official filing is represented.`,
    };
  };
  const countyPatterns = ["Food facility plan review", "Community kitchen improvement", "Retail tenant improvement", "Environmental health inspection", "Childcare facility alteration"] as const;
  const county: PortalReviewRecord[] = Array.from({ length: 25 }, (_, index) => {
    const [street, zipCode, neighborhood] = streets[index % streets.length]!;
    const suffix = String(index + 1).padStart(3, "0");
    const sourceStatus = sourceStates[index % sourceStates.length]!;
    return {
      id: `PREVIEW-SJ-C-${suffix}`, permitNumber: `SYN-COUNTY-2026-C${suffix}`,
      recordCategory: "County Public Data", projectName: `${neighborhood} Community Facility ${suffix}`,
      address: `${2400 + index * 12} ${street}, San Jose, CA ${zipCode}`,
      city: "San José", state: "California", zipCode,
      applicationType: countyPatterns[index % countyPatterns.length]!,
      housingType: "Non-housing", totalHousingUnits: 0, affordableHousingUnits: 0,
      affordableHousing: false, housingCategory: "Not a housing record",
      workType: "Facility review", sourceStatus,
      issuedDate: ["Issued", "Finaled"].includes(sourceStatus) ? date(6, 1 + index % 25) : null,
      finalDate: sourceStatus === "Finaled" ? date(8, 1 + index % 25) : null,
      submittedDate: date(3, 1 + index % 25),
      reviewStatus: reviewStates[index % reviewStates.length]!,
      dataSource: "Synthetic", sourceUrl: countySourceUrl,
      priority: "Normal", department: "Environmental Health",
      sourceType: "Synthetic data modeled on public records", isSynthetic: true,
      createdAt: `${date(3, 1 + index % 25)}T12:00:00.000Z`,
      updatedAt: `${date(3, 1 + index % 25)}T12:00:00.000Z`,
      description: "Fictional San José public-facility review modeled on County environmental-health data patterns. Not an imported official public record, private applicant record, housing permit, or real agency decision.",
    };
  });
  const records = [
    ...Array.from({ length: 70 }, (_, index) => makeHousing(index, false)),
    ...county,
    ...Array.from({ length: 17 }, (_, index) => makeHousing(index, true)),
  ];
  // Fail explicitly if fixture maintenance ever introduces a partial/outside record.
  for (const record of records) {
    if (checkJurisdiction(record.address).status !== "In County") throw new Error(`Preview record ${record.id} failed San José jurisdiction validation.`);
  }
  return records;
}

export function portalReviewSeedWorkspace() {
  const records = buildPortalReviewRecords();
  return ListPortalReviewRecordsResponse.parse({
    records,
    officialCitySourceCount: OFFICIAL_CITY_SOURCE_COUNT,
    officialCitySourceUrl: OFFICIAL_CITY_SOURCE_URL,
    notice: `All ${records.length} portal review records are clearly disclosed synthetic examples modeled on public data patterns, not official City or County filings. They are separate from the accepted staff applications and all private applicant records. The official City source dataset count is shown separately.`,
  });
}