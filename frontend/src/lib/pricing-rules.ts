import { getJson } from "@/lib/api";

export type PricingRules = {
  group_discount_rate: number;
  group_discount_percent: number;
  platform_product_markup_pct: number;
};

let cached: PricingRules | null = null;

export async function loadPricingRules(): Promise<PricingRules> {
  if (cached) return cached;
  try {
    const data = await getJson<PricingRules>("/platform/pricing-rules", false, true);
    cached = data;
    return data;
  } catch {
    return {
      group_discount_rate: 0.267,
      group_discount_percent: 27,
      platform_product_markup_pct: 15,
    };
  }
}

export function getGroupPriceFromRate(singlePrice: number, rate: number): number {
  return Math.round(singlePrice * (1 - rate));
}
