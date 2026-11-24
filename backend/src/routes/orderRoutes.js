import { Router } from "express";
import {
  checkoutController,
  getOrderController,
  listOrdersController,
  recordOrderPaymentController,
  updateOrderStatusController,
} from "../controllers/orderController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles, requirePermission } from "../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  checkoutSchema,
  orderIdParamsSchema,
  orderListQuerySchema,
  orderPaymentSchema,
  orderStatusSchema,
} from "../validators/orderValidators.js";

const router = Router();

router.use(authenticate);
router.get("/", validateQuery(orderListQuerySchema), listOrdersController);
router.get("/:orderId", validateParams(orderIdParamsSchema), getOrderController);
router.post(
  "/checkout",
  authorizeRoles("CLIENT"),
  validateBody(checkoutSchema),
  checkoutController
);
router.post(
  "/:orderId/payments",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("orders_action_manage"),
  validateParams(orderIdParamsSchema),
  validateBody(orderPaymentSchema),
  recordOrderPaymentController
);
router.patch(
  "/:orderId/status",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("orders_action_manage"),
  validateParams(orderIdParamsSchema),
  validateBody(orderStatusSchema),
  updateOrderStatusController
);

export default router;
