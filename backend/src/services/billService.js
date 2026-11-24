import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { normalizeCompanyName } from "../utils/identity.js";
import {
  billStatusFor,
  calculateTotals,
  decimal,
  formatBillDate,
  parseBillDate,
  paymentStatusFor,
  validatePaymentAmount,
  zero,
} from "./billMath.js";

async function resolveCompany(tx, data) {
  const requireActiveCompany = (company) => {
    if (company.status !== "ACTIVE") {
      throw new ApiError(409, "COMPANY_INACTIVE", "The selected company is not active.");
    }
    return company;
  };

  if (data.companyId) {
    const company = await tx.company.findUnique({ where: { id: data.companyId } });
    if (!company) throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
    return requireActiveCompany(company);
  }

  if (data.companyDocId) {
    const legacyCompany = await tx.company.findUnique({
      where: { legacyId: data.companyDocId },
    });
    if (legacyCompany) return requireActiveCompany(legacyCompany);
  }

  const name = (data.companyName || data.toCompany || data.companyDocId?.replace(/_/g, " ") || "").trim();
  if (!name) throw new ApiError(400, "COMPANY_REQUIRED", "A company is required.");
  const normalizedName = normalizeCompanyName(name);

  const company = await tx.company.upsert({
    where: { normalizedName },
    create: {
      name,
      normalizedName,
      ...(data.companyDocId ? { legacyId: data.companyDocId } : {}),
    },
    update: {},
  });
  return requireActiveCompany(company);
}

function serializeBill(bill) {
  const legacy = bill.legacyData && typeof bill.legacyData === "object"
    ? bill.legacyData
    : {};
  const header = bill.headerData && typeof bill.headerData === "object"
    ? bill.headerData
    : {};
  const payments = bill.payments?.length
    ? bill.payments.map((payment) => ({
      amount: payment.amount.toString(),
      date: (payment.paidAt || payment.createdAt).toISOString(),
      paymentMode: payment.paymentMethod || null,
      reference: payment.reference || null,
    }))
    : Array.isArray(legacy.paymentHistory)
      ? legacy.paymentHistory
      : [];

  return {
    id: bill.id,
    billId: bill.id,
    salesId: bill.id,
    billNo: bill.billNo || "",
    companyId: bill.companyId,
    companyDocId: bill.company.legacyId || bill.companyId,
    companyName: bill.company.name,
    toCompany: header.toCompany || bill.company.name,
    address: header.address || "",
    subject: bill.subject || "",
    purchaseOrderNo: bill.purchaseOrderNo || "",
    headerData: {
      ...header,
      invoiceNo: bill.billNo || header.invoiceNo || "",
      date: formatBillDate(bill.billDate) || header.date || "",
      toCompany: header.toCompany || bill.company.name,
      address: header.address || "",
      subject: bill.subject || header.subject || "",
      purchaseOrderNo: bill.purchaseOrderNo || header.purchaseOrderNo || "",
    },
    date: formatBillDate(bill.billDate),
    dueDate: formatBillDate(bill.dueDate),
    items: bill.items.map((item) => ({
      productId: item.productId,
      name: item.description,
      quantity: item.quantity.toString(),
      unit: item.unit || "Pcs",
      price: item.unitPrice.toString(),
    })),
    subtotal: bill.subtotal.toString(),
    discountAmount: bill.discountAmount.toString(),
    grandTotal: bill.totalAmount.toString(),
    totalBill: bill.totalAmount.toString(),
    paidAmount: bill.paidAmount.toString(),
    dueAmount: bill.dueAmount.toString(),
    paymentStatus: bill.paymentStatus,
    status: bill.status,
    paymentHistory: payments,
    createdType: bill.createdType || "General",
    isBlankCreated: bill.isBlankCreated,
    showPaidAmount: bill.showPaidAmount,
    showDueAmount: bill.showDueAmount,
    showPaymentMode: bill.showPaymentMode,
    notes: bill.notes,
    paymentMode: bill.paymentMode,
    offerId: legacy.offerId || null,
    sourceType: "bill",
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}

const billInclude = {
  company: { select: { id: true, name: true, legacyId: true } },
  items: { orderBy: { position: "asc" } },
  payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
};

function assertCompanyAccess(user, companyId) {
  if (user.role === "ADMIN" || user.role === "EMPLOYEE") return;
  if (user.role !== "CLIENT" || !user.companyIds.includes(companyId)) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found.");
  }
}

