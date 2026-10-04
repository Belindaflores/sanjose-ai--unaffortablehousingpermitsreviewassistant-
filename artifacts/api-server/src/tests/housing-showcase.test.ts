import test from "node:test";
import assert from "node:assert/strict";
import { housingShowcaseRecords } from "../data/housing-showcase";

test("published showcase contains exactly the two verified housing permits", () => {
  assert.deepEqual(housingShowcaseRecords.map(r => r.sourceRecordId), ["2023-081161-MF", "2024-111170-RS"]);
  assert.deepEqual(housingShowcaseRecords.map(r => r.housingDetails.dwellingUnits), [233, 1]);
  for (const record of housingShowcaseRecords) {
    assert.equal(record.housingDetails.permitNumber, record.sourceRecordId);
    assert.equal(record.dataSource, "City of San Jose Open Data");
    assert.equal(record.sourceUrl, "https://data.sanjoseca.gov/dataset/active-building-permits");
    assert.match(record.housingDetails.projectType, /Apartment|Accessory Dwelling Unit/);
    assert.doesNotMatch(JSON.stringify(record), /pool|spa/i);
    assert.equal(record.housingDetails.finalDate, null);
  }
});

test("showcase data cannot contain private ownership, sign-in, uploads, or approvals", () => {
  const allowed = ["sourceRecordId", "dataSource", "datasetName", "sourceUrl", "businessName", "siteLocation", "city", "housingDetails"].sort();
  for (const record of housingShowcaseRecords) {
    assert.deepEqual(Object.keys(record).sort(), allowed);
    assert.doesNotMatch(JSON.stringify(record), /ownerUserId|objectPath|priorityClaims|reviewDecisions|password|email/);
  }
});