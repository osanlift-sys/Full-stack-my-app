import { Router } from "express";
import {
  createQuotationController,
  createSupportRequestController,
  getClientQuotationController,
  getSupportAttachmentController,
  getSupportRequestController,
  listSupportRequestsController,
  markSupportRequestReadController,
  updateQuotationStatusController,
  updateSupportRequestStatusController,
} from "../controllers/supportController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { uploadSupportAttachments } from "../middleware/supportUpload.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  quotationCreateSchema,
  quotationIdParamsSchema,
  quotationStatusSchema,
  supportAttachmentParamsSchema,
  supportIdParamsSchema,
  supportListQuerySchema,
  supportRequestCreateSchema,
  supportStatusSchema,
} from "../validators/supportValidators.js";

const router = Router();

router.use(authenticate);
router.get(
  "/requests",
  authorizeRoles("ADMIN", "CLIENT", "EMPLOYEE", "SELLER"),
  validateQuery(supportListQuerySchema),
  listSupportRequestsController
);
router.post(
  "/requests",
  authorizeRoles("CLIENT", "EMPLOYEE", "SELLER"),
  uploadSupportAttachments,
  validateBody(supportRequestCreateSchema),
  createSupportRequestController
);
router.get(
  "/requests/:requestId/quotation",
  authorizeRoles("ADMIN", "CLIENT"),
  validateParams(supportIdParamsSchema),
  getClientQuotationController
);
router.get(
  "/requests/:requestId/attachments/:attachmentId",
  validateParams(supportAttachmentParamsSchema),
  getSupportAttachmentController
);
router.get(
  "/requests/:requestId",
  authorizeRoles("ADMIN", "CLIENT", "EMPLOYEE", "SELLER"),
  validateParams(supportIdParamsSchema),
  getSupportRequestController
);
router.patch(
  "/requests/:requestId/status",
  authorizeRoles("ADMIN"),
  validateParams(supportIdParamsSchema),
  validateBody(supportStatusSchema),
  updateSupportRequestStatusController
);
router.patch(
  "/requests/:requestId/read",
  authorizeRoles("ADMIN"),
  validateParams(supportIdParamsSchema),
  markSupportRequestReadController
);
router.post(
  "/requests/:requestId/quotations",
  authorizeRoles("ADMIN"),
  validateParams(supportIdParamsSchema),
  validateBody(quotationCreateSchema),
  createQuotationController
);
router.patch(
  "/quotations/:quotationId/status",
  authorizeRoles("ADMIN"),
  validateParams(quotationIdParamsSchema),
  validateBody(quotationStatusSchema),
  updateQuotationStatusController
);

export default router;
