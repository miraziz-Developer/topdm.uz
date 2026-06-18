"use client";

import { History, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getCustomerHistory } from "@/lib/api";

export function CustomerPhoneInsight({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCustomerHistory>> | null>(null);

  const load = async () => {
    if (!phone || phone.length < 9) return;
    setLoading(true);
    try {
      const res = await getCustomerHistory(phone);
      setData(res);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
        <History className="mr-1 h-3.5 w-3.5" />
        Tarix
      </Button>
      {open && data ? (
        <div className="mt-2 rounded-xl border border-border-subtle bg-canvas p-3 text-sm">
          {data.is_returning_customer ? (
            <p className="mb-2 flex items-center gap-1 font-medium text-gold-700">
              <UserRound className="h-4 w-4" />
              Qaytgan mijoz
            </p>
          ) : (
            <p className="mb-2 text-text-400">Yangi mijoz</p>
          )}
          <p className="text-text-400">
            {data.total_orders} buyurtma · {data.total_leads} murojaat
          </p>
        </div>
      ) : null}
    </div>
  );
}
