import test from "node:test";
import assert from "node:assert/strict";
import { DeletePermitApplicationBody, DeletePermitApplicationParams } from "@workspace/api-zod";
import { canViewApplication } from "../middlewares/portal-auth";

test("deletion uses authenticated owner/staff access, never an applicant-selected role or email", () => {
  const owner = { id: "synthetic-owner", role: "applicant" as const };
  const other = { id: "synthetic-other", role: "applicant" as const };
  assert.equal(canViewApplication(owner, owner.id), true);
  assert.equal(canViewApplication(other, owner.id), false);
  assert.equal(canViewApplication(owner, null), false);
  assert.equal(canViewApplication(owner, undefined), false);
  assert.equal(canViewApplication({ id: "synthetic-staff", role: "worker" }, owner.id), true);
  assert.equal(canViewApplication({ id: "synthetic-fire", role: "fire_marshal" }, owner.id), true);
});

test("deletion contract requires a nonempty bounded ID and explicit confirmation", () => {
  assert.equal(DeletePermitApplicationBody.safeParse({}).success, false);
  assert.equal(DeletePermitApplicationBody.safeParse({ confirmationId: "" }).success, false);
  assert.equal(DeletePermitApplicationBody.safeParse({ confirmationId: true }).success, false);
  assert.equal(DeletePermitApplicationParams.safeParse({ id: "" }).success, false);
  assert.equal(DeletePermitApplicationParams.safeParse({ id: "x".repeat(181) }).success, false);
  assert.equal(DeletePermitApplicationBody.safeParse({ confirmationId: "synthetic-delete-test" }).success, true);
});