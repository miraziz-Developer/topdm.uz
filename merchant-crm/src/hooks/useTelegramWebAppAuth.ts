"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { postJson } from "@/lib/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth";
import { isMerchantTokenValid } from "@/lib/merchant-session";
import { safeCrmNextPath } from "@/lib/crm-next-path";
import { getTelegramWebApp, waitForWebAppInitData } from "@/lib/telegram-webapp";

type Options = {
  shopId: string | null;
  nextPath: string | null;
  /** Token bo'lsa darhol next ga o'tish */
  skipIfAuthed?: boolean;
};

export function useTelegramWebAppAuth({ shopId, nextPath, skipIfAuthed = true }: Options) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const destination = safeCrmNextPath(nextPath);

  const runAuth = useCallback(async () => {
    const tg = getTelegramWebApp();
    tg?.ready();
    tg?.expand();

    if (skipIfAuthed && getAccessToken()) {
      if (await isMerchantTokenValid()) {
        router.replace(destination);
        return;
      }
      clearAccessToken();
    }

    const initData = await waitForWebAppInitData();
    if (!initData) {
      setLoading(false);
      setError(
        "Telegram ma'lumoti topilmadi. Botdagi «CRM Panel» yoki «Xarita» tugmasini qayta bosing. Kompyuterda Telegram yangi versiyasi kerak.",
      );
      return;
    }

    try {
      const res = await postJson<{ token: string; role: string }>("/auth/telegram/webapp", {
        init_data: initData,
        shop_id: shopId,
      });
      if (res.role !== "merchant" || !res.token) {
        setError("Merchant hisob topilmadi. Botda /register yoki /start shop_<UUID> bajaring.");
        setLoading(false);
        return;
      }
      setAccessToken(res.token);
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirish xatosi");
      setLoading(false);
    }
  }, [destination, router, shopId, skipIfAuthed]);

  useEffect(() => {
    void runAuth();
  }, [runAuth]);

  return { loading, error, destination };
}
