"use client";

import { useEffect } from "react";

import { BRAND } from "@/components/brand/brand-tokens";
import { useCartStore } from "@/stores/cart-store";

const DEFAULT_FAVICON = BRAND.assets.favicon;

function drawFavicon(badge: boolean) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement("link");
  link.rel = "icon";
  if (!link.parentElement) document.head.appendChild(link);

  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = BRAND.assets.icon;
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(img, 0, 0, 64, 64);

    if (badge) {
      ctx.fillStyle = BRAND.colors.accent;
      ctx.beginPath();
      ctx.arc(50, 14, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    link.href = canvas.toDataURL("image/png");
  };
}

export function DynamicFavicon() {
  const totalItems = useCartStore((state) => state.totalItems());

  useEffect(() => {
    let pulse = false;
    const update = () => {
      const badge = document.hidden && totalItems > 0;
      drawFavicon(badge && pulse);
      pulse = !pulse;
    };

    update();
    const interval = totalItems > 0 ? window.setInterval(update, 900) : undefined;
    document.addEventListener("visibilitychange", update);

    return () => {
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (link) link.href = DEFAULT_FAVICON;
    };
  }, [totalItems]);

  return null;
}
