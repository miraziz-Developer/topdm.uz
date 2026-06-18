"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { triggerHaptic } from "@/lib/haptics";

const DEFAULT_SIZES = ["S", "M", "L", "XL"] as const;

const APPAREL_HINT = /kiyim|ko'ylak|kurtka|shim|futbolka|dress|shirt|pants|jacket|clothing|shoes|tufli|sumka|accessory/i;

type Props = {
  sizes?: string[];
  category?: string | null;
};

export function SizeRecommender({ sizes, category }: Props) {
  const availableSizes = useMemo(() => {
    const fromProduct = (sizes ?? []).map((s) => s.trim()).filter(Boolean);
    return fromProduct.length ? fromProduct : [...DEFAULT_SIZES];
  }, [sizes]);

  const show = useMemo(() => {
    if (sizes?.length) return true;
    const cat = (category ?? "").trim();
    return !cat || APPAREL_HINT.test(cat);
  }, [category, sizes]);

  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("72");
  const [size, setSize] = useState<string | null>(null);

  const bmi = useMemo(() => {
    const h = Number(height) / 100;
    const w = Number(weight);
    if (!h || !w) return 0;
    return w / (h * h);
  }, [height, weight]);

  const recommend = () => {
    triggerHaptic();
    const ordered = availableSizes;
    const idx =
      bmi < 21
        ? 0
        : bmi < 25
          ? Math.min(1, ordered.length - 1)
          : bmi < 28
            ? Math.min(2, ordered.length - 1)
            : ordered.length - 1;
    setSize(ordered[idx] ?? ordered[0] ?? null);
  };

  if (!show) return null;

  return (
    <div className="rounded-3xl border border-border-subtle bg-white p-5">
      <h3 className="text-lg font-semibold text-ink-900">O&apos;lcham tavsiyasi</h3>
      <p className="mt-1 text-sm text-ink-500">
        Bo&apos;y va vazn bo&apos;yicha taxminiy o&apos;lcham. Aniq razmer uchun do&apos;kondagi jadval yoki &quot;Band qilish&quot;dan
        foydalaning.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input label="Bo'y (sm)" value={height} onChange={(event) => setHeight(event.target.value)} />
        <Input label="Vazn (kg)" value={weight} onChange={(event) => setWeight(event.target.value)} />
      </div>
      <Button className="mt-4" onClick={recommend}>
        Taxminiy o&apos;lcham
      </Button>
      {size ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((item) => {
              const active = item === size;
              return (
                <motion.div
                  key={item}
                  animate={{ scale: active ? 1.04 : 1 }}
                  className={`rounded-2xl border px-3 py-3 text-center text-sm font-semibold ${
                    active ? "border-electric-500 bg-electric-500/10 text-electric-500" : "border-border-subtle bg-elevated text-ink-500"
                  }`}
                >
                  {item}
                </motion.div>
              );
            })}
          </div>
          <p className="text-sm text-ink-600">
            Taxminiy mos o&apos;lcham: <span className="font-semibold text-electric-600">{size}</span>. Brend va model
            farq qilishi mumkin.
          </p>
        </div>
      ) : null}
    </div>
  );
}
