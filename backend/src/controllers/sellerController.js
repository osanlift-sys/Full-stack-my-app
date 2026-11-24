import { getSellerDashboard, listSellerSales } from "../services/sellerService.js";

export async function getSellerDashboardController(req, res) {
  res.status(200).json({ dashboard: await getSellerDashboard(req.user) });
}

export async function listSellerSalesController(req, res) {
  res.status(200).json(await listSellerSales(req.user, req.validatedQuery));
}
