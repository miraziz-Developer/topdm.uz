"use client";

import { useEffect } from "react";

/** Forces dark canvas on /market routes (overrides global light mesh-bg). */
export function MarketThemeBody() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("premium-market-root");
    body.classList.add("premium-market-active");
    return () => {
      html.classList.remove("premium-market-root");
      body.classList.remove("premium-market-active");
    };
  }, []);
  return null;
}
