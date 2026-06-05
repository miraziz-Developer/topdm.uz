"use client";

import Link from "next/link";
import { Globe2, Store } from "lucide-react";
import { motion } from "framer-motion";

import { marketGlass, marketBtnGhost, marketBtnPrimary } from "@/components/market/market-ui";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";

export function PremiumMarketEntry() {
  const china = isChinaMarketEnabled();
  return (
    <section className="mx-4 mb-4 sm:mx-0">
      <div className={`${marketGlass} overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25)]`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400/90">Premium Market</p>
        <h2 className="mt-2 text-lg font-bold text-white sm:text-xl">
          {china ? "Xitoy va ichki bozor — yakuniy narx" : "Mahalliy bozor — yakuniy narx"}
        </h2>
        <p className="mt-1 text-sm text-white/55">
          {china
            ? "Taobao + mahalliy do'konlar, ustama va kargo hisoblangan"
            : "Ippodrom va Abu Saxiy do'konlari — Bozorliii.uz"}
        </p>
        <div className={china ? "mt-4 grid grid-cols-2 gap-2" : "mt-4"}>
          {china ? (
            <Link href="/market/china">
              <motion.span whileTap={{ scale: 0.98 }} className={`${marketBtnPrimary} w-full py-3`}>
                <Globe2 className="h-4 w-4 shrink-0" />
                Xitoy
              </motion.span>
            </Link>
          ) : null}
          <Link href="/market/local">
            <motion.span whileTap={{ scale: 0.98 }} className={`${china ? marketBtnGhost : marketBtnPrimary} w-full py-3`}>
              <Store className="h-4 w-4 shrink-0" />
              Ichki bozor
            </motion.span>
          </Link>
        </div>
      </div>
    </section>
  );
}
