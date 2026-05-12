"use client";

import { useState } from "react";

import { useStylistChat } from "@/hooks/useStylistChat";

export function AIChatBubble() {
  const [text, setText] = useState("to'yga kiyim kerak");
  const [open, setOpen] = useState(false);
  const { loading, result, askStylist } = useStylistChat();

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
          <div className="text-sm text-zinc-300">AI Stylist</div>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={() => askStylist(text)}
            className="mt-2 w-full rounded-lg bg-white p-2 text-sm text-zinc-900"
            disabled={loading}
          >
            {loading ? "Yuklanmoqda..." : "So'rash"}
          </button>
          {result?.lookbook?.length ? (
            <div className="mt-3 space-y-2">
              {result.lookbook.slice(0, 2).map((item) => (
                <div key={item.product_id} className="rounded-lg bg-zinc-800 p-2 text-xs">
                  Mahsulot: {item.product_id}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-12 w-12 rounded-full bg-white text-zinc-900 shadow-lg"
      >
        AI
      </button>
    </div>
  );
}
