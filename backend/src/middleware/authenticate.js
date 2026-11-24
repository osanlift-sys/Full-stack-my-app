import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { authCookieNames, verifyAccessToken } from "../utils/authTokens.js";

export async function authenticate(req, _res, next) {
  const token = req.cookies?.[authCookieNames.access];
  if (!token) {
    next(new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue."));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        status: "ACTIVE",
        refreshTokens: {
          some: {
            id: payload.sid,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      include: {
        employee: { select: { id: true, approvalStatus: true } },
        seller: { select: { id: true, status: true } },
        permissions: { select: { key: true, enabled: true } },
        clientMemberships: { select: { companyId: true } },
      },
    });
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }
    if (user.role === "EMPLOYEE" && user.employee?.approvalStatus !== "APPROVED") {
      throw new ApiError(403, "ACCOUNT_NOT_APPROVED", "An administrator must approve your account.");
    }
    if (user.role === "SELLER" && user.seller?.status !== "ACTIVE") {
      throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "This account is not active.");
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeId: user.employee?.id,
      employeeApprovalStatus: user.employee?.approvalStatus,
      sellerId: user.seller?.id,
      sellerStatus: user.seller?.status,
      permissions: Object.fromEntries(
        user.permissions.map(({ key, enabled }) => [key, enabled])
      ),
      companyIds: user.clientMemberships.map(({ companyId }) => companyId),
    };
    next();
  } catch (error) {
    next(error);
  }
}
