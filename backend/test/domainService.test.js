import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";

const { calculatePurchaseLines, validateEditedChecklist } = await import("../src/services/domainService.js");
const { Prisma } = await import("@prisma/client");

test("purchase lines use stored product prices and calculate grouped totals on the server", () => {
  const lines = calculatePurchaseLines([
    { productId: "p1", quantity: "1.25" },
    { productId: "p1", quantity: "0.75" },
    { productId: "p2", quantity: "3" },
  ], [
    { id: "p1", name: "Lift belt", unitPrice: new Prisma.Decimal("4.20") },
    { id: "p2", name: "Roller", unitPrice: new Prisma.Decimal("1.10") },
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].quantity.toString(), "2");
  assert.equal(lines[0].unitPrice.toString(), "4.2");
  assert.equal(lines[0].totalPrice.toString(), "8.4");
  assert.equal(lines[1].totalPrice.toString(), "3.3");
});

test("purchase line calculation rejects missing and negative-priced products", () => {
  assert.throws(() => calculatePurchaseLines(
    [{ productId: "missing", quantity: "1" }], []
  ), { code: "PRODUCT_NOT_FOUND" });
  assert.throws(() => calculatePurchaseLines(
    [{ productId: "p1", quantity: "1" }],
    [{ id: "p1", name: "Unsafe", unitPrice: new Prisma.Decimal("-1") }]
  ), { code: "INVALID_PRODUCT_PRICE" });
});

test("edited checklist validation preserves required fields and rejects duplicate task IDs", () => {
  const checklist = {
    title: "Annual inspection",
    tasks: [{
      id: "task-1", section: "Safety", title: "Inspect", description: "Inspect condition",
      toolsAndParts: [], priority: "High", estimatedMinutes: 30, safetyPrecautions: "Qualified technician only",
    }],
  };
  assert.equal(validateEditedChecklist(checklist).tasks[0].status, "Pending");
  assert.throws(() => validateEditedChecklist({
    ...checklist, tasks: [checklist.tasks[0], checklist.tasks[0]],
  }), /unique/);
  assert.throws(() => validateEditedChecklist({
    ...checklist, tasks: [{ ...checklist.tasks[0], estimatedMinutes: 1441 }],
  }), /duration/);
});
