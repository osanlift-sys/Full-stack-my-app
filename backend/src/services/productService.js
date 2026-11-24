import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { decimal } from "./billMath.js";
import { assertSellerAssignmentAllowed } from "./productAccess.js";

const productInclude = {
  category: { select: { id: true, name: true } },
  seller: {
    select: {
      id: true,
      user: { select: { id: true, name: true } },
    },
  },
  images: { orderBy: { createdAt: "asc" } },
};

function serializeProduct(product) {
  return {
    id: product.id,
    legacyId: product.legacyId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    seller: product.seller
      ? { id: product.seller.id, name: product.seller.user.name }
      : null,
    unit: product.unit,
    unitPrice: product.unitPrice.toString(),
    sellingPrice: product.sellingPrice.toString(),
    stockQuantity: product.stockQuantity.toString(),
    isPublic: product.isPublic,
    status: product.status,
    images: product.images.map(({ id, url, mimeType, sizeBytes }) => ({
      id,
      url,
      mimeType,
      sizeBytes,
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function assertCanManage(user) {
  if (
    user.role === "ADMIN" ||
    (user.role === "EMPLOYEE" && user.permissions.inventory_action_products === true) ||
    (user.role === "SELLER" && user.sellerId)
  ) return;
  throw new ApiError(403, "FORBIDDEN", "You do not have permission to manage products.");
}

function buildProductWhere(user, filters, { publicOnly = false } = {}) {
  const where = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.isPublic !== undefined ? { isPublic: filters.isPublic } : {}),
    ...(filters.search
      ? {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { sku: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      }
      : {}),
  };

  if (publicOnly || user.role === "CLIENT") {
    where.status = "ACTIVE";
    where.isPublic = true;
  } else if (user.role === "SELLER") {
    where.sellerId = user.sellerId;
  }
  return where;
}

async function validateCategory(tx, categoryId) {
  if (!categoryId) return;
  const category = await tx.productCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new ApiError(400, "INVALID_CATEGORY", "Product category not found.");
}

async function validateSeller(tx, sellerId) {
  if (!sellerId) return;
  const seller = await tx.sellerProfile.findFirst({
    where: { id: sellerId, status: "ACTIVE", user: { status: "ACTIVE" } },
    select: { id: true },
  });
  if (!seller) throw new ApiError(400, "INVALID_SELLER", "The selected seller is not active.");
}

function imageCreateData(images) {
  return images?.length
    ? { create: images.map((image) => ({ ...image })) }
    : undefined;
}

export async function listProducts(user, filters, { publicOnly = false } = {}) {
  if (!publicOnly && !["ADMIN", "EMPLOYEE", "SELLER", "CLIENT"].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view products.");
  }
  if (!publicOnly && user.role === "EMPLOYEE" && user.permissions.inventory_tab_products !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view products.");
  }

  const where = buildProductWhere(user, filters, { publicOnly });
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { name: "asc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items: products.map(serializeProduct),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}

export async function getProduct(user, productId) {
  const where = {
    id: productId,
    ...(user.role === "SELLER" ? { sellerId: user.sellerId } : {}),
    ...(user.role === "CLIENT" ? { status: "ACTIVE", isPublic: true } : {}),
  };
  if (user.role === "EMPLOYEE" && user.permissions.inventory_tab_products !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view products.");
  }
  const product = await prisma.product.findFirst({ where, include: productInclude });
  if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  return serializeProduct(product);
}

export async function createProduct(user, data) {
  assertCanManage(user);
  const product = await prisma.$transaction(async (tx) => {
    const categoryId = data.categoryId || null;
    await validateCategory(tx, categoryId);
    assertSellerAssignmentAllowed(user, data.sellerId);
    const sellerId = user.role === "SELLER" ? user.sellerId : data.sellerId || null;
    await validateSeller(tx, sellerId);
    const stockQuantity = decimal(data.stockQuantity || "0");
    const created = await tx.product.create({
      data: {
        sku: data.sku || null,
        name: data.name,
        description: data.description || null,
        categoryId,
        sellerId,
        unit: data.unit || null,
        unitPrice: decimal(data.unitPrice || "0"),
        sellingPrice: decimal(data.sellingPrice || "0"),
        stockQuantity,
        isPublic: data.isPublic ?? false,
        images: imageCreateData(data.images),
      },
    });
    if (stockQuantity.gt(0)) {
      await tx.inventoryMovement.create({
        data: {
          productId: created.id,
          quantity: stockQuantity,
          reason: "INITIAL_STOCK",
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PRODUCT_CREATED",
        resourceType: "PRODUCT",
        resourceId: created.id,
        metadata: { sellerId },
      },
    });
    return tx.product.findUnique({ where: { id: created.id }, include: productInclude });
  });
  return serializeProduct(product);
}

export async function updateProduct(user, productId, data) {
  assertCanManage(user);
  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, updatedAt: true },
    });
    if (!existing || (user.role === "SELLER" && existing.sellerId !== user.sellerId)) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    await validateCategory(tx, data.categoryId);
    assertSellerAssignmentAllowed(user, data.sellerId);
    if (data.sellerId) await validateSeller(tx, data.sellerId);
    const updated = await tx.product.updateMany({
      where: { id: productId, updatedAt: existing.updatedAt },
      data: {
        ...(data.sku !== undefined ? { sku: data.sku || null } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(user.role === "ADMIN" && data.sellerId !== undefined
          ? { sellerId: data.sellerId || null }
          : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.unitPrice !== undefined ? { unitPrice: decimal(data.unitPrice) } : {}),
        ...(data.sellingPrice !== undefined ? { sellingPrice: decimal(data.sellingPrice) } : {}),
        ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "PRODUCT_CHANGED", "The product changed while you were editing it. Reload and try again.");
    }
    if (data.images) {
      await tx.productImage.deleteMany({ where: { productId } });
      if (data.images.length) {
        await tx.productImage.createMany({
          data: data.images.map((image) => ({ ...image, productId })),
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PRODUCT_UPDATED",
        resourceType: "PRODUCT",
        resourceId: productId,
        metadata: {},
      },
    });
    return tx.product.findUnique({ where: { id: productId }, include: productInclude });
  });
  return serializeProduct(product);
}

export async function deactivateProduct(user, productId) {
  assertCanManage(user);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, updatedAt: true, status: true },
    });
    if (!existing || (user.role === "SELLER" && existing.sellerId !== user.sellerId)) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    if (existing.status === "INACTIVE") return { id: productId, status: "INACTIVE" };

    const result = await tx.product.updateMany({
      where: { id: productId, updatedAt: existing.updatedAt },
      data: { status: "INACTIVE", isPublic: false, updatedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new ApiError(409, "PRODUCT_CHANGED", "The product changed while it was being deactivated. Reload and try again.");
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PRODUCT_DEACTIVATED",
        resourceType: "PRODUCT",
        resourceId: productId,
        metadata: {},
      },
    });
    return { id: productId, status: "INACTIVE" };
  });
}

