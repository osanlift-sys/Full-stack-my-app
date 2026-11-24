import { Router } from "express";
import {
  addClientContactController,
  assignRoleController,
  createCompanyController,
  getUserController,
  listClientContactsController,
  listCompaniesController,
  listEmployeeRequestsController,
  listUsersController,
  reviewEmployeeRequestController,
  setClientContactStatusController,
  updateSellerCommissionController,
  updateAccountStatusController,
  updateEmployeeProfileController,
  updateUserPermissionsController,
} from "../controllers/adminController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { profileUpdateSchema } from "../validators/authValidators.js";
import {
  accountStatusSchema,
  clientContactCreateSchema,
  clientContactStatusSchema,
  companyCreateSchema,
  companyIdParamsSchema,
  contactIdParamsSchema,
  employeeIdParamsSchema,
  employeeReviewSchema,
  sellerCommissionSchema,
  sellerIdParamsSchema,
  userIdParamsSchema,
  userListQuerySchema,
  userPermissionsSchema,
  userRoleSchema,
} from "../validators/adminValidators.js";

const router = Router();

router.use(authenticate, authorizeRoles("ADMIN"));
router.get("/users", validateQuery(userListQuerySchema), listUsersController);
router.get("/users/:userId", validateParams(userIdParamsSchema), getUserController);
router.patch("/users/:userId/profile", validateParams(userIdParamsSchema), validateBody(profileUpdateSchema), updateEmployeeProfileController);
router.patch("/users/:userId/status", validateParams(userIdParamsSchema), validateBody(accountStatusSchema), updateAccountStatusController);
router.patch("/users/:userId/role", validateParams(userIdParamsSchema), validateBody(userRoleSchema), assignRoleController);
router.patch("/sellers/:sellerId/commission", validateParams(sellerIdParamsSchema), validateBody(sellerCommissionSchema), updateSellerCommissionController);
router.put("/users/:userId/permissions", validateParams(userIdParamsSchema), validateBody(userPermissionsSchema), updateUserPermissionsController);
router.get("/employee-requests", listEmployeeRequestsController);
router.patch("/employees/:employeeId/approval", validateParams(employeeIdParamsSchema), validateBody(employeeReviewSchema), reviewEmployeeRequestController);
router.get("/companies", listCompaniesController);
router.post("/companies", validateBody(companyCreateSchema), createCompanyController);
router.get("/companies/:companyId/contacts", validateParams(companyIdParamsSchema), listClientContactsController);
router.post("/companies/:companyId/contacts", validateParams(companyIdParamsSchema), validateBody(clientContactCreateSchema), addClientContactController);
router.patch("/client-contacts/:contactId/status", validateParams(contactIdParamsSchema), validateBody(clientContactStatusSchema), setClientContactStatusController);

export default router;