function assertCanRecordPayment(bill, user) {
  if (bill.status === "VOID") {
    throw new ApiError(409, "BILL_VOID", "Payments cannot be recorded against a void bill.");
  }
  assertCompanyAccess(user, bill.companyId);
  if (user.role === "CLIENT" || user.role === "SELLER") {
    throw new ApiError(403, "FORBIDDEN", "Only authorized staff can record a payment.");
  }
}

async function validateProducts(tx, items) {
  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  if (productIds.length === 0) return;

  const products = await tx.product.findMany({
    where: { id: { in: productIds }, status: "ACTIVE" },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    throw new ApiError(400, "INVALID_PRODUCT", "One or more selected products are unavailable.");
  }
}

async function createPaymentRecords(tx, { billId, amount, userId, paidAt, paymentMethod, reference }) {
  const payment = await tx.payment.create({
    data: {
      billId,
      amount,
      currency: "BDT",
      status: "PAID",
      recordedById: userId,
      paidAt,
      paymentMethod: paymentMethod || null,
      reference: reference || null,
    },
  });
  await tx.financialTransaction.create({
    data: {
      type: "BILL_PAYMENT",
      referenceType: "BILL",
      referenceId: billId,
      amount,
      currency: "BDT",
      occurredAt: paidAt,
      description: paymentMethod ? `Bill payment (${paymentMethod})` : "Bill payment",
      legacyData: {},
    },
  });
  return payment;
}

function prepareLineItems(items) {
  return items.map((item, position) => ({
    ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
    position,
    description: item.name,
    quantity: decimal(item.quantity),
    unitPrice: decimal(item.price),
    total: decimal(item.quantity).mul(decimal(item.price)).toDecimalPlaces(2),
  }));
}

export async function listBills(user, filters) {
  if (user.role === "SELLER") {
    throw new ApiError(403, "FORBIDDEN", "Sellers cannot access client bills.");
  }
  if (
    user.role === "CLIENT" &&
    filters.companyId &&
    !user.companyIds.includes(filters.companyId)
  ) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bills not found.");
  }
  const where = {
    status: filters.status || { not: "VOID" },
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(user.role === "CLIENT"
      ? { companyId: { in: user.companyIds } }
      : {}),
    ...(filters.search
      ? {
        OR: [
          { billNo: { contains: filters.search, mode: "insensitive" } },
          { subject: { contains: filters.search, mode: "insensitive" } },
          { company: { name: { contains: filters.search, mode: "insensitive" } } },
        ],
      }
      : {}),
  };
  const [bills, total] = await prisma.$transaction([
    prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: { billDate: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.bill.count({ where }),
  ]);
  return {
    items: bills.map(serializeBill),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}

export async function getBill(user, billId) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: billInclude,
  });
  if (!bill) throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found.");
  assertCompanyAccess(user, bill.companyId);
  return serializeBill(bill);
}

