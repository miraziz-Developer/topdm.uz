"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type TelegramAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type TelegramLoginButtonProps = {
  botUsername: string;
  onAuth: (user: TelegramAuthPayload) => void;
  className?: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

export function TelegramLoginButton({ botUsername, onAuth, className }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    window.onTelegramAuth = (user) => onAuth(user);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "16");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botUsername, onAuth]);

  if (!botUsername) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-elevated/80 p-4 text-center text-sm text-ink-500">
        Telegram login: <code className="text-xs">TELEGRAM_BOT_USERNAME</code> sozlang
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center justify-center rounded-2xl border border-border-subtle bg-[#2AABEE]/5 p-2",
        className,
      )}
      ref={containerRef}
    />
  );
}
