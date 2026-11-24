import { Router } from "express";
import { authorizeRoles, requirePermission, requirePermissionOrClientRead } from "../middleware/authorize.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateQuery } from "../middleware/validate.js";
import {
  reportDateQuerySchema,
  reportListQuerySchema,
} from "../validators/reportValidators.js";
import {
  getDashboardController,
  getFinancialReportController,
  listOutstandingBillsController,
  listTransactionsController,
} from "../controllers/reportController.js";

const router = Router();

router.use(authenticate);
router.get(
  "/dashboard",
  authorizeRoles("ADMIN", "EMPLOYEE", "CLIENT", "SELLER"),
  getDashboardController
);
router.get(
  "/financial",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  requirePermission("reports_action_financial"),
  validateQuery(reportDateQuerySchema),
  getFinancialReportController
);
router.get(
  "/outstanding-bills",
  requirePermissionOrClientRead("reports_action_financial"),
  validateQuery(reportListQuerySchema),
  listOutstandingBillsController
);
router.get(
  "/transactions",
  requirePermissionOrClientRead("reports_action_financial"),
  validateQuery(reportListQuerySchema),
  listTransactionsController
);

export default router;