export async function createBill(user, data) {
  const bill = await prisma.$transaction(async (tx) => {
    const company = await resolveCompany(tx, data);
    const items = data.items;
    await validateProducts(tx, items);
    const { subtotal, discount, total } = calculateTotals(items, data.discountAmount);
    const paidAmount = decimal(data.paidAmount || "0");
    validatePaymentAmount(paidAmount, total, zero);
    const billDate = parseBillDate(data.date, "Bill date") || new Date();
    const dueDate = parseBillDate(data.dueDate, "Due date");
    const lineItems = prepareLineItems(items);
    const billNo = data.billNo || `INV-${Date.now()}`;
    const headerData = {
      invoiceNo: billNo,
      date: data.date || formatBillDate(billDate),
      toCompany: data.toCompany || data.companyName || company.name,
      address: data.address || "",
      subject: data.subject || "Bill / Invoice for Goods & Services",
      purchaseOrderNo: data.purchaseOrderNo || "",
    };
    const legacyData = {
      offerId: data.offerId || null,
    };

    const created = await tx.bill.create({
      data: {
        companyId: company.id,
        createdById: user.id,
        billNo,
        subject: headerData.subject,
        createdType: data.createdType || "General",
        status: billStatusFor(paidAmount, total),
        paymentStatus: paymentStatusFor(paidAmount, total),
        billDate,
        dueDate,
        subtotal,
        discountAmount: discount,
        totalAmount: total,
        paidAmount,
        dueAmount: total.minus(paidAmount),
        purchaseOrderNo: headerData.purchaseOrderNo,
        isBlankCreated: data.isBlankCreated ?? (data.createdType || "General") === "General",
        showPaidAmount: data.showPaidAmount ?? true,
        showDueAmount: data.showDueAmount ?? true,
        showPaymentMode: data.showPaymentMode ?? true,
        headerData,
        notes: data.notes || [],
        paymentMode: data.paymentMode || [],
        legacyData,
        items: { create: lineItems },
      },
    });

    if (paidAmount.gt(0)) {
      await createPaymentRecords(tx, {
        billId: created.id,
        amount: paidAmount,
        userId: user.id,
        paidAt: new Date(),
        paymentMethod: null,
        reference: "Initial payment",
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "BILL_CREATED",
        resourceType: "BILL",
        resourceId: created.id,
        metadata: { companyId: company.id },
      },
    });
    return tx.bill.findUnique({ where: { id: created.id }, include: billInclude });
  });

  return serializeBill(bill);
}

