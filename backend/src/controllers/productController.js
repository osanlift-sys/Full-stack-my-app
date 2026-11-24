import {
  adjustProductStock,
  createProduct,
  createProductCategory,
  deactivateProduct,
  getProduct,
  listProductCategories,
  listProducts,
  updateProduct,
} from "../services/productService.js";

export async function listProductsController(req, res) {
  res.status(200).json(await listProducts(req.user, req.validatedQuery));
}

export async function listPublicProductsController(req, res) {
  res.status(200).json(await listProducts(null, req.validatedQuery, { publicOnly: true }));
}

export async function getProductController(req, res) {
  res.status(200).json({
    product: await getProduct(req.user, req.validatedParams.productId),
  });
}

export async function createProductController(req, res) {
  res.status(201).json({ product: await createProduct(req.user, req.validatedBody) });
}

export async function updateProductController(req, res) {
  res.status(200).json({
    product: await updateProduct(
      req.user,
      req.validatedParams.productId,
      req.validatedBody
    ),
  });
}

export async function deactivateProductController(req, res) {
  res.status(200).json({
    product: await deactivateProduct(req.user, req.validatedParams.productId),
  });
}

export async function adjustProductStockController(req, res) {
  res.status(200).json({
    product: await adjustProductStock(
      req.user,
      req.validatedParams.productId,
      req.validatedBody
    ),
  });
}

export async function listProductCategoriesController(_req, res) {
  res.status(200).json({ items: await listProductCategories() });
}

export async function createProductCategoryController(req, res) {
  res.status(201).json({ category: await createProductCategory(req.user, req.validatedBody) });
}
