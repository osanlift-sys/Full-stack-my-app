import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../config/database.js";
import { ApiError } from "../utils/apiError.js";
import { decimal } from "./billMath.js";
import { sniffFileType } from "./supportFiles.js";

const uploadsDirectory = fileURLToPath(new URL("../../uploads/", import.meta.url));

const supportInclude = {
  company: { select: { id: true, name: true } },
  attachments: {
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
  quotations: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { items: { orderBy: { position: "asc" } } },
  },
};

const requestStatusLabels = {
  OPEN: "pending",
  IN_REVIEW: "in_progress",
  QUOTED: "responded",
  COMPLETE: "complete",
  REJECTED: "rejected",
};

const quotationTransitions = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

function assertCanReadRequest(user, request) {
  if (user.role === "ADMIN") return;
  if (user.role === "CLIENT" && request.companyId && user.companyIds.includes(request.companyId)) return;
  if (request.requestedById === user.id) return;
  throw new ApiError(404, "SUPPORT_REQUEST_NOT_FOUND", "Support request not found.");
}

function serializeRequest(request, includeDraftQuotation = false) {
  const latestQuotation = request.quotations?.[0];
  const visibleQuotation = latestQuotation &&
    (includeDraftQuotation || ["SENT", "ACCEPTED"].includes(latestQuotation.status))
    ? serializeQuotation(latestQuotation)
    : null;
  return {
    id: request.id,
    serviceId: request.serviceId,
    serviceTitle: request.serviceTitle,
    serviceTag: request.serviceTag,
    userName: request.userName,
    email: request.email,
    whatsapp: request.whatsapp,
    problemDetails: request.problemDetails,
    status: requestStatusLabels[request.status] || "pending",
    hasUnreadNotification: request.hasUnreadNotification,
    company: request.company,
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt.toISOString(),
      downloadUrl: `/api/v1/support/requests/${request.id}/attachments/${attachment.id}`,
    })),
    ...(visibleQuotation
      ? {
        suggestion: visibleQuotation.suggestion,
        grandTotal: visibleQuotation.grandTotal,
        quotationItems: visibleQuotation.items,
      }
      : {}),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

function serializeQuotation(quotation) {
  return {
    id: quotation.id,
    requestId: quotation.requestId,
    status: quotation.status,
    suggestion: quotation.suggestion,
    subtotal: quotation.subtotal.toString(),
    grandTotal: quotation.grandTotal.toString(),
    validUntil: quotation.validUntil?.toISOString() || null,
    items: quotation.items.map((item) => ({
      name: item.description,
      qty: item.quantity.toString(),
      price: item.unitPrice.toString(),
      total: item.total.toString(),
    })),
    createdAt: quotation.createdAt.toISOString(),
    updatedAt: quotation.updatedAt.toISOString(),
  };
}

function safeOriginalName(name) {
  const cleaned = [...path.basename(name.replace(/\\/g, "/"))]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return cleaned.slice(0, 200) || "attachment";
}

async function storeAttachments(files = []) {
  const stored = [];
  try {
    await mkdir(uploadsDirectory, { recursive: true });
    for (const file of files) {
      const detected = sniffFileType(file.buffer);
      if (detected.mimeType !== file.mimetype) {
        throw new ApiError(400, "INVALID_FILE_CONTENT", "An attachment's contents do not match its declared file type.");
      }
      const storageKey = `${randomUUID()}.${detected.extension}`;
      await writeFile(path.join(uploadsDirectory, storageKey), file.buffer, {
        flag: "wx",
        mode: 0o600,
      });
      stored.push({
        storageKey,
        originalName: safeOriginalName(file.originalname),
        mimeType: detected.mimeType,
        sizeBytes: file.size,
      });
    }
    return stored;
  } catch (error) {
    const cleanupErrors = await cleanupAttachments(stored);
    if (cleanupErrors.length) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "Support upload failed and temporary files could not all be removed.",
        { cause: error }
      );
    }
    throw error;
  }
}

async function cleanupAttachments(files) {
  const cleanupErrors = [];
  for (const file of files) {
    try {
      await unlink(path.join(uploadsDirectory, file.storageKey));
    } catch (error) {
      if (error.code !== "ENOENT") cleanupErrors.push(error);
    }
  }
  return cleanupErrors;
}

