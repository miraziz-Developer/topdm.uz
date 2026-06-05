"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { getTelegramWebApp } from "@/lib/telegram-webapp";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@+/, "") ?? "";

export function TelegramCrmBanner() {
  const [inTelegram, setInTelegram] = useState(false);

  useEffect(() => {
    setInTelegram(Boolean(getTelegramWebApp()?.initData));
  }, []);

  if (!inTelegram) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-electric-500/20 bg-electric-500/[0.06] px-4 py-3">
      <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-electric-500" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-text-100">Telegram + CRM — bitta tizim</p>
        <p className="mt-0.5 text-text-400">
          Bildirishnomalar botda keladi, javob va buyurtmalar shu yerda. Alohida ilova yo&apos;q.
          {BOT ? (
            <>
              {" "}
              Bot: @{BOT}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
