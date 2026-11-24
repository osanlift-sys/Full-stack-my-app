import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { normalizeCompanyName } from "../utils/identity.js";
import { decimal } from "./billMath.js";
import { calculateOfferTotals } from "./offerMath.js";

const offerInclude = {
  company: { select: { id: true, name: true, normalizedName: true, legacyId: true } },
  items: { orderBy: { position: "asc" } },
};

function assertOfferReadAccess(user, companyId) {
  if (user.role === "ADMIN") return;
  if (user.role === "EMPLOYEE" && user.permissions.clients_tab_offer === true) return;
  if (user.role === "CLIENT" && user.companyIds.includes(companyId)) return;
  if (user.role === "CLIENT") {
    throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found.");
  }
  throw new ApiError(403, "FORBIDDEN", "You do not have permission to view offers.");
}

function serializeOffer(offer) {
  const legacyData = offer.legacyData && typeof offer.legacyData === "object"
    ? offer.legacyData
    : {};

  return {
    ...legacyData,
    id: offer.id,
    docId: offer.id,
    companyId: offer.companyId,
    companyDocId: offer.company.legacyId || offer.company.name.trim().replace(/\s+/g, "_"),
    companyName: offer.company.name,
    offerNo: offer.offerNo || offer.id,
    subject: offer.subject || "",
    headerData: offer.headerData,
    items: offer.items.map((item) => ({
      ...item.legacyData,
      productId: item.productId,
      name: item.description,
      quantity: item.quantity.toString(),
      unit: item.unit || "Pcs",
      price: item.unitPrice.toString(),
    })),
    notes: Array.isArray(legacyData.notes) ? legacyData.notes : [],
    paymentMode: legacyData.paymentMode || {},
    subtotal: offer.subtotal.toString(),
    discountAmount: offer.discountAmount.toString(),
    grandTotal: offer.totalAmount.toString(),
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  };
}

function buildOfferWhere(user, filters) {
  const where = {
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.search
      ? {
        OR: [
          { offerNo: { contains: filters.search, mode: "insensitive" } },
          { subject: { contains: filters.search, mode: "insensitive" } },
          { company: { name: { contains: filters.search, mode: "insensitive" } } },
        ],
      }
      : {}),
  };
  if (user.role === "CLIENT") {
    where.companyId = { in: user.companyIds };
  }
  return where;
}

async function resolveCompany(tx, data) {
  const submittedNames = [data.companyName, data.headerData?.toCompany].filter(Boolean);
  if (
    submittedNames.length > 1 &&
    normalizeCompanyName(submittedNames[0]) !== normalizeCompanyName(submittedNames[1])
  ) {
    throw new ApiError(400, "COMPANY_MISMATCH", "Offer company fields must refer to the same company.");
  }

  if (data.companyId) {
    const company = await tx.company.findUnique({ where: { id: data.companyId } });
    if (!company) throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
    if (company.status !== "ACTIVE") {
      throw new ApiError(409, "COMPANY_INACTIVE", "The selected company is not active.");
    }
    if (
      data.headerData?.toCompany &&
      normalizeCompanyName(data.headerData.toCompany) !== company.normalizedName
    ) {
      throw new ApiError(400, "COMPANY_MISMATCH", "Offer header company must match the selected company.");
    }
    return company;
  }

  const name = (data.companyName || data.headerData?.toCompany || "").trim();
  if (!name) throw new ApiError(400, "COMPANY_REQUIRED", "A company is required.");
  const company = await tx.company.upsert({
    where: { normalizedName: normalizeCompanyName(name) },
    create: { name, normalizedName: normalizeCompanyName(name) },
    update: {},
  });
  if (company.status !== "ACTIVE") {
    throw new ApiError(409, "COMPANY_INACTIVE", "The selected company is not active.");
  }
  return company;
}

async function validateProducts(tx, items) {
  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  if (!productIds.length) return;
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, status: "ACTIVE" },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    throw new ApiError(400, "INVALID_PRODUCT", "One or more selected products are unavailable.");
  }
}

function toOfferItems(items, offerId) {
  return items.map((item, position) => {
    const {
      productId,
      name,
      quantity,
      unit,
      price,
      ...legacyData
    } = item;
    return {
      ...(offerId ? { offerId } : {}),
      position,
      productId: productId || null,
      description: name,
      quantity: decimal(quantity),
      unitPrice: decimal(price),
      total: decimal(quantity).mul(decimal(price)).toDecimalPlaces(2),
      unit: unit || "Pcs",
      legacyData,
    };
  });
}

function offerLegacyData(existing, data) {
  const knownFields = new Set([
    "companyId",
    "companyName",
    "headerData",
    "items",
    "notes",
    "paymentMode",
    "discountAmount",
    "subtotal",
    "grandTotal",
  ]);
  const extraFields = Object.fromEntries(
    Object.entries(data).filter(([key]) => !knownFields.has(key))
  );
  return {
    ...existing,
    ...extraFields,
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.paymentMode !== undefined ? { paymentMode: data.paymentMode } : {}),
  };
}

export async function listOffers(user, filters) {
  if (user.role === "EMPLOYEE" && user.permissions.clients_tab_offer !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view offers.");
  }
  if (
    user.role === "CLIENT" &&
    filters.companyId &&
    !user.companyIds.includes(filters.companyId)
  ) {
    throw new ApiError(404, "OFFER_NOT_FOUND", "Offers not found.");
  }

  const where = buildOfferWhere(user, filters);
  const [offers, total] = await prisma.$transaction([
    prisma.offer.findMany({
      where,
      include: offerInclude,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.offer.count({ where }),
  ]);
  return { items: offers.map(serializeOffer), page: filters.page, limit: filters.limit, total };
}

export async function getOffer(user, offerId) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: offerInclude,
  });
  if (!offer) throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found.");
  assertOfferReadAccess(user, offer.companyId);
  return serializeOffer(offer);
}

