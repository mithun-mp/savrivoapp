import type { MerchantAdapter } from './merchant-adapter.interface';
import { defaultAmazonAdapter, AmazonAdapter } from './amazon.adapter';
import { defaultFlipkartAdapter, FlipkartAdapter } from './flipkart.adapter';
import { defaultGenericAdapter, GenericAdapter } from './generic.adapter';

export class MerchantAdapterRegistry {
  private adapters: Map<string, MerchantAdapter> = new Map();

  constructor() {
    this.register('amazon', defaultAmazonAdapter);
    this.register('flipkart', defaultFlipkartAdapter);
    this.register('generic', defaultGenericAdapter);
  }

  public register(merchantType: string, adapter: MerchantAdapter): void {
    this.adapters.set(merchantType.toLowerCase(), adapter);
  }

  public getAdapter(merchantType?: string): MerchantAdapter {
    if (!merchantType) return defaultGenericAdapter;
    const lower = merchantType.toLowerCase();
    if (lower.includes('amazon')) {
      return this.adapters.get('amazon') || defaultAmazonAdapter;
    }
    if (lower.includes('flipkart')) {
      return this.adapters.get('flipkart') || defaultFlipkartAdapter;
    }
    return this.adapters.get(lower) || defaultGenericAdapter;
  }
}

export const defaultAdapterRegistry = new MerchantAdapterRegistry();

