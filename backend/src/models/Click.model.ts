import { Schema, model, Document, Types } from 'mongoose';

export interface IClick extends Document {
  productId: Types.ObjectId;
  merchantId: Types.ObjectId;
  offerId: Types.ObjectId;
  targetUrl: string;
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
  campaign?: string;
  createdAt: Date;
}

const clickSchema = new Schema<IClick>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer', required: true },
    targetUrl: { type: String, required: true },
    referrer: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    ipHash: { type: String, trim: true },
    campaign: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

clickSchema.index({ offerId: 1, createdAt: -1 });
clickSchema.index({ productId: 1, createdAt: -1 });
clickSchema.index({ merchantId: 1, createdAt: -1 });
clickSchema.index({ createdAt: -1 });

export const Click = model<IClick>('Click', clickSchema);

