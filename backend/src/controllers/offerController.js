import {
  createOffer,
  deleteOffer,
  getOffer,
  listOfferProducts,
  listOffers,
  listPurchaseProducts,
  updateOffer,
} from "../services/offerService.js";

export async function listOffersController(req, res) {
  res.status(200).json(await listOffers(req.user, req.validatedQuery));
}

export async function getOfferController(req, res) {
  res.status(200).json({ offer: await getOffer(req.user, req.validatedParams.offerId) });
}

export async function createOfferController(req, res) {
  res.status(201).json({ offer: await createOffer(req.user, req.validatedBody) });
}

export async function updateOfferController(req, res) {
  res.status(200).json({
    offer: await updateOffer(
      req.user,
      req.validatedParams.offerId,
      req.validatedBody
    ),
  });
}

export async function deleteOfferController(req, res) {
  res.status(200).json({
    offer: await deleteOffer(req.user, req.validatedParams.offerId),
  });
}

export async function listOfferProductsController(req, res) {
  res.status(200).json({ items: await listOfferProducts(req.validatedQuery.search) });
}

export async function listPurchaseProductsController(req, res) {
  res.status(200).json({ items: await listPurchaseProducts(req.validatedQuery.search) });
}