export async function listSupportRequests(user, filters) {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(user.role === "CLIENT"
      ? { companyId: { in: user.companyIds }, requestedById: user.id }
      : {}),
    ...(user.role !== "ADMIN" && user.role !== "CLIENT"
      ? { requestedById: user.id }
      : {}),
  };
  const [requests, total] = await prisma.$transaction([
    prisma.supportRequest.findMany({
      where,
      include: supportInclude,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.supportRequest.count({ where }),
  ]);
  return {
    items: requests.map((request) => serializeRequest(request, user.role === "ADMIN")),
    page: filters.page,
    limit: filters.limit,
    total,
  };
}

export async function getSupportRequest(user, requestId) {
  const request = await prisma.supportRequest.findUnique({
    where: { id: requestId },
    include: supportInclude,
  });
  if (!request) throw new ApiError(404, "SUPPORT_REQUEST_NOT_FOUND", "Support request not found.");
  assertCanReadRequest(user, request);
  return serializeRequest(request, user.role === "ADMIN");
}

export async function createSupportRequest(user, data, files) {
  if (!["CLIENT", "EMPLOYEE", "SELLER"].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "Sign in with an eligible account to submit a support request.");
  }
  let companyId = data.companyId || null;
  if (user.role === "CLIENT") {
    if (!companyId && user.companyIds.length === 1) companyId = user.companyIds[0];
    if (!companyId || !user.companyIds.includes(companyId)) {
      throw new ApiError(400, "COMPANY_REQUIRED", "Select a company associated with your account.");
    }
  } else if (companyId && !user.companyIds.includes(companyId)) {
    throw new ApiError(404, "COMPANY_NOT_FOUND", "The selected company is not associated with this account.");
  }

  const storedFiles = await storeAttachments(files);
  try {
    const request = await prisma.$transaction(async (tx) => {
      if (companyId) {
        const company = await tx.company.findFirst({
          where: { id: companyId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!company) throw new ApiError(409, "COMPANY_INACTIVE", "The selected company is not active.");
      }
      const created = await tx.supportRequest.create({
        data: {
          requestedById: user.id,
          companyId,
          serviceId: data.serviceId,
          serviceTitle: data.serviceTitle,
          serviceTag: data.serviceTag || null,
          userName: user.name || user.email,
          email: user.email,
          whatsapp: data.whatsapp,
          problemDetails: data.problemDetails,
          status: "OPEN",
          hasUnreadNotification: true,
          attachments: { create: storedFiles },
        },
        include: supportInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: "SUPPORT_REQUEST_CREATED",
          resourceType: "SUPPORT_REQUEST",
          resourceId: created.id,
          metadata: { attachmentCount: storedFiles.length },
        },
      });
      return created;
    });
    return serializeRequest(request);
  } catch (error) {
    const cleanupErrors = await cleanupAttachments(storedFiles);
    if (cleanupErrors.length) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "Support request failed and uploaded files could not all be removed.",
        { cause: error }
      );
    }
    throw error;
  }
}

export async function setSupportRequestStatus(user, requestId, status) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supportRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!existing) throw new ApiError(404, "SUPPORT_REQUEST_NOT_FOUND", "Support request not found.");
    const updated = await tx.supportRequest.updateMany({
      where: { id: requestId, updatedAt: existing.updatedAt },
      data: {
        status,
        reviewedById: user.id,
        hasUnreadNotification: false,
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "SUPPORT_REQUEST_CHANGED", "The request changed while updating its status. Reload and try again.");
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "SUPPORT_REQUEST_STATUS_UPDATED",
        resourceType: "SUPPORT_REQUEST",
        resourceId: requestId,
        metadata: { from: existing.status, to: status },
      },
    });
    return serializeRequest(await tx.supportRequest.findUnique({
      where: { id: requestId },
      include: supportInclude,
    }), true);
  });
}

export async function markSupportRequestRead(user, requestId) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.supportRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) throw new ApiError(404, "SUPPORT_REQUEST_NOT_FOUND", "Support request not found.");
    await tx.supportRequest.update({
      where: { id: requestId },
      data: { hasUnreadNotification: false },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "SUPPORT_REQUEST_READ",
        resourceType: "SUPPORT_REQUEST",
        resourceId: requestId,
        metadata: {},
      },
    });
    return { id: requestId, hasUnreadNotification: false };
  });
}

export async function getSupportAttachment(user, requestId, attachmentId) {
  const attachment = await prisma.supportAttachment.findFirst({
    where: { id: attachmentId, requestId },
    include: { request: { select: { id: true, companyId: true, requestedById: true } } },
  });
  if (!attachment) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found.");
  assertCanReadRequest(user, attachment.request);
  if (!/^[0-9a-f-]+\.(?:jpg|png|webp|pdf)$/.test(attachment.storageKey)) {
    throw new ApiError(500, "INVALID_STORAGE_KEY", "Attachment storage metadata is invalid.");
  }
  try {
    return {
      bytes: await readFile(path.join(uploadsDirectory, attachment.storageKey)),
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment file is no longer available.");
    }
    throw error;
  }
}

