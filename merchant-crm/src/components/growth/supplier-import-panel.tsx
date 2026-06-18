"use client";

import { Download, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CrmSection } from "@/components/crm/crm-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getSupplierProducts,
  importSupplierProduct,
  linkSupplier,
  listSuppliers,
  type SupplierBrief,
  type SupplierProductBrief,
} from "@/lib/api";

export function SupplierImportPanel() {
  const [slug, setSlug] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<SupplierBrief | null>(null);
  const [products, setProducts] = useState<SupplierProductBrief[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    listSuppliers()
      .then((r) => setSuppliers(r.items))
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  const onLink = async () => {
    if (!slug.trim()) return;
    setBusy(true);
    try {
      await linkSupplier(slug.trim());
      toast.success("Ta'minotchi ulandi");
      setSlug("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ulanmadi");
    } finally {
      setBusy(false);
    }
  };

  const loadProducts = async (s: SupplierBrief) => {
    setActiveSupplier(s);
    try {
      const res = await getSupplierProducts(s.shop_id);
      setProducts(res.items);
    } catch {
      toast.error("Mahsulotlar yuklanmadi");
    }
  };

  const onImport = async (productId: string) => {
    setBusy(true);
    try {
      const res = await importSupplierProduct(productId);
      toast.success(`Import: ${res.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmSection
      title="Ta'minotchidan import"
      description="Optomchi Bozorliii da bo'lsa — 1 tugma bilan katalogingizga nusxa"
      icon={Truck}
    >
      <p className="mb-3 text-xs text-text-400">
        Postavshigingizga ayting: &quot;Bozorliii ga o&apos;ting — men sizdan bir bosishda mol olaman&quot;
      </p>
      <div className="flex gap-2">
        <Input
          label="Ta'minotchi slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="masalan: optom-aka"
        />
        <Button type="button" className="mt-6 shrink-0" disabled={busy} onClick={() => void onLink()}>
          Ulash
        </Button>
      </div>

      {suppliers.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suppliers.map((s) => (
            <button
              key={s.shop_id}
              type="button"
              onClick={() => void loadProducts(s)}
              className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                activeSupplier?.shop_id === s.shop_id
                  ? "bg-electric-500/10 ring-electric-500/40 text-electric-700"
                  : "bg-canvas ring-border-subtle text-text-300"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {products.length ? (
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm ring-1 ring-border-subtle"
            >
              <span className="truncate text-text-100">{p.name}</span>
              <button
                type="button"
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-electric-600"
                onClick={() => void onImport(p.id)}
              >
                <Download className="h-3.5 w-3.5" />
                Import
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </CrmSection>
  );
}
