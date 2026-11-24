import { Router } from "express";
import {
  adjustProductStockController,
  createProductCategoryController,
  createProductController,
  deactivateProductController,
  getProductController,
  listProductCategoriesController,
  listProductsController,
  listPublicProductsController,
  updateProductController,
} from "../controllers/productController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  productCategoryCreateSchema,
  productCreateSchema,
  productIdParamsSchema,
  productListQuerySchema,
  productUpdateSchema,
  stockAdjustmentSchema,
} from "../validators/productValidators.js";

const router = Router();

router.get("/public", validateQuery(productListQuerySchema), listPublicProductsController);
router.use(authenticate);
router.get("/categories", listProductCategoriesController);
router.post(
  "/categories",
  authorizeRoles("ADMIN", "EMPLOYEE"),
  validateBody(productCategoryCreateSchema),
  createProductCategoryController
);
router.get("/", validateQuery(productListQuerySchema), listProductsController);
router.get("/:productId", validateParams(productIdParamsSchema), getProductController);
router.post(
  "/",
  authorizeRoles("ADMIN", "EMPLOYEE", "SELLER"),
  validateBody(productCreateSchema),
  createProductController
);
router.patch(
  "/:productId",
  authorizeRoles("ADMIN", "EMPLOYEE", "SELLER"),
  validateParams(productIdParamsSchema),
  validateBody(productUpdateSchema),
  updateProductController
);
router.patch(
  "/:productId/stock",
  authorizeRoles("ADMIN", "EMPLOYEE", "SELLER"),
  validateParams(productIdParamsSchema),
  validateBody(stockAdjustmentSchema),
  adjustProductStockController
);
router.delete(
  "/:productId",
  authorizeRoles("ADMIN", "EMPLOYEE", "SELLER"),
  validateParams(productIdParamsSchema),
  deactivateProductController
);

export default router;
