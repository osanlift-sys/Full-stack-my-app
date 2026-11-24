import {
  getDashboard,
  getFinancialReport,
  listOutstandingBills,
  listTransactions,
} from "../services/reportService.js";

export async function getDashboardController(req, res) {
  res.status(200).json({ dashboard: await getDashboard(req.user) });
}

export async function getFinancialReportController(req, res) {
  res.status(200).json({ report: await getFinancialReport(req.user, req.validatedQuery) });
}

export async function listOutstandingBillsController(req, res) {
  res.status(200).json(await listOutstandingBills(req.user, req.validatedQuery));
}

export async function listTransactionsController(req, res) {
  res.status(200).json(await listTransactions(req.user, req.validatedQuery));
}
