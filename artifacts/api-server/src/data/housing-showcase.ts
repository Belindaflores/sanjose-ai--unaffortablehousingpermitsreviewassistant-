/**
 * Public-source snapshot verified on 2026-10-04 against San Jose's Active Building
 * Permits dataset, including its APPLICANT field. No private portal data.
 * These are historical source values, not live City status or portal approvals.
 */
export const housingShowcaseRecords = [
  {
    sourceRecordId: "2024-089733-RS",
    dataSource: "City of San Jose Open Data",
    datasetName: "Active Building Permits",
    sourceUrl: "https://data.sanjoseca.gov/dataset/active-building-permits",
    businessName: "ADU UNIT 1 (BEPM 100%) PORTION GARAGE CONVERSION TO ADU 454 SQFT",
    siteLocation: "1255 SAN TOMAS AQUINO RD 1 , SAN JOSE CA 95117",
    city: "SAN JOSE",
    housingDetails: {
      permitNumber: "2024-089733-RS",
      officialApplicant: "COMSTOCK JOHNSON ARCHITECTS  YURIY AVRAMENKO",
      projectType: "ADU   Accessory Dwelling Unit",
      workDescription: "New Construction",
      dwellingUnits: 1,
      status: "Active",
      issuedDate: "2024-08-09",
      finalDate: null,
      permitValuation: 75214,
    },
  },
  {
    sourceRecordId: "2024-089749-RS",
    dataSource: "City of San Jose Open Data",
    datasetName: "Active Building Permits",
    sourceUrl: "https://data.sanjoseca.gov/dataset/active-building-permits",
    businessName: "ADU UNIT 2 (BEPM 100%) PORTION GARAGE CONVERSION TO ADU 496 SQFT",
    siteLocation: "1255 SAN TOMAS AQUINO RD 2 , SAN JOSE CA 95117",
    city: "SAN JOSE",
    housingDetails: {
      permitNumber: "2024-089749-RS",
      officialApplicant: "COMSTOCK JOHNSON ARCHITECTS  YURIY AVRAMENKO",
      projectType: "ADU   Accessory Dwelling Unit",
      workDescription: "New Construction",
      dwellingUnits: 1,
      status: "Active",
      issuedDate: "2024-08-09",
      finalDate: null,
      permitValuation: 82172,
    },
  },
];