export async function updateBill(user, billId, data) {
  const bill = await prisma.$transaction(async (tx) => {
    const existing = await tx.bill.findUnique({
      where: { id: billId },
      include: billInclude,
    });
    if (!existing) throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found.");
    assertCompanyAccess(user, existing.companyId);
    if (existing.status === "VOID") {
      throw new ApiError(409, "BILL_VOID", "A void bill cannot be edited.");
    }
    if (data.companyId && data.companyId !== existing.companyId) {
      throw new ApiError(400, "COMPANY_CHANGE_NOT_ALLOWED", "A bill cannot be moved to another company.");
    }

    const nextItems = data.items || existing.items.map((item) => ({
      productId: item.productId,
      name: item.description,
      quantity: item.quantity.toString(),
      price: item.unitPrice.toString(),
      unit: item.unit,
    }));
    await validateProducts(tx, nextItems);
    const { subtotal, discount, total } = calculateTotals(
      nextItems,
      data.discountAmount ?? existing.discountAmount.toString()
    );
    const paidAmount = decimal(data.paidAmount ?? existing.paidAmount.toString());
    validatePaymentAmount(paidAmount, total, existing.paidAmount);
    const paymentDelta = paidAmount.minus(existing.paidAmount);
    const billDate = data.date
      ? parseBillDate(data.date, "Bill date")
      : existing.billDate;
    const dueDate = data.dueDate
      ? parseBillDate(data.dueDate, "Due date")
      : existing.dueDate;
    const billNo = data.billNo || existing.billNo;
    const headerData = {
      ...existing.headerData,
      ...(data.date ? { date: data.date } : {}),
      ...(data.toCompany ? { toCompany: data.toCompany } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.purchaseOrderNo !== undefined ? { purchaseOrderNo: data.purchaseOrderNo } : {}),
      ...(data.subject !== undefined ? { subject: data.subject } : {}),
      invoiceNo: billNo,
    };
    const legacyData = {
      ...existing.legacyData,
      ...(data.offerId !== undefined ? { offerId: data.offerId } : {}),
    };
    const now = new Date();
    const updated = await tx.bill.updateMany({
      where: { id: billId, updatedAt: existing.updatedAt },
      data: {
        billNo,
        subject: data.subject ?? existing.subject,
        createdType: data.createdType ?? existing.createdType,
        billDate,
        dueDate,
        subtotal,
        discountAmount: discount,
        totalAmount: total,
        paidAmount,
        dueAmount: total.minus(paidAmount),
        paymentStatus: paymentStatusFor(paidAmount, total),
        status: billStatusFor(paidAmount, total),
        purchaseOrderNo: data.purchaseOrderNo ?? existing.purchaseOrderNo,
        isBlankCreated: data.isBlankCreated ?? existing.isBlankCreated,
        showPaidAmount: data.showPaidAmount ?? existing.showPaidAmount,
        showDueAmount: data.showDueAmount ?? existing.showDueAmount,
        showPaymentMode: data.showPaymentMode ?? existing.showPaymentMode,
        headerData,
        notes: data.notes ?? existing.notes,
        paymentMode: data.paymentMode ?? existing.paymentMode,
        legacyData,
        updatedAt: now,
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "BILL_CHANGED", "The bill changed while you were editing it. Reload and try again.");
    }

    if (data.items) {
      await tx.billItem.deleteMany({ where: { billId } });
      await tx.billItem.createMany({
        data: prepareLineItems(data.items).map((item) => ({ ...item, billId })),
      });
    }
    if (paymentDelta.gt(0)) {
      await createPaymentRecords(tx, {
        billId,
        amount: paymentDelta,
        userId: user.id,
        paidAt: new Date(),
        paymentMethod: null,
        reference: "Payment recorded while updating bill",
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "BILL_UPDATED",
        resourceType: "BILL",
        resourceId: billId,
        metadata: {},
      },
    });
    return tx.bill.findUnique({ where: { id: billId }, include: billInclude });
  });

  return serializeBill(bill);
}

export async function recordBillPayment(user, billId, data) {
  const bill = await prisma.$transaction(async (tx) => {
    const existing = await tx.bill.findUnique({
      where: { id: billId },
      include: billInclude,
    });
    if (!existing) throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found.");
    assertCanRecordPayment(existing, user);

    const amount = decimal(data.amount);
    if (amount.lte(0)) {
      throw new ApiError(400, "INVALID_PAYMENT", "Payment amount must be greater than zero.");
    }
    if (amount.gt(existing.dueAmount)) {
      throw new ApiError(400, "OVERPAYMENT", "Payment cannot exceed the outstanding balance.");
    }

    const now = new Date();
    const paidAt = data.paidAt ? new Date(data.paidAt) : now;
    const paidAmount = existing.paidAmount.plus(amount).toDecimalPlaces(2);
    const dueAmount = existing.totalAmount.minus(paidAmount).toDecimalPlaces(2);
    const updated = await tx.bill.updateMany({
      where: {
        id: billId,
        updatedAt: existing.updatedAt,
        paidAmount: existing.paidAmount,
      },
      data: {
        paidAmount,
        dueAmount,
        paymentStatus: paymentStatusFor(paidAmount, existing.totalAmount),
        status: billStatusFor(paidAmount, existing.totalAmount),
        updatedAt: now,
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "BILL_CHANGED", "The bill changed while recording payment. Reload and try again.");
    }

    await createPaymentRecords(tx, {
      billId,
      amount,
      userId: user.id,
      paidAt,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "BILL_PAYMENT_RECORDED",
        resourceType: "BILL",
        resourceId: billId,
        metadata: { amount: amount.toString() },
      },
    });
    return tx.bill.findUnique({ where: { id: billId }, include: billInclude });
  });

  return serializeBill(bill);
}

export async function voidBill(user, billId) {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found.");
    assertCompanyAccess(user, bill.companyId);
    if (bill.status === "VOID") return { id: billId, status: "VOID" };

    const updated = await tx.bill.updateMany({
      where: { id: billId, updatedAt: bill.updatedAt },
      data: { status: "VOID", updatedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "BILL_CHANGED", "The bill changed while it was being voided. Reload and try again.");
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "BILL_VOIDED",
        resourceType: "BILL",
        resourceId: billId,
        metadata: {},
      },
    });
    return { id: billId, status: "VOID" };
  });
}
