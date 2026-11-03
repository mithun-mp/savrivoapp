import { Merchant } from '../models/Merchant.model';
import { Offer } from '../models/Offer.model';
import { slugify } from '../utils/slugify';

export async function getMerchants(enabledOnly = true) {
  const filter = enabledOnly ? { enabled: true } : {};
  return Merchant.find(filter).sort({ name: 1 }).lean();
}

export async function getMerchantById(id: string) {
  return Merchant.findById(id).lean();
}

export async function createMerchant(data: Record<string, unknown>) {
  if (!data.slug && data.name) {
    data.slug = slugify(String(data.name));
  }
  const merchant = new Merchant(data);
  return merchant.save();
}

export async function updateMerchant(id: string, data: Record<string, unknown>) {
  return Merchant.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
}

export async function toggleMerchant(id: string) {
  const merchant = await Merchant.findById(id);
  if (!merchant) throw new Error('Merchant not found');
  merchant.enabled = !merchant.enabled;
  return merchant.save();
}

export async function deleteMerchant(id: string) {
  const offerCount = await Offer.countDocuments({ merchantId: id });
  if (offerCount > 0) {
    const err = new Error(`Cannot delete merchant: ${offerCount} offer(s) are associated with this merchant. Please remove associated offers first.`);
    (err as unknown as Record<string, unknown>).statusCode = 409;
    (err as unknown as Record<string, unknown>).code = 'RELATIONAL_RESTRICTION';
    throw err;
  }
  return Merchant.findByIdAndDelete(id);
}