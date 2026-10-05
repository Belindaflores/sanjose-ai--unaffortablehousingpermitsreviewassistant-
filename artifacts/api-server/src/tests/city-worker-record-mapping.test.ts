import test from "node:test";
import assert from "node:assert/strict";
import type { CityWorkerApplicationRecord } from "@workspace/db";
import { toPortalReviewRecord } from "../lib/city-worker-records";

const row: CityWorkerApplicationRecord = {
  id: "DB-TEST", workspaceId: "santa-clara-county", permitNumber: "SYN-DB-TEST",
  projectName: "Database housing project", address: "1000 North 4th Street, San José, CA 95112",
  city: "San José", state: "California", zipCode: "95112",
  applicationType: "Residential building permit", totalUnits: 60, affordableUnits: 18,
  housingCategory: "Mixed-income housing", status: "Ready for Review", priority: "Normal",
  department: "Housing and Planning", sourceType: "Synthetic data modeled on public records",
  isSynthetic: true, createdAt: new Date("2026-03-01T12:00:00Z"), updatedAt: new Date("2026-03-02T12:00:00Z"),
  recordCategory: "City Housing Permits", housingType: "Multifamily", workType: "New construction",
  sourceStatus: "Under review", issuedDate: null, finalDate: null, submittedDate: "2026-03-01",
  description: "Fictional public-data-style project.", sourceUrl: "https://data.sanjoseca.gov/",
};

test("database projection uses stored names, statuses, units, priority and department; no fixture fallback", () => {
  const result = toPortalReviewRecord({ ...row, projectName: "Edited in database", status: "Human Review Required", totalUnits: 88, affordableUnits: 0, department: "Building" });
  assert.equal(result.projectName, "Edited in database");
  assert.equal(result.reviewStatus, "Human Review Required");
  assert.equal(result.totalHousingUnits, 88);
  assert.equal(result.affordableHousingUnits, 0);
  assert.equal(result.affordableHousing, false);
  assert.equal(result.department, "Building");
  assert.equal(result.priority, row.priority);
  assert.equal(result.isSynthetic, true);
  assert.equal(result.sourceType, "Synthetic data modeled on public records");
});
test("database calendar dates and timestamps retain exact wire types", () => {
  const result = toPortalReviewRecord(row);
  assert.equal(result.createdAt, "2026-03-01T12:00:00.000Z");
  assert.equal(result.updatedAt, "2026-03-02T12:00:00.000Z");
  assert.equal(result.submittedDate, "2026-03-01");
  assert.equal(result.issuedDate, null);
});
test("database City rows with outside or partial addresses are rejected, not rendered as accepted", () => {
  assert.throws(() => toPortalReviewRecord({ ...row, city: "Oakland" }), /jurisdiction/);
  assert.throws(() => toPortalReviewRecord({ ...row, address: "123 H Street, Oakland, CA 95112" }), /jurisdiction/);
  assert.throws(() => toPortalReviewRecord({ ...row, zipCode: "94601" }), /jurisdiction/);
});