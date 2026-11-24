import { Router } from "express";
import {
  getSellerDashboardController,
  listSellerSalesController,
} from "../controllers/sellerController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { validateQuery } from "../middleware/validate.js";
import { userListQuerySchema } from "../validators/adminValidators.js";

const router = Router();

router.use(authenticate, authorizeRoles("SELLER"));
router.get("/me", getSellerDashboardController);
router.get("/sales", validateQuery(userListQuerySchema.pick({ page: true, limit: true })), listSellerSalesController);

export default router;
