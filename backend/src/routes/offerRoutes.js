import { Router } from "express";
import {
  createOfferController,
  deleteOfferController,
  getOfferController,
  listOfferProductsController,
  listOffersController,
  listPurchaseProductsController,
  updateOfferController,
} from "../controllers/offerController.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  authorizeRoles,
  requirePermission,
  requirePermissionOrClientRead,
} from "../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  offerCreateSchema,
  offerIdParamsSchema,
  offerListQuerySchema,
  offerProductQuerySchema,
  offerUpdateSchema,
} from "../validators/offerValidators.js";

const router = Router();

router.use(authenticate);
router.get(
  "/products",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_tab_offer"),
  validateQuery(offerProductQuerySchema),
  listOfferProductsController
);
router.get(
  "/purchase-products",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_tab_offer"),
  validateQuery(offerProductQuerySchema),
  listPurchaseProductsController
);
router.get(
  "/",
  requirePermissionOrClientRead("clients_tab_offer"),
  validateQuery(offerListQuerySchema),
  listOffersController
);
router.get(
  "/:offerId",
  requirePermissionOrClientRead("clients_tab_offer"),
  validateParams(offerIdParamsSchema),
  getOfferController
);
router.post(
  "/",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_action_save"),
  validateBody(offerCreateSchema),
  createOfferController
);
router.patch(
  "/:offerId",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("clients_action_update"),
  validateParams(offerIdParamsSchema),
  validateBody(offerUpdateSchema),
  updateOfferController
);
router.delete(
  "/:offerId",
  authorizeRoles("ADMIN"),
  validateParams(offerIdParamsSchema),
  deleteOfferController
);

export default router;
