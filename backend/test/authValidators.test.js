import assert from "node:assert/strict";
import test from "node:test";
import { profileUpdateSchema } from "../src/validators/authValidators.js";

test("profile updates accept employee details but reject unexpected profile fields", () => {
  assert.equal(profileUpdateSchema.safeParse({
    name: "Alex Employee",
    designation: "Technician",
    phone: "+880123456789",
    address: "Dhaka",
  }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ role: "ADMIN" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ photoUrl: "http://example.com/avatar.png" }).success, false);
});
