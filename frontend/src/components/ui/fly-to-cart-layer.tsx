"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

import { useFlyToCartStore } from "@/stores/fly-to-cart-store";

function getCartTarget() {
  const anchor = document.querySelector<HTMLElement>("[data-cart-anchor]");
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - 32, y: rect.top + rect.height / 2 - 32 };
  }
  return { x: window.innerWidth - 72, y: 24 };
}

export function FlyToCartLayer() {
  const payload = useFlyToCartStore((state) => state.payload);
  const clear = useFlyToCartStore((state) => state.clear);
  const [target, setTarget] = useState({ x: 320, y: 24 });

  useEffect(() => {
    const sync = () => setTarget(getCartTarget());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!payload) return;
    setTarget(getCartTarget());
    const timer = window.setTimeout(() => clear(), 720);
    return () => window.clearTimeout(timer);
  }, [clear, payload]);

  return (
    <AnimatePresence>
      {payload ? (
        <motion.div
          initial={{ opacity: 1, x: payload.x, y: payload.y, scale: 1 }}
          animate={{
            opacity: 0.2,
            x: [payload.x, payload.x + (target.x - payload.x) * 0.45, target.x],
            y: [payload.y, payload.y - 96, target.y],
            scale: 0.35,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed z-[80] h-16 w-16 overflow-hidden rounded-xl border border-border-subtle bg-white shadow-modal"
        >
          <Image src={payload.image} alt="" fill className="object-cover" sizes="64px" unoptimized />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
