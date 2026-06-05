"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Zap } from "lucide-react";

import { marketBtnGhost, marketBtnPrimary } from "@/components/market/market-ui";

type Props = {
  onBuy?: () => void;
  onCart?: () => void;
  disabled?: boolean;
};

export function PremiumActionButtons({ onBuy, onCart, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <motion.button
        type="button"
        disabled={disabled}
        whileTap={{ scale: 0.98 }}
        onClick={onBuy}
        className={`${marketBtnPrimary} flex-1 py-4 text-base`}
      >
        <Zap className="h-5 w-5" />
        Sotib olish
      </motion.button>
      <motion.button
        type="button"
        disabled={disabled}
        whileTap={{ scale: 0.98 }}
        onClick={onCart}
        className={`${marketBtnGhost} flex-1 py-4 text-base`}
      >
        <ShoppingBag className="h-5 w-5" />
        Savatga qo&apos;shish
      </motion.button>
    </div>
  );
}
