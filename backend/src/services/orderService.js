import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { decimal } from "./billMath.js";
import { calculateSellerCommission, canTransitionOrder } from "./orderRules.js";

const orderInclude = {
  items: {
    include: { product: { select: { id: true, name: true, sku: true } } },
    orderBy: { id: "asc" },
  },
  payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
  company: { select: { id: true, name: true } },
};

function assertOrderReadAccess(user, order) {
  if (user.role === "ADMIN") return;
  if (user.role === "EMPLOYEE" && user.permissions.orders_tab_manage === true) return;
  if (user.role === "EMPLOYEE") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view orders.");
  }
  if (user.role !== "CLIENT" || order.customerId !== user.id) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  }
}

function serializeOrder(order) {
  const paidAmount = order.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    decimal("0")
  );
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    company: order.company,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.description,
      sku: item.product?.sku || null,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      total: item.total.toString(),
    })),
    subtotal: order.subtotal.toString(),
    totalAmount: order.totalAmount.toString(),
    paidAmount: paidAmount.toString(),
    dueAmount: order.totalAmount.minus(paidAmount).toString(),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toString(),
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      paidAt: payment.paidAt?.toISOString() || null,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function writeAudit(tx, user, action, orderId, metadata = {}) {
  await tx.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action,
      resourceType: "ORDER",
      resourceId: orderId,
      metadata,
    },
  });
}

export async function listOrders(user, filters) {
  if (!["ADMIN", "EMPLOYEE", "CLIENT"].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view orders.");
  }
  if (user.role === "EMPLOYEE" && user.permissions.orders_tab_manage !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view orders.");
  }

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(user.role === "CLIENT" ? { customerId: user.id } : {}),
  };
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: orders.map(serializeOrder),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}

export async function getOrder(user, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  assertOrderReadAccess(user, order);
  return serializeOrder(order);
}

export async function checkout(user, data) {
  if (user.role !== "CLIENT") {
    throw new ApiError(403, "CLIENT_CHECKOUT_REQUIRED", "Only an authenticated client can place an order.");
  }
  if (!user.companyIds.includes(data.companyId)) {
    throw new ApiError(404, "COMPANY_NOT_FOUND", "The selected company is not associated with this account.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findFirst({
      where: { id: data.companyId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!company) throw new ApiError(409, "COMPANY_INACTIVE", "The selected company is not active.");

    const productIds = data.items.map(({ productId }) => productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new ApiError(400, "DUPLICATE_ORDER_ITEM", "Each product may only appear once in the cart.");
    }

    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        status: "ACTIVE",
        isPublic: true,
      },
      select: {
        id: true,
        name: true,
        sellingPrice: true,
        stockQuantity: true,
        updatedAt: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new ApiError(400, "PRODUCT_UNAVAILABLE", "One or more products are unavailable.");
    }

    const items = data.items.map((item) => {
      const product = products.find(({ id }) => id === item.productId);
      const quantity = decimal(item.quantity);
      const total = quantity.mul(product.sellingPrice).toDecimalPlaces(2);
      return { product, quantity, total };
    });
    const totalAmount = items.reduce((sum, item) => sum.plus(item.total), decimal("0"))
      .toDecimalPlaces(2);
    if (totalAmount.lte(0)) {
      throw new ApiError(400, "INVALID_ORDER_TOTAL", "Order total must be greater than zero.");
    }

    const order = await tx.order.create({
      data: {
        customerId: user.id,
        companyId: data.companyId,
        status: "PENDING",
        paymentStatus: "PENDING",
        subtotal: totalAmount,
        totalAmount,
      },
    });

    for (const item of items) {
      const stock = item.product.stockQuantity;
      const remainingStock = stock.minus(item.quantity);
      if (remainingStock.lt(0)) {
        throw new ApiError(409, "INSUFFICIENT_STOCK", `${item.product.name} has insufficient stock.`);
      }
      const updated = await tx.product.updateMany({
        where: {
          id: item.product.id,
          status: "ACTIVE",
          isPublic: true,
          updatedAt: item.product.updatedAt,
          stockQuantity: stock,
        },
        data: { stockQuantity: remainingStock, updatedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new ApiError(409, "STOCK_CHANGED", `${item.product.name} stock changed. Review your cart and retry.`);
      }

      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.product.id,
          description: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.sellingPrice,
          total: item.total,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.product.id,
          orderItemId: orderItem.id,
          quantity: item.quantity.negated(),
          reason: "ORDER_CHECKOUT",
        },
      });
    }

    await writeAudit(tx, user, "ORDER_CREATED", order.id, { itemCount: items.length });
    return tx.order.findUnique({ where: { id: order.id }, include: orderInclude });
  });

  return serializeOrder(order);
}

