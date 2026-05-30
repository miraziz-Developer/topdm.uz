import { PackageCheck, PackageX, Truck } from "lucide-react";

import type { Product } from "@/types";

type StockStatusProps = {
  product: Product;
};

export function StockStatus({ product }: StockStatusProps) {
  const stock = product.stock_count;
  const lowStock = typeof stock === "number" && stock > 0 && stock <= 3;

  if (product.is_available && (stock === undefined || stock > 0)) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <PackageCheck className="h-3.5 w-3.5" />
          Hozir sotuvda
        </span>
        {typeof stock === "number" && stock > 0 ? (
          <span
            className={
              lowStock
                ? "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                : "text-[11px] text-ink-500"
            }
          >
            {lowStock ? `Oxirgi ${stock} dona` : `${stock} dona mavjud`}
          </span>
        ) : null}
      </span>
    );
  }

  if (typeof stock === "number" && stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
        <PackageX className="h-3.5 w-3.5" />
        Vaqtincha tugagan — keyinroq qayting
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
      <Truck className="h-3.5 w-3.5" />
      Ertaga soat 10:00 da keladi
    </span>
  );
}
