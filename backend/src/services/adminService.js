import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { normalizeCompanyName, normalizeEmail, toPublicUser } from "../utils/identity.js";

const listUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  photoUrl: true,
  requestedCompanyName: true,
  emailVerifiedAt: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      designation: true,
      phone: true,
      approvalStatus: true,
      baseSalary: true,
      address: true,
    },
  },
  permissions: { select: { key: true, enabled: true } },
  seller: {
    select: { id: true, commissionRate: true, status: true },
  },
  clientMemberships: {
    select: { company: { select: { id: true, name: true } } },
  },
};

function audit(tx, actor, action, resourceType, resourceId, metadata = {}) {
  return tx.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      resourceType,
      resourceId,
      metadata,
    },
  });
}

function toManagedUser(user) {
  return {
    ...toPublicUser(user),
    requestedCompanyName: user.requestedCompanyName,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    employee: user.employee,
    seller: user.seller,
    companies: user.clientMemberships.map(({ company }) => company),
  };
}

export async function listUsers(filters) {
  const where = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
        OR: [
          { email: { contains: filters.search, mode: "insensitive" } },
          { name: { contains: filters.search, mode: "insensitive" } },
        ],
      }
      : {}),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: listUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: users.map(toManagedUser),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}

export async function getUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: listUserSelect,
  });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  return toManagedUser(user);
}

export async function updateEmployeeProfile(actor, userId, data) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    if (user.role !== "EMPLOYEE") {
      throw new ApiError(409, "PROFILE_EMPLOYEE_ONLY", "Only employee profiles can be managed through this endpoint.");
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
      },
    });

    const employeeData = {
      ...(data.designation !== undefined ? { designation: data.designation } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
    };
    if (Object.keys(employeeData).length) {
      await tx.employeeProfile.upsert({
        where: { userId },
        create: { userId, approvalStatus: "PENDING", ...employeeData },
        update: employeeData,
      });
    }

    await audit(tx, actor, "EMPLOYEE_PROFILE_UPDATED", "USER", userId, {
      fields: Object.keys(data),
    });

    return toManagedUser(await tx.user.findUnique({
      where: { id: userId },
      select: listUserSelect,
    }));
  });
}

export async function listEmployeeRequests() {
  const users = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      employee: { is: { approvalStatus: "PENDING" } },
    },
    select: listUserSelect,
    orderBy: { createdAt: "asc" },
  });
  return users.map(toManagedUser);
}

export async function reviewEmployeeRequest(actor, employeeId, decision) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employeeProfile.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });
    if (!employee) throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    if (employee.approvalStatus !== "PENDING") {
      throw new ApiError(409, "REQUEST_ALREADY_REVIEWED", "This employee request has already been reviewed.");
    }

    const now = new Date();
    const status = decision === "REJECTED"
      ? "REJECTED"
      : employee.user.emailVerifiedAt
        ? "ACTIVE"
        : "PENDING";
    await tx.employeeProfile.update({
      where: { id: employee.id },
      data: {
        approvalStatus: decision,
        approvedAt: decision === "APPROVED" ? now : null,
      },
    });
    const user = await tx.user.update({
      where: { id: employee.userId },
      data: { status },
      select: listUserSelect,
    });
    if (status !== "ACTIVE") {
      await tx.refreshToken.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    await audit(tx, actor, `EMPLOYEE_${decision}`, "EMPLOYEE", employee.id);
    return toManagedUser(user);
  });
}

export async function updateAccountStatus(actor, userId, status, companyId) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        seller: true,
        clientMemberships: true,
      },
    });
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    if (userId === actor.id) {
      throw new ApiError(400, "SELF_STATUS_CHANGE_FORBIDDEN", "You cannot change your own account status.");
    }

    if (status === "ACTIVE") {
      if (!user.emailVerifiedAt) {
        throw new ApiError(409, "EMAIL_NOT_VERIFIED", "The user must verify their email before activation.");
      }
      if (user.role === "EMPLOYEE" && user.employee?.approvalStatus !== "APPROVED") {
        throw new ApiError(409, "EMPLOYEE_NOT_APPROVED", "The employee request must be approved before activation.");
      }
      if (user.role === "CLIENT" && companyId) {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { id: true, status: true },
        });
        if (!company || company.status !== "ACTIVE") {
          throw new ApiError(400, "CLIENT_COMPANY_INVALID", "Select an active company for this client.");
        }
        await tx.clientMembership.upsert({
          where: { userId_companyId: { userId, companyId } },
          create: { userId, companyId },
          update: {},
        });
      }
      if (user.role === "CLIENT" && user.clientMemberships.length === 0 && !companyId) {
        throw new ApiError(409, "CLIENT_COMPANY_REQUIRED", "Select a company before approving this client.");
      }
      if (user.role === "SELLER" && !user.seller) {
        throw new ApiError(409, "SELLER_PROFILE_REQUIRED", "A seller profile is required before activation.");
      }
    }

    if (user.role === "ADMIN" && user.status === "ACTIVE" && status !== "ACTIVE") {
      const activeAdmins = await tx.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });
      if (activeAdmins <= 1) {
        throw new ApiError(409, "LAST_ACTIVE_ADMIN", "The last active administrator cannot be suspended.");
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { status },
    });
    if (user.role === "SELLER" && user.seller) {
      await tx.sellerProfile.update({
        where: { id: user.seller.id },
        data: { status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE" },
      });
    }
    if (status !== "ACTIVE") {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await audit(tx, actor, `ACCOUNT_${status}`, "USER", userId, companyId ? { companyId } : {});
    return toManagedUser(await tx.user.findUnique({
      where: { id: userId },
      select: listUserSelect,
    }));
  });
}

