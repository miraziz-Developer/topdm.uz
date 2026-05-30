"use client";

import { useEffect, useRef } from "react";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

type Props = {
  onAuth: (user: Record<string, unknown>) => void;
};

export function TelegramLoginWidget({ onAuth }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!BOT || !ref.current) return;
    (window as Window & { onTelegramAuth?: (u: Record<string, unknown>) => void }).onTelegramAuth = onAuth;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "16");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    ref.current.innerHTML = "";
    ref.current.appendChild(script);
    return () => {
      delete (window as Window & { onTelegramAuth?: unknown }).onTelegramAuth;
    };
  }, [onAuth]);

  if (!BOT) return null;
  return <div ref={ref} className="flex justify-center rounded-2xl border border-border-subtle p-2" />;
}