export async function createOffer(user, data) {
  const offer = await prisma.$transaction(async (tx) => {
    const company = await resolveCompany(tx, data);
    await validateProducts(tx, data.items);
    const totals = calculateOfferTotals(data.items, data.discountAmount || "0");
    const counter = await tx.systemCounter.upsert({
      where: { key: "offerId" },
      create: { key: "offerId", value: 10000001 },
      update: { value: { increment: 1 } },
    });
    const headerData = {
      ...data.headerData,
      toCompany: data.headerData.toCompany || company.name,
    };
    const legacyData = offerLegacyData({}, data);
    const created = await tx.offer.create({
      data: {
        companyId: company.id,
        createdById: user.id,
        offerNo: String(counter.value),
        subject: headerData.subject || null,
        offerDate: new Date(),
        subtotal: totals.subtotal,
        discountAmount: totals.discount,
        totalAmount: totals.total,
        headerData,
        legacyData,
        items: { create: toOfferItems(data.items) },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "OFFER_CREATED",
        resourceType: "OFFER",
        resourceId: created.id,
        metadata: { companyId: company.id, offerNo: created.offerNo },
      },
    });
    return tx.offer.findUnique({ where: { id: created.id }, include: offerInclude });
  });
  return serializeOffer(offer);
}

export async function updateOffer(user, offerId, data) {
  const offer = await prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });
    if (!existing) throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found.");
    if (user.role !== "ADMIN" && user.permissions.clients_action_update !== true) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to update offers.");
    }
    if (data.companyId && data.companyId !== existing.companyId) {
      throw new ApiError(400, "COMPANY_CHANGE_NOT_ALLOWED", "An offer cannot be moved to another company.");
    }
    const nextHeader = data.headerData
      ? { ...existing.headerData, ...data.headerData }
      : existing.headerData;
    if (
      data.companyName &&
      normalizeCompanyName(data.companyName) !== existing.company.normalizedName
    ) {
      throw new ApiError(400, "COMPANY_CHANGE_NOT_ALLOWED", "An offer cannot be moved to another company.");
    }
    if (
      data.headerData?.toCompany &&
      normalizeCompanyName(data.headerData.toCompany) !== existing.company.normalizedName
    ) {
      throw new ApiError(400, "COMPANY_CHANGE_NOT_ALLOWED", "An offer cannot be moved to another company.");
    }

    const nextItems = data.items || existing.items.map((item) => ({
      ...item.legacyData,
      productId: item.productId || undefined,
      name: item.description,
      quantity: item.quantity.toString(),
      unit: item.unit || "Pcs",
      price: item.unitPrice.toString(),
    }));
    await validateProducts(tx, nextItems);
    const totals = calculateOfferTotals(
      nextItems,
      data.discountAmount ?? existing.discountAmount.toString()
    );
    const updated = await tx.offer.updateMany({
      where: { id: offerId, updatedAt: existing.updatedAt },
      data: {
        ...(data.headerData ? { headerData: nextHeader } : {}),
        subject: nextHeader.subject || existing.subject,
        subtotal: totals.subtotal,
        discountAmount: totals.discount,
        totalAmount: totals.total,
        legacyData: offerLegacyData(existing.legacyData, data),
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "OFFER_CHANGED", "The offer changed while you were editing it. Reload and try again.");
    }
    if (data.items) {
      await tx.offerItem.deleteMany({ where: { offerId } });
      await tx.offerItem.createMany({ data: toOfferItems(data.items, offerId) });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "OFFER_UPDATED",
        resourceType: "OFFER",
        resourceId: offerId,
        metadata: {},
      },
    });
    return tx.offer.findUnique({ where: { id: offerId }, include: offerInclude });
  });
  return serializeOffer(offer);
}

export async function deleteOffer(user, offerId) {
  if (user.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "Only administrators can delete offers.");
  }
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "OFFER_DELETED",
        resourceType: "OFFER",
        resourceId: offerId,
        metadata: { offerNo: offer.offerNo },
      },
    });
    await tx.offer.delete({ where: { id: offerId } });
    return { id: offerId };
  });
}

export async function listOfferProducts(search = "") {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
    },
    select: { id: true, name: true, unit: true, sellingPrice: true },
    orderBy: { name: "asc" },
    take: 100,
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    ItemsName: product.name,
    itemsName: product.name,
    unit: product.unit || "Pcs",
    SellingPrice: product.sellingPrice.toString(),
    sellingPrice: product.sellingPrice.toString(),
    SalingPrice: product.sellingPrice.toString(),
    salingPrice: product.sellingPrice.toString(),
  }));
}
export async function listPurchaseProducts(search = "") {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      stockQuantity: { gt: 0 },
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
    },
    select: { id: true, name: true, unit: true, sellingPrice: true, stockQuantity: true },
    orderBy: { name: "asc" },
    take: 100,
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    ItemsName: product.name,
    itemsName: product.name,
    unit: product.unit || "Pcs",
    SellingPrice: product.sellingPrice.toString(),
    sellingPrice: product.sellingPrice.toString(),
    stockQuantity: product.stockQuantity.toString(),
  }));
}

