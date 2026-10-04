import test from "node:test";
import assert from "node:assert/strict";
import type { CountyPublicRecord } from "@workspace/db";
import { PLACEHOLDER_UNDERSERVED_CONFIG } from "@workspace/api-zod";
import { APPLICANT_ADU_IDS, applicantAduId, buildApplicantAdu, validateAduSources } from "../lib/applicant-adu-seed";

function source(id: string): CountyPublicRecord {
  return {
    sourceRecordId: id, businessName: `ADU ${id}`, siteLocation: "1255 San Tomas Aquino Rd, San Jose CA 95117",
    housingDetails: { officialApplicant: "Same Architect", projectType: "ADU Accessory Dwelling Unit",
      dwellingUnits: 1, workDescription: "Garage conversion", permitNumber: id, status: "Active",
      issuedDate: "2024-08-09", finalDate: null, permitValuation: 75214 },
  } as CountyPublicRecord;
}

test("ADU identifiers are deterministic across dates and isolated by owner and source", () => {
  const id = applicantAduId("owner-a", APPLICANT_ADU_IDS[0]);
  assert.equal(id, applicantAduId("owner-a", APPLICANT_ADU_IDS[0]));
  assert.notEqual(id, applicantAduId("owner-b", APPLICANT_ADU_IDS[0]));
  assert.notEqual(id, applicantAduId("owner-a", APPLICANT_ADU_IDS[1]));
});

test("both validated ADUs must have the same explicit official applicant", () => {
  const pair = APPLICANT_ADU_IDS.map(source);
  assert.equal(validateAduSources(pair).length, 2);
  assert.throws(() => validateAduSources([pair[0]!]), /Both/);
  pair[1]!.housingDetails!.officialApplicant = "Different Architect";
  assert.throws(() => validateAduSources(pair), /same official applicant/);
});

test("non-ADUs, missing names, outside-County addresses and inconsistent unit counts fail closed", () => {
  for (const patch of [
    { projectType: "Apartment" }, { officialApplicant: "" }, { dwellingUnits: 25 },
  ]) {
    const pair = APPLICANT_ADU_IDS.map(source);
    Object.assign(pair[0]!.housingDetails!, patch);
    assert.throws(() => validateAduSources(pair), /inconsistent/);
  }
  const pair = APPLICANT_ADU_IDS.map(source);
  pair[0]!.siteLocation = "123 Main St, Oakland CA 94612";
  assert.throws(() => validateAduSources(pair), /inconsistent/);
});

test("normal applications retain source fields, ownership, honest documents and unchanged screening", () => {
  const record = source(APPLICANT_ADU_IDS[0]);
  const now = new Date("2026-10-04T12:00:00Z");
  const application = buildApplicantAdu(record, { id: "owner-a", email: "owner@permit.test" }, PLACEHOLDER_UNDERSERVED_CONFIG, now);
  assert.equal(application.ownerUserId, "owner-a");
  assert.equal(application.applicantName, record.housingDetails!.officialApplicant);
  assert.equal(application.projectName, record.businessName);
  assert.equal(application.projectAddress, record.siteLocation);
  assert.equal(application.description, record.housingDetails!.workDescription);
  assert.equal(application.housingUnits, 1);
  assert.equal(application.reviewStatus, "In County Intake");
  assert.equal(application.priority, "Normal");
  assert.equal(application.verification_status, "Unverified");
  assert.ok(application.documents.length > 0);
  assert.ok(application.documents.every(doc => !doc.received && !doc.objectPath && !doc.fileName));
  assert.equal(application.timeline[0]!.date, now.toISOString());
  assert.equal(application.timeline[1]!.status, "current");
  assert.ok(application.timeline.slice(2).every(event => event.status === "upcoming" && !event.date));
  assert.doesNotMatch(JSON.stringify(application), /example|showcase|public source|read-only|source snapshot/i);
});