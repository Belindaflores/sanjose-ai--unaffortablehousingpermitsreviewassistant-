import test from "node:test";
import assert from "node:assert/strict";
import { opalDocuments, opalTimeline, presentationDate } from "../lib/account-presentation-data";

test("Opal has seven synthetic received entries, five required and two supporting", () => {
  assert.equal(opalDocuments.length, 7);
  assert.equal(opalDocuments.filter(document => document.required).length, 5);
  assert.equal(opalDocuments.filter(document => !document.required).length, 2);
  assert.equal(new Set(opalDocuments.map(document => document.fileName)).size, 7);
  for (const document of opalDocuments) {
    assert.equal(document.uploadStatus, "Received");
    assert.equal(document.synthetic, true);
    assert.equal(document.uploadDate, presentationDate);
    assert.equal(document.fileType, "application/pdf");
    assert.ok(document.fileSize > 0);
    assert.ok(document.fileName.startsWith("Opal_Drive_ADU_"));
    assert.ok(document.fileName.endsWith(".pdf"));
    assert.equal("objectPath" in document, false);
  }
});

test("Requested timeline is complete through submission, not through review", () => {
  assert.deepEqual(opalTimeline.map(event => event.label), [
    "Application started", "Application information completed",
    "Required documents received", "Application submitted", "Under initial review",
  ]);
  assert.equal(opalTimeline.at(-1)?.status, "upcoming");
  assert.equal(opalTimeline.at(-1)?.date, null);
  assert.equal(opalTimeline.find(event => event.label === "Required documents received")?.date, presentationDate);
  assert.equal(presentationDate.slice(0, 10), "2026-10-04");
});