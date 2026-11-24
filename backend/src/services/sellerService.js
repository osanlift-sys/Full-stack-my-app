import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";

function requireSeller(user) {
  if (user.role !== "SELLER" || !user.sellerId) {
    throw new ApiError(403, "SELLER_PROFILE_REQUIRED", "A seller profile is required.");
  }
}

function serializeSale(sale) {
  return {
    id: sale.id,
    product: sale.product,
    quantity: sale.quantity.toString(),
    grossAmount: sale.grossAmount.toString(),
    commissionAmount: sale.commissionAmount.toString(),
    soldAt: sale.soldAt.toISOString(),
  };
}

export async function getSellerDashboard(user) {
  requireSeller(user);
  const [seller, products, salesCount, totals, recentSales] = await prisma.$transaction([
    prisma.sellerProfile.findUnique({
      where: { id: user.sellerId },
      select: { id: true, commissionRate: true, status: true },
    }),
    prisma.product.count({ where: { sellerId: user.sellerId, status: "ACTIVE" } }),
    prisma.sellerSale.count({ where: { sellerId: user.sellerId } }),
    prisma.sellerSale.aggregate({
      where: { sellerId: user.sellerId },
      _sum: { grossAmount: true, commissionAmount: true },
    }),
    prisma.sellerSale.findMany({
      where: { sellerId: user.sellerId },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { soldAt: "desc" },
      take: 10,
    }),
  ]);
  if (!seller || seller.status !== "ACTIVE") {
    throw new ApiError(403, "SELLER_PROFILE_INACTIVE", "The seller profile is not active.");
  }
  return {
    sellerId: seller.id,
    commissionRate: seller.commissionRate.toString(),
    productCount: products,
    saleCount: salesCount,
    grossSales: (totals._sum.grossAmount || 0).toString(),
    commissionEarned: (totals._sum.commissionAmount || 0).toString(),
    recentSales: recentSales.map(serializeSale),
  };
}

export async function listSellerSales(user, filters) {
  requireSeller(user);
  const where = { sellerId: user.sellerId };
  const [sales, total] = await prisma.$transaction([
    prisma.sellerSale.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { soldAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.sellerSale.count({ where }),
  ]);
  return {
    items: sales.map(serializeSale),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}