export async function assignRole(actor, userId, role) {
  if (userId === actor.id) {
    throw new ApiError(400, "SELF_ROLE_CHANGE_FORBIDDEN", "You cannot change your own role.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        seller: true,
        clientMemberships: true,
      },
    });
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    if (user.role === role) return toManagedUser(await tx.user.findUnique({
      where: { id: userId },
      select: listUserSelect,
    }));

    if (user.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new ApiError(409, "LAST_ADMIN", "The last administrator cannot be demoted.");
      }
    }
    if (role === "ADMIN" && (!user.emailVerifiedAt || user.status !== "ACTIVE")) {
      throw new ApiError(409, "ADMIN_ACCOUNT_REQUIREMENTS", "Only an active, email-verified account can be made an administrator.");
    }
    if (role === "CLIENT" && user.clientMemberships.length === 0) {
      throw new ApiError(409, "CLIENT_COMPANY_REQUIRED", "A client must be associated with an authorized company.");
    }

    let status = user.status;
    if (role === "EMPLOYEE") {
      const employee = await tx.employeeProfile.upsert({
        where: { userId },
        create: { userId, approvalStatus: "PENDING" },
        update: {},
      });
      if (employee.approvalStatus !== "APPROVED" || !user.emailVerifiedAt) status = "PENDING";
    } else if (role === "SELLER") {
      await tx.sellerProfile.upsert({
        where: { userId },
        create: { userId },
        update: { status: "ACTIVE" },
      });
    }
    if (role === "CLIENT" && !user.emailVerifiedAt) status = "PENDING";

    await tx.user.update({
      where: { id: userId },
      data: { role, status },
    });
    if (user.role === "SELLER" && role !== "SELLER") {
      await tx.sellerProfile.update({
        where: { id: user.seller.id },
        data: { status: "INACTIVE" },
      });
    }
    if (status !== "ACTIVE" || role !== user.role) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await audit(tx, actor, "USER_ROLE_CHANGED", "USER", userId, { from: user.role, to: role });

    return toManagedUser(await tx.user.findUnique({
      where: { id: userId },
      select: listUserSelect,
    }));
  });
}

export async function updateSellerCommission(actor, sellerId, commissionRate) {
  return prisma.$transaction(async (tx) => {
    const seller = await tx.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { id: true, commissionRate: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!seller) throw new ApiError(404, "SELLER_NOT_FOUND", "Seller not found.");

    const updated = await tx.sellerProfile.update({
      where: { id: sellerId },
      data: { commissionRate },
      select: { id: true, commissionRate: true, status: true },
    });
    await audit(tx, actor, "SELLER_COMMISSION_UPDATED", "SELLER", sellerId, {
      commissionRate,
    });
    return {
      ...updated,
      commissionRate: updated.commissionRate.toString(),
      user: seller.user,
    };
  });
}

export async function updateUserPermissions(actor, userId, permissions) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    if (user.role !== "EMPLOYEE") {
      throw new ApiError(409, "PERMISSIONS_EMPLOYEE_ONLY", "Granular feature permissions are assigned to employees.");
    }

    for (const [key, enabled] of Object.entries(permissions)) {
      await tx.userPermission.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, enabled },
        update: { enabled },
      });
    }
    await audit(tx, actor, "USER_PERMISSIONS_UPDATED", "USER", userId, { keys: Object.keys(permissions) });

    return tx.userPermission.findMany({
      where: { userId },
      orderBy: { key: "asc" },
      select: { key: true, enabled: true },
    });
  });
}

export async function listCompanies() {
  return prisma.company.findMany({
    select: { id: true, name: true, normalizedName: true, status: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function listClientContacts(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");
  return prisma.clientAuthorizedContact.findMany({
    where: { companyId },
    select: {
      id: true,
      companyId: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
    },
    orderBy: { email: "asc" },
  });
}

export async function createCompany(actor, data) {
  const normalizedName = normalizeCompanyName(data.name);
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        ...data,
        email: data.email ? normalizeEmail(data.email) : undefined,
        normalizedName,
      },
      select: { id: true, name: true, normalizedName: true, status: true },
    });
    await audit(tx, actor, "COMPANY_CREATED", "COMPANY", company.id);
    return company;
  });
}

export async function addClientContact(actor, companyId, { email, name }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw new ApiError(404, "COMPANY_NOT_FOUND", "Company not found.");

  const normalizedEmail = normalizeEmail(email);
  return prisma.$transaction(async (tx) => {
    const contact = await tx.clientAuthorizedContact.create({
      data: {
        companyId,
        email: normalizedEmail,
        normalizedEmail,
        name,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        name: true,
        status: true,
      },
    });
    await audit(tx, actor, "CLIENT_CONTACT_AUTHORIZED", "CLIENT_CONTACT", contact.id, { companyId });
    return contact;
  });
}

export async function setClientContactStatus(actor, contactId, status) {
  return prisma.$transaction(async (tx) => {
    const contact = await tx.clientAuthorizedContact.update({
      where: { id: contactId },
      data: { status },
      select: { id: true, companyId: true, email: true, name: true, status: true },
    });
    await audit(tx, actor, `CLIENT_CONTACT_${status}`, "CLIENT_CONTACT", contact.id);
    return contact;
  });
}