export async function createQuotation(user, requestId, data) {
  const quotation = await prisma.$transaction(async (tx) => {
    const request = await tx.supportRequest.findUnique({
      where: { id: requestId },
      select: { id: true, requestedById: true, status: true },
    });
    if (!request) throw new ApiError(404, "SUPPORT_REQUEST_NOT_FOUND", "Support request not found.");
    if (request.status === "REJECTED" || request.status === "COMPLETE") {
      throw new ApiError(409, "SUPPORT_REQUEST_CLOSED", "A closed request cannot receive a quotation.");
    }

    const items = data.items.map((item, position) => {
      const quantity = decimal(item.qty);
      const unitPrice = decimal(item.price);
      return {
        position,
        description: item.name,
        quantity,
        unitPrice,
        total: quantity.mul(unitPrice).toDecimalPlaces(2),
      };
    });
    const subtotal = items.reduce((sum, item) => sum.plus(item.total), decimal("0"))
      .toDecimalPlaces(2);
    const created = await tx.quotation.create({
      data: {
        requestId,
        createdById: user.id,
        status: data.status,
        suggestion: data.suggestion || null,
        subtotal,
        grandTotal: subtotal,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        items: { create: items },
      },
      include: { items: { orderBy: { position: "asc" } } },
    });
    await tx.supportRequest.update({
      where: { id: requestId },
      data: {
        status: data.status === "SENT" ? "QUOTED" : "IN_REVIEW",
        reviewedById: user.id,
        hasUnreadNotification: data.status === "SENT",
      },
    });
    if (data.status === "SENT" && request.requestedById) {
      await tx.notification.create({
        data: {
          userId: request.requestedById,
          title: "Technical support quotation ready",
          message: "A quotation is ready for your technical support request.",
          payload: { requestId, quotationId: created.id },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "QUOTATION_CREATED",
        resourceType: "QUOTATION",
        resourceId: created.id,
        metadata: { requestId, status: data.status, itemCount: items.length },
      },
    });
    return created;
  });
  return serializeQuotation(quotation);
}

export async function updateQuotationStatus(user, quotationId, status) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        requestId: true,
        status: true,
        request: { select: { requestedById: true } },
      },
    });
    if (!existing) throw new ApiError(404, "QUOTATION_NOT_FOUND", "Quotation not found.");
    if (!quotationTransitions[existing.status].includes(status)) {
      throw new ApiError(409, "INVALID_QUOTATION_TRANSITION", `Quotation cannot transition from ${existing.status} to ${status}.`);
    }
    const quotation = await tx.quotation.update({
      where: { id: quotationId },
      data: { status },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (status === "SENT") {
      await tx.supportRequest.update({
        where: { id: existing.requestId },
        data: { status: "QUOTED", reviewedById: user.id, hasUnreadNotification: true },
      });
      if (existing.request.requestedById) {
        await tx.notification.create({
          data: {
            userId: existing.request.requestedById,
            title: "Technical support quotation ready",
            message: "A quotation is ready for your technical support request.",
            payload: { requestId: existing.requestId, quotationId },
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "QUOTATION_STATUS_UPDATED",
        resourceType: "QUOTATION",
        resourceId: quotationId,
        metadata: { from: existing.status, to: status },
      },
    });
    return serializeQuotation(quotation);
  });
}

export async function getClientQuotation(user, requestId) {
  const request = await prisma.supportRequest.findUnique({
    where: { id: requestId },
    include: supportInclude,
  });
  if (!request) throw new ApiError(404, "SUPPORT_REQUEST_NOT_FOUND", "Support request not found.");
  assertCanReadRequest(user, request);
  const quotation = await prisma.quotation.findFirst({
    where: { requestId, status: { in: ["SENT", "ACCEPTED"] } },
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  if (!quotation) throw new ApiError(404, "QUOTATION_NOT_FOUND", "No quotation is available for this request.");
  const serializedRequest = serializeRequest(request);
  const serializedQuotation = serializeQuotation(quotation);
  return {
    ...serializedRequest,
    quotation: serializedQuotation,
    quotationId: serializedQuotation.id,
    suggestion: serializedQuotation.suggestion,
    grandTotal: serializedQuotation.grandTotal,
    quotationItems: serializedQuotation.items,
  };
}
