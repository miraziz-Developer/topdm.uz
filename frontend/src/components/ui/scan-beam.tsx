"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type ScanBeamProps = {
  active: boolean;
  variant?: "gold" | "electric";
  className?: string;
};

export function ScanBeam({ active, variant = "electric", className }: ScanBeamProps) {
  if (!active) return null;

  const isElectric = variant === "electric";

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      <motion.div
        className={cn(
          "absolute inset-x-0 h-24 bg-gradient-to-b from-transparent to-transparent",
          isElectric ? "via-electric-500/40" : "via-gold-500/35",
        )}
        initial={{ top: "-20%" }}
        animate={{ top: ["-20%", "110%"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className={cn(
          "absolute inset-0 rounded-[inherit] border",
          isElectric ? "border-electric-500/45" : "border-gold-500/40",
        )}
        animate={{ opacity: [0.35, 0.95, 0.35] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      <motion.div
        className={cn(
          "absolute inset-x-0 z-10 h-[2px]",
          isElectric
            ? "bg-electric-400 shadow-[0_0_14px_2px_rgba(0,102,255,0.75)]"
            : "bg-gold-400 shadow-[0_0_12px_rgba(255,77,18,0.5)]",
        )}
        initial={{ top: "0%" }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      <div
        className={cn(
          "absolute inset-0 bg-[size:24px_24px]",
          isElectric
            ? "bg-[linear-gradient(rgba(0,102,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,102,255,0.07)_1px,transparent_1px)]"
            : "bg-[linear-gradient(rgba(245,200,66,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,200,66,0.08)_1px,transparent_1px)]",
        )}
      />
    </div>
  );
}
