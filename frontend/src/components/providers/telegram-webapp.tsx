"use client";

import { useEffect } from "react";

import { initTelegramWebApp } from "@/lib/telegram-webapp";

/** Telegram Mini App: expand viewport and signal ready when opened inside Telegram. */
export function TelegramWebAppProvider() {
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return null;
}
