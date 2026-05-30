"use client";

import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { getChatQuickReplies } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChatQuickReplies({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  const [items, setItems] = useState<Array<{ id: string; label: string; text: string }>>([]);

  useEffect(() => {
    getChatQuickReplies()
      .then((res) => setItems(res.items))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <div className="border-t border-border-subtle bg-canvas/40 px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-400">
        <Zap className="h-3 w-3 text-gold-500" />
        Tez javoblar
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item.text)}
            className={cn(
              "rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-text-100 shadow-sm transition",
              "hover:border-electric-500/30 hover:bg-electric-500/[0.06]",
              "disabled:cursor-not-allowed disabled:opacity-45",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
