"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  compositionTotal,
  emptyPackComposition,
  type WholesaleProductFields,
} from "@/lib/wholesale-pack";

type Props = {
  shopType?: string | null;
  value: WholesaleProductFields;
  onChange: (next: WholesaleProductFields) => void;
};

export function WholesalePackEditor({ shopType, value, onChange }: Props) {
  const st = (shopType || "chakana").toLowerCase();
  const canPickSaleType = st === "hybrid";
  const forceOptom = st === "optom";
  const forceChakana = st === "chakana";

  const isPack = value.sale_type === "Optom" && value.pricing_unit === "pack";
  const comp = value.wholesale_pack?.composition || emptyPackComposition();
  const upp = value.units_per_pack || value.wholesale_pack?.units_per_pack || 12;

  const setSaleType = (sale: "Chakana" | "Optom") => {
    if (sale === "Optom") {
      onChange({
        sale_type: "Optom",
        pricing_unit: "pack",
        min_order_quantity: value.min_order_quantity || 1,
        units_per_pack: upp,
        wholesale_pack: value.wholesale_pack || { units_per_pack: upp, composition: comp },
      });
    } else {
      onChange({
        sale_type: "Chakana",
        pricing_unit: "piece",
        min_order_quantity: 1,
      });
    }
  };

  const updatePack = (patch: Partial<WholesaleProductFields["wholesale_pack"]> & { units_per_pack?: number }) => {
    const nextUpp = patch.units_per_pack ?? upp;
    onChange({
      ...value,
      units_per_pack: nextUpp,
      wholesale_pack: {
        units_per_pack: nextUpp,
        composition: patch.composition ?? comp,
      },
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border-subtle bg-canvas/60 p-4">
      <div>
        <p className="text-sm font-semibold text-text-100">Sotuv formati</p>
        <p className="mt-0.5 text-xs text-text-400">
          {forceOptom
            ? "Optomchi — mahsulot pachkada sotiladi"
            : forceChakana
              ? "Chakana do'kon — donalab sotiladi"
              : "Chakana yoki optom (pachka) tanlang"}
        </p>
      </div>

      {canPickSaleType ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={value.sale_type === "Chakana" ? "primary" : "secondary"}
            onClick={() => setSaleType("Chakana")}
          >
            Chakana (dona)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value.sale_type === "Optom" ? "primary" : "secondary"}
            onClick={() => setSaleType("Optom")}
          >
            Optom (pachka)
          </Button>
        </div>
      ) : null}

      {isPack ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="1 pachkada nechta dona"
              value={String(upp)}
              onChange={(e) => updatePack({ units_per_pack: Math.max(2, Number(e.target.value) || 0) })}
              inputMode="numeric"
            />
            <Input
              label="Minimal buyurtma (pachka)"
              value={String(value.min_order_quantity)}
              onChange={(e) =>
                onChange({ ...value, min_order_quantity: Math.max(1, Number(e.target.value) || 1) })
              }
              inputMode="numeric"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-text-300">Pachka ichidagi razmerlar</p>
            <div className="space-y-2">
              {comp.map((row, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <Input
                    label={idx === 0 ? "Razmer" : undefined}
                    value={row.size}
                    onChange={(e) => {
                      const next = [...comp];
                      next[idx] = { ...next[idx], size: e.target.value };
                      updatePack({ composition: next });
                    }}
                    placeholder="M"
                    className="flex-1"
                  />
                  <Input
                    label={idx === 0 ? "Dona" : undefined}
                    value={String(row.qty)}
                    onChange={(e) => {
                      const next = [...comp];
                      next[idx] = { ...next[idx], qty: Math.max(1, Number(e.target.value) || 0) };
                      updatePack({ composition: next });
                    }}
                    inputMode="numeric"
                    className="w-24"
                  />
                  <button
                    type="button"
                    onClick={() => updatePack({ composition: comp.filter((_, i) => i !== idx) })}
                    className="mb-1 rounded-lg p-2 text-text-400 hover:bg-surface hover:text-red-500"
                    aria-label="O'chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => updatePack({ composition: [...comp, { size: "", qty: 1 }] })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Razmer qo&apos;shish
            </Button>
            <p className="mt-2 text-xs text-text-400">
              Jami: {compositionTotal(comp)} dona / pachka
              {compositionTotal(comp) !== upp ? (
                <span className="text-amber-600"> — pachka soni bilan mos emas</span>
              ) : null}
            </p>
          </div>

          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            <strong>Narx</strong> — bitta pachka narxi (yuqoridagi «Sizning narxingiz» maydoni).
            Ombor — nechta <strong>pachka</strong> qolgani.
          </p>
        </div>
      ) : (
        <p className="text-xs text-text-400">Narx va ombor — bitta dona (dona) uchun.</p>
      )}
    </div>
  );
}