export async function recordOrderPayment(user, orderId, data) {
  if (user.role === "EMPLOYEE" && user.permissions.orders_action_manage !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to record order payments.");
  }
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!existing) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    if (existing.status === "CANCELLED") {
      throw new ApiError(409, "ORDER_CANCELLED", "Payments cannot be recorded for a cancelled order.");
    }

    const paidAmount = existing.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      decimal("0")
    );
    const amount = decimal(data.amount);
    const dueAmount = existing.totalAmount.minus(paidAmount);
    if (amount.gt(dueAmount)) {
      throw new ApiError(400, "OVERPAYMENT", "Payment cannot exceed the outstanding order balance.");
    }
    const nextPaid = paidAmount.plus(amount).toDecimalPlaces(2);
    const paymentStatus = nextPaid.gte(existing.totalAmount) ? "PAID" : "PARTIALLY_PAID";
    const now = new Date();
    const updated = await tx.order.updateMany({
      where: { id: orderId, updatedAt: existing.updatedAt },
      data: { paymentStatus, updatedAt: now },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "ORDER_CHANGED", "The order changed while recording payment. Reload and try again.");
    }

    const paidAt = data.paidAt ? new Date(data.paidAt) : now;
    await tx.payment.create({
      data: {
        orderId,
        amount,
        currency: "BDT",
        status: "PAID",
        paymentMethod: data.paymentMethod,
        reference: data.reference || null,
        recordedById: user.id,
        paidAt,
      },
    });
    await tx.financialTransaction.create({
      data: {
        type: "ORDER_PAYMENT",
        referenceType: "ORDER",
        referenceId: orderId,
        amount,
        currency: "BDT",
        occurredAt: paidAt,
        description: `Order payment (${data.paymentMethod})`,
        legacyData: {},
      },
    });
    await writeAudit(tx, user, "ORDER_PAYMENT_RECORDED", orderId, {
      amount: amount.toString(),
    });
    return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
  });
  return serializeOrder(order);
}

async function restoreOrderStock(tx, order) {
  for (const item of order.items) {
    if (!item.productId) continue;
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQuantity: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        orderItemId: item.id,
        quantity: item.quantity,
        reason: "ORDER_CANCELLED",
      },
    });
  }
}

async function createSellerSales(tx, order) {
  for (const item of order.items) {
    if (!item.product?.seller) continue;
    const grossAmount = item.total;
    const commissionAmount = calculateSellerCommission(
      grossAmount,
      item.product.seller.commissionRate
    );
    await tx.sellerSale.create({
      data: {
        sellerId: item.product.seller.id,
        productId: item.product.id,
        orderItemId: item.id,
        quantity: item.quantity,
        grossAmount,
        commissionAmount,
      },
    });
  }
}

export async function updateOrderStatus(user, orderId, status) {
  if (user.role === "EMPLOYEE" && user.permissions.orders_action_manage !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to manage orders.");
  }
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        ...orderInclude,
        items: {
          include: {
            product: {
              include: { seller: { select: { id: true, commissionRate: true } } },
            },
          },
        },
      },
    });
    if (!existing) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    if (!canTransitionOrder(existing.status, status)) {
      throw new ApiError(409, "INVALID_ORDER_TRANSITION", `Order cannot transition from ${existing.status} to ${status}.`);
    }
    if (status === "COMPLETED" && existing.paymentStatus !== "PAID") {
      throw new ApiError(409, "ORDER_NOT_PAID", "An order must be fully paid before completion.");
    }
    if (status === "CANCELLED" && existing.payments.some((payment) => payment.status === "PAID")) {
      throw new ApiError(409, "PAYMENT_REFUND_REQUIRED", "A paid order must be refunded before cancellation.");
    }

    const updated = await tx.order.updateMany({
      where: { id: orderId, updatedAt: existing.updatedAt },
      data: { status, updatedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "ORDER_CHANGED", "The order changed while updating its status. Reload and try again.");
    }
    if (status === "CANCELLED") await restoreOrderStock(tx, existing);
    if (status === "COMPLETED") await createSellerSales(tx, existing);
    await writeAudit(tx, user, `ORDER_${status}`, orderId);
    return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
  });
  return serializeOrder(order);
}
