import assert from "node:assert/strict";
import { test } from "node:test";
import {
  quotationCreateSchema,
  supportRequestCreateSchema,
  supportStatusSchema,
} from "../src/validators/supportValidators.js";
import { sniffFileType } from "../src/services/supportFiles.js";

test("support requests require contact/problem details and reject spoofed identity", () => {
  assert.equal(supportRequestCreateSchema.safeParse({
    serviceId: "6",
    serviceTitle: "24/7 Emergency Technical Support",
    whatsapp: "01610989538",
    problemDetails: "Lift is not responding.",
  }).success, true);
  assert.equal(supportRequestCreateSchema.safeParse({
    serviceId: "6",
    serviceTitle: "Support",
    whatsapp: "01610989538",
    problemDetails: "Problem",
    userName: "Forged Name",
  }).success, false);
});

test("quotation totals are based on bounded line-item inputs", () => {
  assert.equal(quotationCreateSchema.safeParse({
    status: "SENT",
    items: [{ name: "Inspection", qty: "1.5", price: "2500.00" }],
  }).success, true);
  assert.equal(quotationCreateSchema.safeParse({
    items: [{ name: "Inspection", qty: "0", price: "2500.00" }],
  }).success, false);
  assert.equal(supportStatusSchema.safeParse({ status: "IN_REVIEW" }).success, true);
  assert.equal(supportStatusSchema.safeParse({ status: "pending" }).success, false);
});

test("attachment type is verified from content signatures", () => {
  assert.deepEqual(sniffFileType(Buffer.from("%PDF-1.7")), {
    mimeType: "application/pdf",
    extension: "pdf",
  });
  assert.deepEqual(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), {
    mimeType: "image/jpeg",
    extension: "jpg",
  });
  assert.throws(() => sniffFileType(Buffer.from("<html>not an image</html>")), {
    code: "INVALID_FILE_CONTENT",
  });
});
