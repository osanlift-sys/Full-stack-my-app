import { Router } from "express";
import {
  createBillController,
  getBillController,
  listBillsController,
  recordBillPaymentController,
  updateBillController,
  voidBillController,
} from "../controllers/billController.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  authorizeRoles,
  requirePermission,
  requirePermissionOrClientRead,
} from "../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  billCreateSchema,
  billIdParamsSchema,
  billListQuerySchema,
  billUpdateSchema,
  paymentCreateSchema,
} from "../validators/billValidators.js";

const router = Router();

router.use(authenticate);
router.get(
  "/",
  requirePermissionOrClientRead("clients_tab_invoice"),
  validateQuery(billListQuerySchema),
  listBillsController
);
router.get(
  "/:billId",
  requirePermissionOrClientRead("clients_tab_invoice"),
  validateParams(billIdParamsSchema),
  getBillController
);
router.post(
  "/",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_action_save"),
  validateBody(billCreateSchema),
  createBillController
);
router.patch(
  "/:billId",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_action_update"),
  validateParams(billIdParamsSchema),
  validateBody(billUpdateSchema),
  updateBillController
);
router.post(
  "/:billId/payments",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_action_update"),
  validateParams(billIdParamsSchema),
  validateBody(paymentCreateSchema),
  recordBillPaymentController
);
router.delete(
  "/:billId",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_action_delete"),
  validateParams(billIdParamsSchema),
  voidBillController
);

export default router;
