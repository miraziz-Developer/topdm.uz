import type { PremiumTariffCode } from "@/types/premium-banner";

export type BannerLifecycleStatus = "pending_payment" | "active" | "expired" | "cancelled" | "rejected";
export type BannerPaymentMethod = "coin" | "click";

export type CrmTariff = {
  code: PremiumTariffCode;
  name_uz: string;
  name_ru: string | null;
  priority_weight: number;
  dwell_ms: number;
  duration_days: number;
  badge_label: string | null;
  frame_style: string;
  price_uzs: number | null;
  coin_cost: number | null;
  price_coins: number | null;
};

export type CrmBannerCampaign = {
  id: string;
  shop_id: string;
  status: BannerLifecycleStatus;
  title: string | null;
  image_url: string;
  tariff_code: PremiumTariffCode;
  tariff_label: string;
  package_days: number | null;
  queue_position: number | null;
  amount_uzs: number | null;
  payment_method: string | null;
  paid_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  seconds_remaining: number;
  impressions_count: number;
  clicks_count: number;
  ctr_percent: number;
  is_active: boolean;
  created_at: string | null;
};

export type CrmBannerStats = {
  banner_id: string;
  status: BannerLifecycleStatus;
  impressions_count: number;
  clicks_count: number;
  ctr_percent: number;
  starts_at: string | null;
  ends_at: string | null;
  transactions: Array<{
    id: string;
    amount_uzs: number;
    coin_amount: number | null;
    tariff_code: string;
    payment_method: string;
    status: string;
    transaction_timestamp: string;
  }>;
};

export type MerchantWallet = {
  shop_id: string;
  coin_balance: number;
  coins_balance?: number;
  coin_uzs_rate: number;
};
