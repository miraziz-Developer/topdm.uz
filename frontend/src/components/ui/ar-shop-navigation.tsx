"use client";

import { motion } from "framer-motion";
import { MapPin, Navigation2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { IppodromMarketMap } from "@/components/ui/ippodrom-market-map";
import { parseShopLocation } from "@/lib/shop-location";
import { useLocationStore } from "@/stores/location-store";
import type { Product } from "@/types";

type ArShopNavigationProps = {
  product: Product;
  nearbyShops?: Product[];
  open: boolean;
  onClose: () => void;
};

export function ArShopNavigation({ product, nearbyShops = [], open, onClose }: ArShopNavigationProps) {
  const setCurrentBlock = useLocationStore((state) => state.setCurrentBlock);
  const pin = parseShopLocation(product.shop);
  const [routeDrawKey, setRouteDrawKey] = useState(0);
  const shops = useMemo(
    () => [product.shop, ...nearbyShops.map((item) => item.shop).filter((shop) => shop.id !== product.shop.id)],
    [nearbyShops, product.shop],
  );

  useEffect(() => {
    if (!open) return;
    setRouteDrawKey((key) => key + 1);
  }, [open]);

  const startIndoorNavigation = () => {
    setCurrentBlock(`${pin.block}-blok`);
    setRouteDrawKey((key) => key + 1);
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] overflow-y-auto bg-ink-900/70 backdrop-blur-sm"
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col p-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-3xl border border-border-subtle bg-white p-4 shadow-modal md:p-6"
        >
          <motion.div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-500">Ippodrom navigatsiya</p>
              <p className="mt-1 text-lg font-semibold text-ink-900">{product.shop.name}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                <MapPin className="h-4 w-4" />
                {pin.label}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-border-default p-2">
              <X className="h-4 w-4" />
            </button>
          </motion.div>

          <IppodromMarketMap targetShopId={product.shop.id} shops={shops} routeDrawKey={routeDrawKey} />

          <Button
            className="mt-4 w-full border-0 bg-orange-500 text-white hover:bg-orange-600"
            leftIcon={<Navigation2 className="h-4 w-4" />}
            onClick={startIndoorNavigation}
          >
            Bozor ichida yo&apos;nalishni boshlash
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
