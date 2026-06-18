export type PackCompositionRow = { size: string; qty: number };

export type WholesalePackPayload = {
  units_per_pack: number;
  composition: PackCompositionRow[];
};

export type WholesaleProductFields = {
  sale_type: "Chakana" | "Optom";
  pricing_unit: "piece" | "pack";
  min_order_quantity: number;
  units_per_pack?: number;
  wholesale_pack?: WholesalePackPayload;
};

export function emptyPackComposition(): PackCompositionRow[] {
  return [{ size: "M", qty: 1 }];
}

export function compositionTotal(rows: PackCompositionRow[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
}

export function parseWholesaleFromProduct(item: {
  sale_type?: string;
  pricing_unit?: string;
  min_order_quantity?: number;
  units_per_pack?: number | null;
  attributes?: Record<string, unknown>;
}): WholesaleProductFields {
  const pack = (item.attributes?.wholesale_pack || {}) as {
    units_per_pack?: number;
    composition?: PackCompositionRow[];
  };
  const saleType = item.sale_type === "Optom" ? "Optom" : "Chakana";
  const pricingUnit =
    item.pricing_unit === "pack" || saleType === "Optom" ? "pack" : "piece";
  return {
    sale_type: saleType,
    pricing_unit: pricingUnit,
    min_order_quantity: Math.max(1, Number(item.min_order_quantity) || 1),
    units_per_pack: Number(item.units_per_pack || pack.units_per_pack) || undefined,
    wholesale_pack: pack.units_per_pack
      ? {
          units_per_pack: Number(pack.units_per_pack),
          composition: Array.isArray(pack.composition) ? pack.composition : emptyPackComposition(),
        }
      : undefined,
  };
}

export function defaultWholesaleForShop(shopType?: string | null): WholesaleProductFields {
  const st = (shopType || "chakana").toLowerCase();
  if (st === "optom") {
    return {
      sale_type: "Optom",
      pricing_unit: "pack",
      min_order_quantity: 1,
      units_per_pack: 12,
      wholesale_pack: { units_per_pack: 12, composition: emptyPackComposition() },
    };
  }
  return {
    sale_type: "Chakana",
    pricing_unit: "piece",
    min_order_quantity: 1,
  };
}

export function validateWholesaleFields(fields: WholesaleProductFields): string | null {
  if (fields.sale_type === "Optom" && fields.pricing_unit === "pack") {
    const upp = Number(fields.units_per_pack || fields.wholesale_pack?.units_per_pack || 0);
    if (upp < 2) return "Pachkada kamida 2 dona bo'lishi kerak";
    const comp = fields.wholesale_pack?.composition || [];
    if (comp.length) {
      const total = compositionTotal(comp);
      if (total !== upp) {
        return `Pachka tarkibi (${total}) va pachka soni (${upp}) mos kelmaydi`;
      }
    }
  }
  return null;
}

export function wholesaleToCreateForm(fields: WholesaleProductFields): Record<string, string> {
  const out: Record<string, string> = {
    sale_type: fields.sale_type,
    pricing_unit: fields.pricing_unit,
    min_order_quantity: String(fields.min_order_quantity),
  };
  if (fields.sale_type === "Optom" && fields.pricing_unit === "pack") {
    const upp = fields.units_per_pack || fields.wholesale_pack?.units_per_pack;
    if (upp) out.units_per_pack = String(upp);
    if (fields.wholesale_pack) {
      out.wholesale_json = JSON.stringify(fields.wholesale_pack);
    }
  }
  return out;
}
