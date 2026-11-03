import { Offer } from '../models/Offer.model';

export async function getOffersByProduct(productId: string) {
  return Offer.find({ productId, status: 'active' })
    .populate('merchantId', 'name slug websiteUrl logoUrl')
    .sort({ currentPrice: 1 })
    .lean();
}

export async function createOffer(data: Record<string, unknown>) {
  const offer = new Offer(data);
  return offer.save();
}

export async function updateOffer(id: string, data: Record<string, unknown>) {
  return Offer.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
}

export async function expireOffer(id: string) {
  return Offer.findByIdAndUpdate(id, { $set: { status: 'expired' } }, { new: true });
}

export async function getAllOffers(query: Record<string, unknown>) {
  return Offer.find(query)
    .populate('productId', 'title slug')
    .populate('merchantId', 'name slug')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getOfferById(id: string) {
  return Offer.findById(id)
    .populate('productId', 'title slug')
    .populate('merchantId', 'name slug')
    .lean();
}

export async function deleteOffer(id: string) {
  return Offer.findByIdAndDelete(id);
}