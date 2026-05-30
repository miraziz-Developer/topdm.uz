"use client";

import { Printer } from "lucide-react";

import { BRAND } from "@/components/brand/brand-tokens";
import { Button } from "@/components/ui/button";
import type { MerchantShareKit } from "@/lib/api";

type Props = {
  kit: MerchantShareKit;
};

const SITE_ORIGIN =
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://topdim.uz").replace(/\/$/, "") ||
  "https://topdim.uz";

/** Chop etish uchun vitrina posteri — Topdim brendi + do'kon nomi + QR */
export function ShopQrPoster({ kit }: Props) {
  const printPoster = () => {
    const win = window.open("", "_blank", "width=420,height=680");
    if (!win) return;
    const safeName = kit.shop_name.replace(/</g, "&lt;");
    const logoUrl = `${SITE_ORIGIN}/brand/topdim-logo.svg`;
    win.document.write(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${safeName} — ${BRAND.name}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Outfit, system-ui, sans-serif;
    margin: 0;
    padding: 28px 24px;
    text-align: center;
    background: linear-gradient(180deg, #f2f4f8 0%, #fff 40%);
    color: #030308;
  }
  .brand-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; }
  .brand-row img { height: 36px; }
  h1 { font-size: 24px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.02em; }
  .sub { color: #4a4f5c; font-size: 14px; margin: 0 0 24px; line-height: 1.4; }
  .qr-wrap {
    display: inline-block;
    padding: 16px;
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(3,3,8,0.08);
    border: 2px solid rgba(0,102,255,0.12);
  }
  .qr-wrap img { width: 260px; height: auto; display: block; }
  .url { margin-top: 18px; font-size: 12px; color: #0066ff; font-weight: 600; word-break: break-all; }
  .foot { margin-top: 20px; font-size: 11px; color: #7a8194; }
  .accent { color: #ff4d12; font-weight: 700; }
</style></head><body>
  <div class="brand-row">
    <img src="${logoUrl}" alt="${BRAND.name}" />
  </div>
  <h1>${safeName}</h1>
  <p class="sub">Skanerlang — <span class="accent">Topdim</span> orqali do'konga kiring<br/>Mahsulotlar, narxlar va yo'l xaritasi</p>
  <div class="qr-wrap">
    <img src="${kit.qr_poster_url || kit.qr_download_url}" alt="QR" />
  </div>
  <p class="url">${kit.shop_url}</p>
  <p class="foot">${BRAND.name} · AI bozor marketplace</p>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="rounded-2xl border border-dashed border-gold-500/30 bg-gradient-to-br from-electric-500/5 to-gold-500/5 p-4">
      <p className="text-sm font-medium text-text-100">Vitrina posteri (Topdim brendi)</p>
      <p className="mt-1 text-xs text-text-400">Do&apos;kon nomi + QR + topdim.uz logosi — chop etish uchun</p>
      <Button type="button" variant="secondary" className="mt-3" onClick={printPoster}>
        <Printer className="mr-1 h-4 w-4" />
        Posterni chop etish
      </Button>
    </div>
  );
}
