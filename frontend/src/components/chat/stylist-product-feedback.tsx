"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { chatAgentFeedback } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  productId: string;
  userId: string;
  threadId: string;
  compact?: boolean;
};

export function StylistProductFeedback({ productId, userId, threadId, compact }: Props) {
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (next: "like" | "dislike") => {
    if (busy) return;
    setBusy(true);
    try {
      await chatAgentFeedback({
        user_id: userId,
        thread_id: threadId,
        product_id: productId,
        vote: next,
      });
      setVote(next);
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        compact ? "mt-1" : "mt-2",
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void send("like")}
        className={cn(
          "rounded-lg p-1.5 transition",
          vote === "like" ? "bg-emerald-500/20 text-emerald-700" : "text-ink-500 hover:bg-surface",
        )}
        aria-label="Yoqdi"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void send("dislike")}
        className={cn(
          "rounded-lg p-1.5 transition",
          vote === "dislike" ? "bg-red-500/15 text-red-700" : "text-ink-500 hover:bg-surface",
        )}
        aria-label="Yoqmadi"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
