"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { formatMoney, type CurrencyCode } from "@/lib/currency";

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (amountUzs: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const STORAGE_KEY = "bozor-currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("UZS");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (stored && ["UZS", "USD", "KZT", "KGS", "TJS"].includes(stored)) {
      setCurrencyState(stored);
    }
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const formatPrice = useCallback((amountUzs: number) => formatMoney(amountUzs, currency), [currency]);

  const value = useMemo(() => ({ currency, setCurrency, formatPrice }), [currency, setCurrency, formatPrice]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
