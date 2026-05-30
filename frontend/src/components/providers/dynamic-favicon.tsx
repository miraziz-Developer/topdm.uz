"use client";

import { useEffect } from "react";

import { BRAND } from "@/components/brand/brand-tokens";
import { useCartStore } from "@/stores/cart-store";

const DEFAULT_FAVICON = BRAND.assets.favicon;

function drawFavicon(badge: boolean) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement("link");
  link.rel = "icon";
  if (!link.parentElement) document.head.appendChild(link);

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, BRAND.colors.electric);
  grad.addColorStop(1, BRAND.colors.accent);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(8, 8, 48, 48, 14);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(20, 16, 24, 5);
  ctx.fillRect(28, 21, 5, 14);
  ctx.beginPath();
  ctx.arc(32, 46, 5, 0, Math.PI * 2);
  ctx.fill();

  if (badge) {
    ctx.fillStyle = BRAND.colors.accent;
    ctx.beginPath();
    ctx.arc(50, 14, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  link.href = canvas.toDataURL("image/png");
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
