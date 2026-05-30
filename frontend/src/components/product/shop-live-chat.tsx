"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { ChatProductPreviewCard, parseChatProducts } from "@/components/chat/chat-product-preview";
import { useShopChat } from "@/hooks/useShopChat";
import { FAB_SHOP_CHAT } from "@/lib/fab-positions";
import { cn } from "@/lib/utils";

type ShopLiveChatProps = {
  shopId: string;
  shopName: string;
};

export function ShopLiveChat({ shopId, shopName }: ShopLiveChatProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, connected, reconnecting, error, connect, send, disconnect } = useShopChat(
    shopId,
    shopName,
  );

  useEffect(() => {
    if (open) void connect();
    else disconnect();
  }, [open, connect, disconnect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    send(text);
    setText("");
  };

  return (
    <>
      {!open ? (
        <button
          type="button"
          className={cn(
            FAB_SHOP_CHAT,
            "flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-ink-900 px-3 py-2.5 text-xs font-semibold text-white shadow-lg transition active:scale-[0.97] sm:px-4 sm:py-3 sm:text-sm",
          )}
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-5 w-5" />
          Do&apos;kon bilan chat
        </button>
      ) : null}

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 right-0 z-50 flex h-[min(520px,85vh)] w-full max-w-md flex-col rounded-t-3xl border border-border-subtle bg-white shadow-2xl md:bottom-6 md:right-6 md:rounded-3xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{shopName}</p>
                  <div className="mt-1">
                    <ConnectionStatus connected={connected} reconnecting={reconnecting} />
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Yopish">
                  <X className="h-5 w-5 text-ink-500" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.map((m) => {
                  const products = parseChatProducts(m.metadata);
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                        m.sender_role === "customer"
                          ? "ml-auto bg-gold-500/20 text-ink-900"
                          : "mr-auto bg-surface text-ink-800",
                      )}
                    >
                      {m.body ? <p>{m.body}</p> : null}
                      {products.map((product) => (
                        <ChatProductPreviewCard key={product.product_id} product={product} />
                      ))}
                    </motion.div>
                  );
                })}
                {error ? <p className="text-center text-xs text-red-600">{error}</p> : null}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-border-subtle p-3">
                <div className="flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Xabar yozing..."
                    className="flex-1 rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none focus:border-gold-500/50"
                  />
                  <Button type="button" onClick={handleSend} disabled={!connected}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
