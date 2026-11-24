import {
  createBill,
  getBill,
  listBills,
  recordBillPayment,
  updateBill,
  voidBill,
} from "../services/billService.js";

export async function listBillsController(req, res) {
  res.status(200).json(await listBills(req.user, req.validatedQuery));
}

export async function getBillController(req, res) {
  res.status(200).json({ bill: await getBill(req.user, req.validatedParams.billId) });
}

export async function createBillController(req, res) {
  res.status(201).json({ bill: await createBill(req.user, req.validatedBody) });
}

export async function updateBillController(req, res) {
  res.status(200).json({
    bill: await updateBill(
      req.user,
      req.validatedParams.billId,
      req.validatedBody
    ),
  });
}

export async function recordBillPaymentController(req, res) {
  res.status(201).json({
    bill: await recordBillPayment(
      req.user,
      req.validatedParams.billId,
      req.validatedBody
    ),
  });
}

export async function voidBillController(req, res) {
  res.status(200).json({
    bill: await voidBill(req.user, req.validatedParams.billId),
  });
}
