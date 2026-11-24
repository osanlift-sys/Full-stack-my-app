import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { getSellerDashboard } from "./sellerService.js";

const paymentTransactionTypes = ["BILL_PAYMENT", "ORDER_PAYMENT"];

function dateBounds(filters) {
  return {
    ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
    ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
  };
}

function serializeFinancialTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    occurredAt: transaction.occurredAt.toISOString(),
    description: transaction.description,
  };
}

function aggregateAmount(value) {
  return (value || 0).toString();
}

export async function getDashboard(user) {
  if (user.role === "SELLER") return { role: user.role, ...(await getSellerDashboard(user)) };
  if (user.role === "CLIENT") {
    const companyIds = user.companyIds;
    const billWhere = { companyId: { in: companyIds }, status: { not: "VOID" } };
    const [billCount, billTotals, orderCount, openSupportCount] = await prisma.$transaction([
      prisma.bill.count({ where: billWhere }),
      prisma.bill.aggregate({
        where: billWhere,
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
      }),
      prisma.order.count({ where: { customerId: user.id } }),
      prisma.supportRequest.count({
        where: { requestedById: user.id, status: { in: ["OPEN", "IN_REVIEW", "QUOTED"] } },
      }),
    ]);
    return {
      role: user.role,
      billCount,
      billedAmount: aggregateAmount(billTotals._sum.totalAmount),
      paidAmount: aggregateAmount(billTotals._sum.paidAmount),
      outstandingAmount: aggregateAmount(billTotals._sum.dueAmount),
      orderCount,
      openSupportCount,
    };
  }
  if (user.role === "EMPLOYEE") {
    if (user.permissions.reports_tab_dashboard !== true) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to view this dashboard.");
    }
    if (!user.employeeId) {
      throw new ApiError(404, "EMPLOYEE_PROFILE_NOT_FOUND", "Employee profile not found.");
    }
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [attendance, pendingRequests, assignedProjects] = await prisma.$transaction([
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { employeeId: user.employeeId, date: { gte: monthStart, lt: nextMonthStart } },
        _count: { _all: true },
      }),
      prisma.attendanceRequest.count({
        where: { employeeId: user.employeeId, status: "PENDING" },
      }),
      prisma.projectEmployee.count({ where: { employeeId: user.employeeId } }),
    ]);
    return {
      role: user.role,
      month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
      attendance: Object.fromEntries(attendance.map((row) => [row.status, row._count._all])),
      pendingAttendanceRequests: pendingRequests,
      assignedProjectCount: assignedProjects,
    };
  }
  if (user.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view this dashboard.");
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [userCounts, activeProducts, billTotals, monthlyCollections, orders, openSupportRequests] =
    await prisma.$transaction([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.bill.aggregate({
        where: { status: { not: "VOID" } },
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
        _count: { _all: true },
      }),
      prisma.financialTransaction.aggregate({
        where: {
          type: { in: paymentTransactionTypes },
          occurredAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.supportRequest.count({ where: { status: { in: ["OPEN", "IN_REVIEW", "QUOTED"] } } }),
    ]);

  return {
    role: user.role,
    usersByRole: Object.fromEntries(userCounts.map((row) => [row.role, row._count._all])),
    activeProductCount: activeProducts,
    bills: {
      count: billTotals._count._all,
      total: aggregateAmount(billTotals._sum.totalAmount),
      paid: aggregateAmount(billTotals._sum.paidAmount),
      outstanding: aggregateAmount(billTotals._sum.dueAmount),
    },
    collectionsThisMonth: aggregateAmount(monthlyCollections._sum.amount),
    ordersByStatus: Object.fromEntries(orders.map((row) => [row.status, row._count._all])),
    openSupportRequests,
  };
}

export async function getFinancialReport(user, filters) {
  if (
    user.role !== "ADMIN" &&
    !(user.role === "EMPLOYEE" && user.permissions.reports_action_financial === true)
  ) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view financial reports.");
  }
  const [transactions, outstandingBills, orders] = await prisma.$transaction([
    prisma.financialTransaction.groupBy({
      by: ["type", "currency"],
      where: { occurredAt: dateBounds(filters) },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.bill.aggregate({
      where: {
        status: { not: "VOID" },
        dueAmount: { gt: 0 },
      },
      _sum: { dueAmount: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    transactions: transactions.map((row) => ({
      type: row.type,
      currency: row.currency,
      amount: aggregateAmount(row._sum.amount),
      count: row._count._all,
    })),
    outstandingBills: {
      amount: aggregateAmount(outstandingBills._sum.dueAmount),
      count: outstandingBills._count._all,
    },
    ordersByStatus: Object.fromEntries(orders.map((row) => [row.status, row._count._all])),
  };
}

export async function listOutstandingBills(user, filters) {
  if (!["ADMIN", "EMPLOYEE", "CLIENT"].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view outstanding bills.");
  }
  if (user.role === "EMPLOYEE" && user.permissions.reports_action_financial !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view outstanding bills.");
  }
  const where = {
    status: { not: "VOID" },
    dueAmount: { gt: 0 },
    ...(user.role === "CLIENT" ? { companyId: { in: user.companyIds } } : {}),
  };
  const [bills, total] = await prisma.$transaction([
    prisma.bill.findMany({
      where,
      select: {
        id: true,
        billNo: true,
        billDate: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { billDate: "asc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.bill.count({ where }),
  ]);
  return {
    items: bills.map((bill) => ({
      ...bill,
      totalAmount: bill.totalAmount.toString(),
      paidAmount: bill.paidAmount.toString(),
      dueAmount: bill.dueAmount.toString(),
      billDate: bill.billDate?.toISOString() || null,
    })),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}

export async function listTransactions(user, filters) {
  if (!["ADMIN", "EMPLOYEE", "CLIENT"].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view transactions.");
  }
  if (user.role === "EMPLOYEE" && user.permissions.reports_action_financial !== true) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to view transactions.");
  }

  let where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from || filters.to ? { occurredAt: dateBounds(filters) } : {}),
  };
  if (user.role === "CLIENT") {
    const [bills, orders] = await prisma.$transaction([
      prisma.bill.findMany({
        where: { companyId: { in: user.companyIds } },
        select: { id: true },
      }),
      prisma.order.findMany({
        where: { customerId: user.id },
        select: { id: true },
      }),
    ]);
    where = {
      ...where,
      OR: [
        { referenceType: "BILL", referenceId: { in: bills.map(({ id }) => id) } },
        { referenceType: "ORDER", referenceId: { in: orders.map(({ id }) => id) } },
      ],
    };
  }
  const [transactions, total] = await prisma.$transaction([
    prisma.financialTransaction.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.financialTransaction.count({ where }),
  ]);
  return {
    items: transactions.map(serializeFinancialTransaction),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}
