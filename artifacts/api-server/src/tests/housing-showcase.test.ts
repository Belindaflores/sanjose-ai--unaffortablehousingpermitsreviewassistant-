import test from "node:test";
import assert from "node:assert/strict";
import { housingShowcaseRecords } from "../data/housing-showcase";
import { getSharedOfficialApplicant, PUBLIC_HOUSING_SHOWCASE_IDS } from "@workspace/api-zod";

test("published showcase contains exactly the two verified housing permits", () => {
  assert.deepEqual(housingShowcaseRecords.map(r => r.sourceRecordId), [...PUBLIC_HOUSING_SHOWCASE_IDS]);
  assert.deepEqual(housingShowcaseRecords.map(r => r.housingDetails.dwellingUnits), [1, 1]);
  assert.equal(getSharedOfficialApplicant(housingShowcaseRecords), "COMSTOCK JOHNSON ARCHITECTS YURIY AVRAMENKO");
  for (const record of housingShowcaseRecords) {
    assert.equal(record.housingDetails.permitNumber, record.sourceRecordId);
    assert.equal(record.dataSource, "City of San Jose Open Data");
    assert.equal(record.sourceUrl, "https://data.sanjoseca.gov/dataset/active-building-permits");
    assert.match(record.housingDetails.projectType, /Apartment|Accessory Dwelling Unit/);
    assert.doesNotMatch(JSON.stringify(record), /pool|spa/i);
    assert.equal(record.housingDetails.finalDate, null);
  }
});

test("missing or mismatched official applicants never qualify for the public pair", () => {
  const example = (officialApplicant?: string) => ({ housingDetails: { officialApplicant } });
  for (const records of [
    [], [example("A")], [example("A"), example("B")], [example("A"), example()],
    [example("NONE"), example("NONE")], [example(""), example("")],
    [example("A"), example("A"), example("A")],
  ]) assert.equal(getSharedOfficialApplicant(records), null);
  assert.equal(getSharedOfficialApplicant([example("  Applicant  Company "), example("applicant company")]), "Applicant Company");
});

test("showcase data cannot contain private ownership, sign-in, uploads, or approvals", () => {
  const allowed = ["sourceRecordId", "dataSource", "datasetName", "sourceUrl", "businessName", "siteLocation", "city", "housingDetails"].sort();
  for (const record of housingShowcaseRecords) {
    assert.deepEqual(Object.keys(record).sort(), allowed);
    assert.doesNotMatch(JSON.stringify(record), /ownerUserId|objectPath|priorityClaims|reviewDecisions|password|email/);
  }
});