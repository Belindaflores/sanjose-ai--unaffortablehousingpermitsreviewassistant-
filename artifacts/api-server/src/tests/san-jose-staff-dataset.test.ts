import test from "node:test";
import assert from "node:assert/strict";
import { checkJurisdiction, SAN_JOSE_ZIPS, screenApplication } from "@workspace/api-zod";
import { buildSanJoseStaffDataset } from "../lib/san-jose-staff-dataset";
import { acceptedStaffApplications, canAccessPermit } from "../lib/accepted-staff-applications";

const records = buildSanJoseStaffDataset("test-workspace");
test("staff dataset has exactly ten unique projects, numbers, and housing categories", () => {
  assert.equal(records.length, 10);
  assert.equal(new Set(records.map(a => a.id)).size, 10);
  assert.equal(new Set(records.map(a => a.projectName)).size, 10);
  assert.equal(new Set(records.map(a => a.housingCategory)).size, 10);
  assert.equal(acceptedStaffApplications(records).length, 10);
  assert.equal(records.filter(a => a.affordableHousing).length, 10);
  for (const a of records) {
    const jurisdiction = checkJurisdiction(a.projectAddress);
    assert.equal(jurisdiction.status, "In County");
    assert.equal(jurisdiction.city, "San Jose");
    assert.ok(SAN_JOSE_ZIPS.has(jurisdiction.zip));
    assert.ok(a.housingCategory && a.projectType && a.assignedDepartment && a.submittedAt);
    assert.equal(a.dataSource, "Synthetic");
  }
});
test("exactly three are genuinely ready; seven have the requested balanced review states", () => {
  const ready = records.filter(a => a.reviewStatus === "Ready for Review");
  assert.equal(ready.length, 3);
  for (const a of ready) {
    assert.equal(a.completenessScore, 100);
    assert.equal(a.aiStatus, "Ready for Human Review");
    assert.ok(a.documents.filter(d => d.required).every(d => d.received));
    assert.deepEqual(a.requiredReviewers, []);
    assert.deepEqual(a.ruleChecks?.safetyCriticalFlags, []);
    assert.deepEqual(a.ruleChecks?.classificationConflicts, []);
  }
  for (const status of ["On Hold — Safety Review Required", "Missing Required Documents", "Priority Claim Requires Verification", "Human Review Required", "Additional Agency Review", "Potential Issues Detected", "Under Initial Review"]) assert.equal(records.filter(a => a.reviewStatus === status).length, 1);
});
test("city, California state, approved ZIP, and full street must all match", () => {
  for (const city of ["Oakland", "Berkeley", "Fremont", "Santa Clara", "Milpitas", "Campbell", "Palo Alto"]) {
    assert.equal(checkJurisdiction(`123 H Street, ${city}, CA 95112`).status, "Outside County");
  }
  for (const address of ["123 H Street, Oakland, CA 94612", "123 H Street, San Jose, CA 95050", "123 H Street, San Jose, NY 95112", "123 H Street, Oakland, CA"]) assert.equal(checkJurisdiction(address).status, "Outside County");
  for (const address of ["123 H Street, San José, California 95112", "123 H Street, San Jose, CA 95112-1234"]) assert.equal(checkJurisdiction(address).status, "In County");
  for (const address of ["San Jose, CA 95112", "123 H Street, CA 95112", "123 H Street, San Jose, 95112", "123 H Street, San Jose, CA"]) assert.notEqual(checkJurisdiction(address).status, "In County");
});
test("accepted list rejects outside, partial, archived, and renamed duplicate records", () => {
  const duplicate = { ...records[0]!, id: "duplicate-id", projectName: "Changed project name" };
  const outside = { ...records[0]!, id: "outside", projectName: "Outside", projectAddress: "123 H Street, Oakland, CA 95112" };
  const partial = { ...records[0]!, id: "partial", projectName: "Partial", projectAddress: "San Jose, CA 95112" };
  assert.equal(acceptedStaffApplications([...records, duplicate, outside, partial, { ...records[1]!, staffVisible: false }]).length, 10);
  assert.equal(records.filter(a => /oakland|123 h street/i.test(`${a.projectName} ${a.projectAddress}`)).length, 0);
});
test("archive is staff-only and does not strip an applicant's owner access", () => {
  const archived = { ...records[0]!, workspaceId: "test-workspace", ownerUserId: "owner", staffVisible: false };
  assert.equal(canAccessPermit({ id: "staff", role: "worker", workspaceId: "test-workspace" }, archived), false);
  assert.equal(canAccessPermit({ id: "owner", role: "applicant", workspaceId: "test-workspace" }, archived), true);
  assert.equal(canAccessPermit({ id: "other", role: "applicant", workspaceId: "test-workspace" }, archived), false);
});
test("re-screening keeps balanced states and cannot present pending/missing records as ready", () => {
  for (const a of records) assert.equal(screenApplication(a).reviewStatus, a.reviewStatus);
  assert.notEqual(screenApplication({ ...records[5]!, reviewStatus: "Ready for Review" }).reviewStatus, "Ready for Review");
  assert.notEqual(screenApplication({ ...records[4]!, reviewStatus: "Ready for Review" }).reviewStatus, "Ready for Review");
});