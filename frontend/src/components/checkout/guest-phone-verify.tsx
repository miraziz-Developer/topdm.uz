"use client";

import { CheckCircle2, ExternalLink, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  sendOrderLookupOtp,
  startOrderLookupTelegram,
  verifyOrderLookupOtp,
} from "@/lib/api";
import { ApiError } from "@/lib/http-client";

type Channel = "telegram" | "sms";

type Props = {
  /** Normalizatsiya qilingan E.164 raqam (+998XXXXXXXXX). */
  phoneE164: string;
  /** Raqam to'liq va to'g'ri kiritilganmi. */
  phoneValid: boolean;
  /** Telefon tasdiqlangach chaqiriladi — verification_token bilan. */
  onVerified: (verificationToken: string, phoneE164: string) => void;
  /** Tashqi holat: allaqachon tasdiqlangan. */
  verified?: boolean;
};

export function GuestPhoneVerify({ phoneE164, phoneValid, onVerified, verified }: Props) {
  const { push } = useToast();
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [channel, setChannel] = useState<Channel>("telegram");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        Telefon tasdiqlandi
      </div>
    );
  }

  const guardPhone = () => {
    if (!phoneValid) {
      push("Avval to'liq telefon raqamini kiriting", "error");
      return false;
    }
    return true;
  };

  const errText = (err: unknown, fallback: string) =>
    err instanceof ApiError && err.message ? err.message : fallback;

  const startTelegram = async () => {
    if (!guardPhone()) return;
    setLoading(true);
    try {
      const res = await startOrderLookupTelegram(phoneE164);
      setChannel("telegram");
      setDeepLink(res.deep_link);
      setStage("code");
      setCode("");
    } catch (err) {
      push(errText(err, "Telegram havolasi ochilmadi. SMS orqali urinib ko'ring."), "error");
    } finally {
      setLoading(false);
    }
  };

  const startSms = async () => {
    if (!guardPhone()) return;
    setLoading(true);
    try {
      const res = await sendOrderLookupOtp(phoneE164);
      setChannel("sms");
      setDeepLink(null);
      setStage("code");
      setCode("");
      if (res.dev_otp) {
        push(`Test rejimi: kod ${res.dev_otp}`, "info");
      } else {
        push("Tasdiqlash kodi SMS orqali yuborildi", "success");
      }
    } catch (err) {
      push(errText(err, "SMS yuborilmadi. Qayta urinib ko'ring."), "error");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (code.trim().length < 4) {
      push("Kodni to'liq kiriting", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOrderLookupOtp(phoneE164, code.trim());
      onVerified(res.verification_token, phoneE164);
      push("Telefon tasdiqlandi", "success");
    } catch (err) {
      push(errText(err, "Kod noto'g'ri yoki muddati o'tgan."), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-electric-500/15 bg-electric-500/[0.03] p-3">
      {stage === "idle" ? (
        <>
          <p className="text-xs text-ink-600">
            Buyurtmani tasdiqlash uchun telefon raqamingizni tekshiramiz — tez va bepul.
          </p>
          <Button
            variant="brand"
            className="w-full"
            isLoading={loading}
            disabled={loading}
            leftIcon={<Send className="h-4 w-4" />}
            onClick={startTelegram}
          >
            Telegram orqali kod olish
          </Button>
          <button
            type="button"
            className="block w-full text-center text-xs font-medium text-ink-500 hover:text-ink-800 disabled:opacity-50"
            disabled={loading}
            onClick={startSms}
          >
            Telegramim yo&apos;q — SMS orqali yuborish
          </button>
        </>
      ) : (
        <>
          {channel === "telegram" && deepLink ? (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-electric px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_18px_rgba(0,102,255,0.38)] transition hover:brightness-105"
            >
              <ExternalLink className="h-4 w-4" />
              Telegramni ochish
            </a>
          ) : null}
          <p className="text-xs text-ink-600">
            {channel === "telegram"
              ? "Telegramda Bozorliii bot chatiga kelgan 6 xonali kodni kiriting."
              : "SMS orqali kelgan kodni kiriting."}
          </p>
          <Input
            label="Tasdiqlash kodi"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          <div className="flex gap-2">
            <Button
              variant="brand"
              className="flex-1"
              isLoading={loading}
              disabled={loading}
              onClick={confirm}
            >
              Tasdiqlash
            </Button>
            <Button
              variant="ghost"
              className="shrink-0"
              disabled={loading}
              onClick={channel === "telegram" ? startTelegram : startSms}
            >
              Qayta
            </Button>
          </div>
          <button
            type="button"
            className="block w-full text-center text-[11px] text-ink-400 hover:text-ink-700 disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              setStage("idle");
              setCode("");
              setDeepLink(null);
            }}
          >
            ← Boshqa usulni tanlash
          </button>
        </>
      )}
    </div>
  );
}
