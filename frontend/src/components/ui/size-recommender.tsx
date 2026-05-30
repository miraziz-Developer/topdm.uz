"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { triggerHaptic } from "@/lib/haptics";

const SIZES = ["S", "M", "L", "XL"] as const;

export function SizeRecommender() {
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("72");
  const [size, setSize] = useState<(typeof SIZES)[number] | null>(null);
  const [confidence, setConfidence] = useState(0);

  const bmi = useMemo(() => {
    const h = Number(height) / 100;
    const w = Number(weight);
    if (!h || !w) return 0;
    return w / (h * h);
  }, [height, weight]);

  const recommend = () => {
    triggerHaptic();
    const nextSize = bmi < 21 ? "S" : bmi < 25 ? "M" : bmi < 28 ? "L" : "XL";
    const nextConfidence = bmi < 21 ? 92 : bmi < 25 ? 95 : bmi < 28 ? 93 : 90;
    setSize(nextSize);
    setConfidence(nextConfidence);
  };

  return (
    <div className="rounded-3xl border border-border-subtle bg-white p-5">
      <h3 className="text-lg font-semibold text-ink-900">O&apos;lcham tavsiyasi</h3>
      <p className="mt-1 text-sm text-ink-500">Bo&apos;y va vazn bo&apos;yicha fit indikatori.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input label="Bo'y (sm)" value={height} onChange={(event) => setHeight(event.target.value)} />
        <Input label="Vazn (kg)" value={weight} onChange={(event) => setWeight(event.target.value)} />
      </div>
      <Button className="mt-4" onClick={recommend}>
        O&apos;lchamni hisoblash
      </Button>
      {size ? (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((item) => {
              const active = item === size;
              return (
                <motion.div
                  key={item}
                  animate={{ scale: active ? 1.04 : 1 }}
                  className={`rounded-2xl border px-3 py-4 text-center text-sm font-semibold ${
                    active ? "border-electric-500 bg-electric-500/10 text-electric-500" : "border-border-subtle bg-elevated text-ink-500"
                  }`}
                >
                  {item}
                </motion.div>
              );
            })}
          </div>
          <motion.div className="h-2 overflow-hidden rounded-full bg-elevated">
            <motion.div
              className="h-full rounded-full bg-gradient-electric"
              initial={{ width: 0 }}
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </motion.div>
          <p className="text-sm text-electric-500">
            Sizga bu modelning <span className="font-semibold">{size}</span> o&apos;lchami {confidence}% mos tushadi.
          </p>
        </div>
      ) : null}
    </div>
  );
}
