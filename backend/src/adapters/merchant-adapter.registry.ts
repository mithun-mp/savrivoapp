import type { MerchantAdapter } from './merchant-adapter.interface';
import { defaultAmazonAdapter, AmazonAdapter } from './amazon.adapter';
import { defaultFlipkartAdapter, FlipkartAdapter } from './flipkart.adapter';
import { defaultMyntraAdapter, MyntraAdapter } from './myntra.adapter';
import { defaultAjioAdapter, AjioAdapter } from './ajio.adapter';
import { defaultGenericAdapter, GenericAdapter } from './generic.adapter';

export class MerchantAdapterRegistry {
  private adapters: Map<string, MerchantAdapter> = new Map();

  constructor() {
    this.register('amazon', defaultAmazonAdapter);
    this.register('flipkart', defaultFlipkartAdapter);
    this.register('myntra', defaultMyntraAdapter);
    this.register('ajio', defaultAjioAdapter);
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
    if (lower.includes('myntra')) {
      return this.adapters.get('myntra') || defaultMyntraAdapter;
    }
    if (lower.includes('ajio')) {
      return this.adapters.get('ajio') || defaultAjioAdapter;
    }
    return this.adapters.get(lower) || defaultGenericAdapter;
  }
}

export const defaultAdapterRegistry = new MerchantAdapterRegistry();

export {
  AmazonAdapter,
  FlipkartAdapter,
  MyntraAdapter,
  AjioAdapter,
  GenericAdapter,
};
