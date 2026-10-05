import test from "node:test";
import assert from "node:assert/strict";
import { checkJurisdiction, SAN_JOSE_ZIPS } from "@workspace/api-zod";
import { buildPortalReviewRecords, portalReviewSeedWorkspace as portalReviewWorkspace, OFFICIAL_CITY_SOURCE_COUNT } from "../lib/portal-review-records";
import { buildSanJoseStaffDataset } from "../lib/san-jose-staff-dataset";

test("portal previews total112 with70City25County17Prototype; independent from accepted10", () => {
  const { records } = portalReviewWorkspace();
  assert.equal(records.length, 112);
  assert.equal(records.filter(r => r.recordCategory === "City Housing Permits").length, 70);
  assert.equal(records.filter(r => r.recordCategory === "County Public Data").length, 25);
  assert.equal(records.filter(r => r.recordCategory === "Prototype Submissions").length, 17);
  assert.equal(buildSanJoseStaffDataset("test").length, 10);
  assert.equal(new Set(records.map(r => r.id)).size, 112);
  assert.equal(new Set(records.map(r => r.permitNumber)).size, 112);
  assert.equal(new Set(records.map(r => r.projectName)).size, 112);
});
test("City housing previews have at least50 affordable examples with realistic unit counts", () => {
  const city = buildPortalReviewRecords().filter(r => r.recordCategory === "City Housing Permits");
  assert.ok(city.filter(r => r.affordableHousing).length >= 50);
  assert.equal(new Set(city.map(r => r.housingCategory)).size, 12);
  for (const record of city) {
    assert.ok(record.totalHousingUnits > 0);
    assert.ok(record.affordableHousingUnits <= record.totalHousingUnits);
    assert.equal(record.affordableHousing, record.affordableHousingUnits > 0);
    for (const key of ["permitNumber", "projectName", "address", "city", "zipCode", "applicationType", "workType", "sourceStatus", "housingCategory", "reviewStatus"]) assert.ok(record[key as keyof typeof record]);
    assert.ok("issuedDate" in record && "finalDate" in record);
    if (record.finalDate) assert.ok(record.issuedDate && record.finalDate >= record.issuedDate);
  }
});
test("server validates all112 complete SanJose California addresses, not ZIP alone", () => {
  for (const record of buildPortalReviewRecords()) {
    assert.equal(checkJurisdiction(record.address).status, "In County");
    assert.ok(SAN_JOSE_ZIPS.has(record.zipCode));
    assert.equal(record.state, "California");
    assert.match(record.city, /^San Jos[eé]$/);
  }
  assert.equal(buildPortalReviewRecords().filter(r => /oakland|berkeley|fremont|milpitas|campbell|123 h street/i.test(r.address)).length, 0);
});
test("official17272 source count is separate, snapshots stable, all previews explicitly synthetic", () => {
  const workspace = portalReviewWorkspace();
  assert.equal(workspace.officialCitySourceCount, 17272);
  assert.equal(OFFICIAL_CITY_SOURCE_COUNT, 17272);
  assert.notEqual(workspace.records.length, workspace.officialCitySourceCount);
  assert.deepEqual(workspace.records, portalReviewWorkspace().records);
  assert.match(workspace.notice, /synthetic/);
  for (const record of workspace.records) {
    assert.equal(record.dataSource, "Synthetic");
    assert.match(record.permitNumber, /^SYN-/);
    assert.ok(!("ownerUserId" in record) && !("email" in record));
  }
});