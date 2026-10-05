import test from "node:test";
import assert from "node:assert/strict";
import { BUILDING_RESOURCE_ID, buildingSourceUrl, mapBuildingRecord } from "../lib/public-building-permits";

test("official feed paginates the entire resource without the two-ADU restriction", () => {
  const url = buildingSourceUrl(172, 100, "");
  assert.equal(url.searchParams.get("resource_id"), BUILDING_RESOURCE_ID);
  assert.equal(url.searchParams.get("offset"), "17100");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.get("sort"), "_id asc");
  assert.equal(url.searchParams.has("filters"), false);
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.has("sql"), false);
});

test("search is encoded as a source API parameter, not interpolated into SQL", () => {
  const query = "2024-089733-RS'; DROP TABLE permits; --";
  assert.equal(buildingSourceUrl(1, 25, query).searchParams.get("q"), query);
});

test("source metadata is preserved without inventing applicants, units or dates", () => {
  const result = mapBuildingRecord({ _id: 7, FOLDERNUMBER: " 2024-089733-RS ", APPLICANT: " Architect ",
    Status: "Active", DWELLINGUNITS: "0", ISSUEDATE: "8/9/2024 12:00:00 AM" });
  assert.equal(result.permitNumber, "2024-089733-RS");
  assert.equal(result.applicant, "Architect");
  assert.equal(result.dwellingUnits, "0");
  assert.equal(result.issuedDate, "8/9/2024 12:00:00 AM");
  assert.equal(result.address, null);
  assert.equal(result.finalDate, null);
  assert.throws(() => mapBuildingRecord({ _id: null }), /identifier/);
  assert.throws(() => mapBuildingRecord({ _id: 1, DWELLINGUNITS: 2 }), /field type/);
});