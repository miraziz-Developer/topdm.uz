"use client";

import { useEffect, useState } from "react";
import { CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMerchantFinanceWallet, requestMerchantPayout } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

function parseAmount(raw: string): number {
  const n = Number.parseFloat(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatCardInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function MerchantSettlementCard() {
  const [wallet, setWallet] = useState<{ current_balance: string; frozen_balance: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [card, setCard] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getMerchantFinanceWallet()
      .then((res) => setWallet(res.wallet))
      .catch(() => setWallet(null));
  }, []);

  if (!wallet) return null;

  const current = parseAmount(wallet.current_balance);
  const frozen = parseAmount(wallet.frozen_balance);
  const cardDigits = card.replace(/\D/g, "");

  const submitPayout = async () => {
    const amountUzs = parseAmount(amount);
    if (amountUzs <= 0) {
      toast.error("Yechib olish summasini kiriting");
      return;
    }
    if (amountUzs > current) {
      toast.error("Balansda yetarli mablag' yo'q");
      return;
    }
    if (cardDigits.length !== 16) {
      toast.error("Karta raqami 16 ta raqamdan iborat bo'lishi kerak");
      return;
    }
    setSubmitting(true);
    try {
      const res = await requestMerchantPayout({ amount_uzs: amountUzs, card_number: cardDigits });
      setWallet(res.wallet);
      setOpen(false);
      setAmount("");
      setCard("");
      toast.success("So'rov yuborildi. Pul tez orada kartangizga o'tkaziladi.");
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "So'rov yuborilmadi";
      const human =
        message === "insufficient_balance"
          ? "Balansda yetarli mablag' yo'q"
          : message === "invalid_amount"
            ? "Summa noto'g'ri"
            : message;
      toast.error(human);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="crm-hero-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-electric-500/10">
          <Wallet className="h-5 w-5 text-electric-500" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-text-100">Pul tushishi</h3>
          <p className="text-xs text-text-400">Onlayn to&apos;lov (Click)</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="crm-stat-tile !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-400">Yechib olish mumkin</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-text-100">{formatPrice(current)}</p>
        </div>
        <div className="crm-stat-tile !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-400">Kutilmoqda (escrow)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-text-100">{formatPrice(frozen)}</p>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-electric-500/20 bg-electric-500/[0.03] p-4">
          <Input
            label="Summa (so'm)"
            inputMode="numeric"
            placeholder="100000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          />
          <Input
            label="Uzcard / Humo karta raqami"
            inputMode="numeric"
            placeholder="8600 1234 5678 9012"
            value={card}
            onChange={(e) => setCard(formatCardInput(e.target.value))}
            leftIcon={<CreditCard className="h-4 w-4" />}
          />
          <div className="flex gap-2">
            <Button className="flex-1" isLoading={submitting} disabled={submitting} onClick={submitPayout}>
              So&apos;rov yuborish
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => setOpen(false)}>
              Bekor
            </Button>
          </div>
          <p className="text-[11px] text-text-400">
            Pul ko&apos;rsatilgan kartaga o&apos;tkaziladi. Tasdiqlangach balansdan yechiladi.
          </p>
        </div>
      ) : (
        <Button
          className="mt-4 w-full"
          disabled={current <= 0}
          leftIcon={<CreditCard className="h-4 w-4" />}
          onClick={() => {
            setAmount(String(current));
            setOpen(true);
          }}
        >
          {current > 0 ? "Pul yechib olish" : "Yechib olish uchun mablag' yo'q"}
        </Button>
      )}

      <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-text-400">
        <li>• Onlayn to&apos;lov (Click) — mijoz «olib ketdi» dan keyin muzlatilgandan chiqadi.</li>
        <li>• Naqd/terminal — darhol sizda; platforma komissiyasi alohida hisoblanadi.</li>
        <li>• Muzlatilgan summa — buyurtma yakunlanguncha saqlanadi.</li>
      </ul>
    </section>
  );
}
