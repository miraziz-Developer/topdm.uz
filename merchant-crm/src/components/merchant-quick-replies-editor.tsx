"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getChatQuickReplies, patchMerchantQuickReplies } from "@/lib/api";

type ReplyRow = { id?: string; label: string; text: string; custom?: boolean };

export function MerchantQuickRepliesEditor() {
  const [defaults, setDefaults] = useState<ReplyRow[]>([]);
  const [custom, setCustom] = useState<ReplyRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getChatQuickReplies()
      .then((res) => {
        const items = res.items as ReplyRow[];
        setDefaults(items.filter((i) => !i.custom));
        setCustom(items.filter((i) => i.custom));
      })
      .catch(() => {
        setDefaults([]);
        setCustom([]);
      });
  }, []);

  const addRow = () => {
    if (custom.length >= 12) {
      toast.error("Maksimum 12 ta maxsus javob");
      return;
    }
    setCustom((prev) => [...prev, { label: "", text: "" }]);
  };

  const save = async () => {
    const cleaned = custom.filter((r) => r.label.trim() && r.text.trim().length >= 2);
    setSaving(true);
    try {
      const res = await patchMerchantQuickReplies(
        cleaned.map((r) => ({ id: r.id, label: r.label.trim(), text: r.text.trim() })),
      );
      const items = res.items as ReplyRow[];
      setDefaults(items.filter((i) => !i.custom));
      setCustom(items.filter((i) => i.custom));
      toast.success("Tez javoblar saqlandi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="crm-surface-card p-4 sm:p-5">
      <h3 className="text-sm font-bold text-text-100">Maxsus tez javoblar</h3>
      <p className="mt-1 text-xs text-text-400">
        Standart {defaults.length} ta javob har doim bor. Quyidagilar sizning do&apos;koningizga qo&apos;shiladi.
      </p>

      <div className="mt-4 space-y-3">
        {custom.map((row, idx) => (
          <div key={row.id ?? `new-${idx}`} className="grid gap-2 rounded-xl bg-canvas/60 p-3 ring-1 ring-border-subtle sm:grid-cols-[8rem_1fr_auto]">
            <input
              value={row.label}
              onChange={(e) =>
                setCustom((prev) => prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)))
              }
              placeholder="Tugma"
              maxLength={32}
              className="h-10 rounded-lg border-0 bg-surface px-3 text-sm ring-1 ring-border-subtle"
            />
            <input
              value={row.text}
              onChange={(e) =>
                setCustom((prev) => prev.map((r, i) => (i === idx ? { ...r, text: e.target.value } : r)))
              }
              placeholder="Yuboriladigan matn"
              maxLength={500}
              className="h-10 rounded-lg border-0 bg-surface px-3 text-sm ring-1 ring-border-subtle"
            />
            <button
              type="button"
              onClick={() => setCustom((prev) => prev.filter((_, i) => i !== idx))}
              className="flex h-10 items-center justify-center rounded-lg text-text-400 hover:bg-red/10 hover:text-red"
              aria-label="O'chirish"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Qo&apos;shish
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
      </div>
    </section>
  );
}
