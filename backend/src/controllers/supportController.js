import {
  createQuotation,
  createSupportRequest,
  getClientQuotation,
  getSupportAttachment,
  getSupportRequest,
  listSupportRequests,
  markSupportRequestRead,
  setSupportRequestStatus,
  updateQuotationStatus,
} from "../services/supportService.js";

export async function listSupportRequestsController(req, res) {
  res.status(200).json(await listSupportRequests(req.user, req.validatedQuery));
}

export async function getSupportRequestController(req, res) {
  res.status(200).json({
    request: await getSupportRequest(req.user, req.validatedParams.requestId),
  });
}

export async function createSupportRequestController(req, res) {
  res.status(201).json({
    request: await createSupportRequest(
      req.user,
      req.validatedBody,
      req.files || []
    ),
  });
}

export async function updateSupportRequestStatusController(req, res) {
  res.status(200).json({
    request: await setSupportRequestStatus(
      req.user,
      req.validatedParams.requestId,
      req.validatedBody.status
    ),
  });
}

export async function markSupportRequestReadController(req, res) {
  res.status(200).json({
    request: await markSupportRequestRead(req.user, req.validatedParams.requestId),
  });
}

export async function getSupportAttachmentController(req, res) {
  const attachment = await getSupportAttachment(
    req.user,
    req.validatedParams.requestId,
    req.validatedParams.attachmentId
  );
  res
    .status(200)
    .set("Content-Type", attachment.mimeType)
    .set("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.originalName)}"`)
    .set("Cache-Control", "private, no-store")
    .send(attachment.bytes);
}

export async function createQuotationController(req, res) {
  res.status(201).json({
    quotation: await createQuotation(
      req.user,
      req.validatedParams.requestId,
      req.validatedBody
    ),
  });
}

export async function updateQuotationStatusController(req, res) {
  res.status(200).json({
    quotation: await updateQuotationStatus(
      req.user,
      req.validatedParams.quotationId,
      req.validatedBody.status
    ),
  });
}

export async function getClientQuotationController(req, res) {
  res.status(200).json({
    quotation: await getClientQuotation(req.user, req.validatedParams.requestId),
  });
}
