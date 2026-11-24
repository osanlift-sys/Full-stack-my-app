import assert from "node:assert/strict";
import test from "node:test";
import {
  purchaseCreateSchema,
  challanCreateSchema,
  attendanceCreateSchema,
  attendanceRequestSchema,
  attendanceReviewSchema,
  attendanceUpdateSchema,
  incomeCreateSchema,
  incomeUpdateSchema,
  notificationCreateSchema,
  notificationQuerySchema,
  payrollQuerySchema,
  projectUpdateSchema,
  projectCreateSchema,
  checklistGenerateSchema,
  checklistSaveSchema,
  checklistTaskUpdateSchema,
  serviceRecordUpdateSchema,
  serviceRecordCreateSchema,
  salaryUpdateSchema,
} from "../src/validators/domainValidators.js";

test("purchase input only accepts product and quantity; prices and totals are server-owned", () => {
  const valid = purchaseCreateSchema.safeParse({
    date: "2026-11-18",
    items: [{ productId: "product-1", quantity: "1.250" }],
  });
  assert.equal(valid.success, true);

  for (const extra of [
    { unitPrice: "5.00" },
    { totalPrice: "5.00" },
    { totalAmount: "5.00" },
  ]) {
    const result = purchaseCreateSchema.safeParse({
      items: [{ productId: "product-1", quantity: "1", ...extra }],
    });
    assert.equal(result.success, false);
  }
  assert.equal(purchaseCreateSchema.safeParse({
    date: "2026-11-18",
    purchasedAt: "2026-11-18T00:00:00.000Z",
    items: [{ productId: "product-1", quantity: 1 }],
  }).success, false);
});

test("purchase quantities must be positive and within supported precision", () => {
  for (const quantity of ["0", "-1", "1.2345", "not-a-number"]) {
    assert.equal(purchaseCreateSchema.safeParse({
      items: [{ productId: "product-1", quantity }],
    }).success, false);
  }
});

test("attendance and challan inputs reject unexpected fields", () => {
  assert.equal(attendanceCreateSchema.safeParse({
    employeeId: "employee-1", date: "2026-11-18", role: "ADMIN",
  }).success, false);
  assert.equal(challanCreateSchema.safeParse({
    items: [{ description: "Part", quantity: "1" }],
    totalAmount: "100",
  }).success, false);
});

test("payroll, project schedules, income and notification payloads are validated", () => {
  assert.equal(payrollQuerySchema.safeParse({ month: "2026-11" }).success, true);
  assert.equal(payrollQuerySchema.safeParse({ month: "November 2026" }).success, false);
  assert.equal(salaryUpdateSchema.safeParse({ baseSalary: "1000", advanceDeduction: "25.50" }).success, true);
  assert.equal(projectCreateSchema.safeParse({ projectName: "Lift A", liftQuantity: 2 }).success, true);
  assert.equal(serviceRecordCreateSchema.safeParse({ servicingStatus: "Complete" }).success, true);
  assert.equal(serviceRecordCreateSchema.safeParse({}).success, false);
  assert.equal(incomeCreateSchema.safeParse({ type: "CONVEYANCE", amount: "12.50" }).success, true);
  assert.equal(incomeCreateSchema.safeParse({ type: "CONVEYANCE", amount: "-1" }).success, false);
  assert.equal(notificationCreateSchema.safeParse({
    userId: "user-1", title: "Reminder", message: "Check schedule",
  }).success, true);
  assert.equal(notificationCreateSchema.safeParse({
    userId: "user-1", title: "Reminder", message: "Check schedule", recipientRole: "ADMIN",
  }).success, false);
});

test("attendance requests, updates, project updates, and checklist actions validate endpoint inputs", () => {
  assert.equal(attendanceUpdateSchema.safeParse({ status: "ABSENT" }).success, true);
  assert.equal(attendanceUpdateSchema.safeParse({}).success, false);
  assert.equal(attendanceRequestSchema.safeParse({
    requestedDate: "2026-11-18", requestData: { type: "LEAVE", reason: "Personal" },
  }).success, true);
  assert.equal(attendanceReviewSchema.safeParse({ status: "APPROVED" }).success, true);
  assert.equal(projectUpdateSchema.safeParse({ status: "ACTIVE" }).success, true);
  assert.equal(serviceRecordUpdateSchema.safeParse({ servicingStatus: "Complete" }).success, true);
  assert.equal(checklistGenerateSchema.safeParse({ workDescription: "Routine service" }).success, true);
  assert.equal(checklistSaveSchema.safeParse({ checklist: { title: "Checklist" } }).success, true);
  assert.equal(checklistTaskUpdateSchema.safeParse({
    taskId: "task-1", status: "Complete", technicianNotes: "",
  }).success, true);
});

test("income updates and notification filters reject invalid inputs", () => {
  assert.equal(incomeUpdateSchema.safeParse({ amount: "20.00" }).success, true);
  assert.equal(incomeUpdateSchema.safeParse({ amount: "-20" }).success, false);
  assert.equal(notificationQuerySchema.safeParse({ unreadOnly: "true" }).success, true);
  assert.equal(notificationQuerySchema.safeParse({ unreadOnly: "yes" }).success, false);
});