export async function adjustProductStock(user, productId, data) {
  assertCanManage(user);
  if (user.role === "EMPLOYEE" && user.permissions.inventory_action_stock !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to adjust stock.");
  }
  const quantity = decimal(data.quantity);
  if (quantity.lte(0)) {
    throw new ApiError(400, "INVALID_QUANTITY", "Stock adjustment quantity must be greater than zero.");
  }

  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, stockQuantity: true, updatedAt: true },
    });
    if (!existing || (user.role === "SELLER" && existing.sellerId !== user.sellerId)) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    const signedQuantity = data.direction === "IN" ? quantity : quantity.negated();
    const stockQuantity = existing.stockQuantity.plus(signedQuantity);
    if (stockQuantity.lt(0)) {
      throw new ApiError(409, "INSUFFICIENT_STOCK", "Stock cannot be reduced below zero.");
    }
    const result = await tx.product.updateMany({
      where: { id: productId, updatedAt: existing.updatedAt },
      data: { stockQuantity, updatedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new ApiError(409, "PRODUCT_CHANGED", "Stock changed while applying this adjustment. Reload and try again.");
    }
    await tx.inventoryMovement.create({
      data: {
        productId,
        quantity: signedQuantity,
        reason: data.reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PRODUCT_STOCK_ADJUSTED",
        resourceType: "PRODUCT",
        resourceId: productId,
        metadata: { direction: data.direction, quantity: quantity.toString(), reason: data.reason },
      },
    });
    return tx.product.findUnique({ where: { id: productId }, include: productInclude });
  });
  return serializeProduct(product);
}

export async function listProductCategories() {
  return prisma.productCategory.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createProductCategory(user, data) {
  assertCanManage(user);
  return prisma.$transaction(async (tx) => {
    const category = await tx.productCategory.create({
      data: { name: data.name },
      select: { id: true, name: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "PRODUCT_CATEGORY_CREATED",
        resourceType: "PRODUCT_CATEGORY",
        resourceId: category.id,
        metadata: {},
      },
    });
    return category;
  });
}
