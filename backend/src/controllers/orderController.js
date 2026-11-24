import {
  checkout,
  getOrder,
  listOrders,
  recordOrderPayment,
  updateOrderStatus,
} from "../services/orderService.js";

export async function listOrdersController(req, res) {
  res.status(200).json(await listOrders(req.user, req.validatedQuery));
}

export async function getOrderController(req, res) {
  res.status(200).json({
    order: await getOrder(req.user, req.validatedParams.orderId),
  });
}

export async function checkoutController(req, res) {
  res.status(201).json({ order: await checkout(req.user, req.validatedBody) });
}

export async function updateOrderStatusController(req, res) {
  res.status(200).json({
    order: await updateOrderStatus(
      req.user,
      req.validatedParams.orderId,
      req.validatedBody.status
    ),
  });
}

export async function recordOrderPaymentController(req, res) {
  res.status(201).json({
    order: await recordOrderPayment(
      req.user,
      req.validatedParams.orderId,
      req.validatedBody
    ),
  });
}
