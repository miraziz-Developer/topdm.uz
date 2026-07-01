"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, ChevronDown, Loader2, Mic, Send, Shirt, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StylistProductSuggestions } from "@/components/chat/stylist-product-suggestions";
import { StylistMarkdown } from "@/components/chat/stylist-markdown";
import { WardrobeBundle } from "@/components/chat/wardrobe-bundle";
import { ChatMiniMap } from "@/components/chat/chat-mini-map";
import { StylistProductFeedback } from "@/components/chat/stylist-product-feedback";
import { StylistPhotoPreview, StylistPhotoUpload } from "@/components/stylist/stylist-photo-upload";
import { useFabDockItem, useFabDockPanel } from "@/components/ui/action-fab-dock";
import { useAIChat } from "@/hooks/useAIChat";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { AI_CHAT_OPEN_EVENT, STYLIST_PROMPT_EVENT } from "@/lib/ai-chat-bus";
import { SHOP_CHAT_OPEN_EVENT } from "@/lib/shop-chat-bus";
import { cn } from "@/lib/utils";

const quickActionsFloating = [
  { icon: "👔", label: "Uchrashuv look", query: "uchrashuv uchun ideal klassik kiyim, 500 ming so'mgacha" },
  { icon: "💰", label: "Byudjetga mosla", query: "300 000 so'mgacha arzon shim va ko'ylak top" },
  { icon: "📸", label: "Rasm yuborish", photo: true },
];

const quickActionsStudio = [
  { icon: "🎯", label: "To‘liq look yig‘ish", query: "Ippodromda erkak uchun ofis look: ko'ylak, shim, kamar — 600 ming so'mgacha" },
  { icon: "🧥", label: "Mavsumiy kurtka", query: "Bahoriy yengil kurtka + shim, kulrang yoki ko'k, M o'lcham" },
  { icon: "👟", label: "Oyoq kiyim", query: "Klassik tufli yoki krossovka, 41 o'lcham, qora" },
  { icon: "📸", label: "Rasm yuborish", photo: true },
];

type AIChatProps = {
  variant?: "floating" | "studio";
};

const showAiDebug =
  process.env.NEXT_PUBLIC_SHOW_AI_DEBUG === "true" || process.env.NODE_ENV === "development";

export function AIChat({ variant = "floating" }: AIChatProps) {
  const isStudio = variant === "studio";
  const pathname = usePathname();
  const suppressFloating =
    !isStudio &&
    (pathname.startsWith("/stylist") ||
      pathname.startsWith("/checkout") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/reels"));

  const [open, setOpen] = useState(isStudio);
  const [shopChatOpen, setShopChatOpen] = useState(false);
  const [text, setText] = useState("");
  const [photoOpenSignal, setPhotoOpenSignal] = useState(0);
  const { messages, isLoading, isTyping, sendMessage, clearChat, threadId, userId } = useAIChat();
  const { listening, startListening } = useVoiceSearch((transcript) => {
    void sendMessage(transcript);
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollFingerprint = useMemo(
    () => messages.map((m) => `${m.id}:${m.content.length}:${m.streaming ? 1 : 0}`).join("|"),
    [messages],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    const streaming = messages.some((m) => m.streaming);
    scrollToBottom(streaming ? "auto" : "smooth");
  }, [scrollFingerprint, isTyping, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail?.trim()) void sendMessage(detail.trim());
      setOpen(true);
    };
    const onShopChat = (event: Event) => {
      setShopChatOpen(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(AI_CHAT_OPEN_EVENT, onOpen);
    window.addEventListener(STYLIST_PROMPT_EVENT, onPrompt);
    window.addEventListener(SHOP_CHAT_OPEN_EVENT, onShopChat);
    return () => {
      window.removeEventListener(AI_CHAT_OPEN_EVENT, onOpen);
      window.removeEventListener(STYLIST_PROMPT_EVENT, onPrompt);
      window.removeEventListener(SHOP_CHAT_OPEN_EVENT, onShopChat);
    };
  }, [sendMessage]);

  const quickActions = isStudio ? quickActionsStudio : quickActionsFloating;

  const handleStylistPhoto = useCallback(
    async (payload: { mode: "look_check" | "personal_style" | "find_similar"; dataUrl: string; text: string }) => {
      await sendMessage(payload.text, payload.dataUrl, {
        photoMode: payload.mode,
        imagePreview: payload.dataUrl,
      });
    },
    [sendMessage],
  );

  const handleSend = async () => {
    if (!text.trim() || isLoading) return;
    const msg = text;
    setText("");
    await sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useFabDockItem({
    id: "ai-stylist",
    order: 30,
    label: "AI Stylist",
    shortLabel: "AI",
    icon: <Shirt className="h-5 w-5" />,
    variant: "default",
    pulse: false,
    hidden: suppressFloating || isStudio || open || shopChatOpen,
    onClick: () => setOpen(true),
  });

  useFabDockPanel("ai-stylist", open && !suppressFloating);

  if (suppressFloating) return null;

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {(open || isStudio) && (
          <>
            {!isStudio ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setOpen(false)}
              />
            ) : null}

            <motion.div
              initial={isStudio ? { opacity: 0, y: 12 } : { y: "100%", opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isStudio ? { opacity: 0, y: 12 } : { y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={cn(
                "flex flex-col bg-canvas shadow-modal",
                isStudio
                  ? "relative h-[min(720px,calc(100dvh-var(--app-header-h)-var(--app-bottom-nav-h)-5rem))] w-full min-w-0 overflow-hidden rounded-3xl border border-border-subtle ring-1 ring-black/[0.04] sm:h-[min(720px,78vh)]"
                  : "fixed inset-x-0 bottom-0 z-[70] flex h-[min(88dvh,100dvh-4rem)] max-h-[100dvh] flex-col rounded-t-3xl border-t border-border-strong sm:inset-x-2 md:inset-auto md:bottom-8 md:right-[max(1rem,env(safe-area-inset-right))] md:h-[min(600px,calc(100dvh-4rem))] md:w-[min(420px,calc(100vw-2rem))] md:rounded-2xl md:border",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-gold">
                    <Bot className="h-5 w-5 text-canvas" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-100">
                      {isStudio ? "Shaxsiy AI Stilist" : "Bozorliii.uz"}
                    </h3>
                    <p className="text-xs text-electric-400">
                      {isTyping
                        ? "O‘ylayapman…"
                        : messages.some((m) => m.streaming)
                          ? "Javob yozilmoqda…"
                          : isStudio
                            ? "Pro stylist • Ippodrom katalogi"
                            : "Onlayn • shaxsiy stylist"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button onClick={clearChat} className="rounded-lg p-2 text-text-400 transition-colors hover:bg-surface hover:text-text-100">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {!isStudio ? (
                    <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-text-400 transition-colors hover:bg-surface hover:text-text-100">
                      <ChevronDown className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 scrollbar-thin max-h-[calc(100vh-140px)] md:max-h-none"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-electric-500/10">
                      <Shirt className="h-8 w-8 text-electric-500" />
                    </div>
                    <h4 className="mb-2 text-lg font-semibold text-text-100">
                      {isStudio ? "Salom! Men sizning shaxsiy stylingizman" : "Salom! Men sizning stylistingizman"}
                    </h4>
                    <p className="mb-6 max-w-[320px] text-sm text-text-400">
                      {isStudio
                        ? "Rasm yuboring: look bahosi, shaxsiy tavsiya yoki katalogdan o‘xshashini topish. Matn, byudjet va vaziyatni ham yozing."
                        : "Qayerga kiyinasiz, qancha byudjet — ayting. Rasm yuborsangiz look baho yoki mos tavsiya beraman."}
                    </p>
                    <div
                      className={cn(
                        "flex w-full max-w-[320px] flex-col gap-2",
                        isStudio && "max-w-none sm:grid sm:grid-cols-2",
                      )}
                    >
                      {quickActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => {
                            if ("photo" in action && action.photo) {
                              setPhotoOpenSignal((n) => n + 1);
                              return;
                            }
                            if ("query" in action && action.query) {
                              void sendMessage(action.query);
                            }
                          }}
                          className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-left text-sm text-text-200 transition-all hover:border-gold-500/30 hover:bg-elevated"
                        >
                          <span className="text-lg">{action.icon}</span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex w-full min-w-0 flex-col space-y-1",
                          msg.role === "user" ? "items-end" : "items-start",
                        )}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-gold">
                            <Bot className="h-4 w-4 text-canvas" />
                          </div>
                        )}

                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed tracking-wide shadow-xs",
                            msg.role === "user"
                              ? "rounded-tr-sm border border-gold-500/30 bg-gold-500/15 text-text-100"
                              : "rounded-tl-sm border border-border-subtle bg-surface text-text-200",
                          )}
                        >
                          {msg.role === "assistant" ? (
                            <>
                              <StylistMarkdown content={msg.content || (msg.streaming ? "…" : "")} />
                              {showAiDebug && msg.engine && !msg.streaming ? (
                                <p className="mt-2 text-[10px] uppercase tracking-wider text-text-400/80">
                                  AI · {msg.engine}
                                </p>
                              ) : null}
                              {msg.streaming ? (
                                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gold-500 align-middle" />
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="whitespace-pre-wrap break-anywhere">{msg.content}</span>
                              {msg.imagePreview ? (
                                <StylistPhotoPreview src={msg.imagePreview} />
                              ) : null}
                            </>
                          )}
                        </div>

                        {msg.role === "assistant" && !msg.streaming && msg.wardrobeSlots?.length ? (
                          <div className="w-full min-w-0">
                            <WardrobeBundle
                              slots={msg.wardrobeSlots}
                              budgetTotal={msg.wardrobeBudgetTotal}
                              searchHref={msg.searchDeeplink?.path}
                              onNavigate={() => setOpen(false)}
                            />
                          </div>
                        ) : null}

                        {msg.role === "assistant" &&
                        !msg.streaming &&
                        !msg.wardrobeSlots?.length &&
                        msg.products &&
                        msg.products.length > 0 ? (
                          <>
                            <StylistProductSuggestions items={msg.products} onNavigate={() => setOpen(false)} />
                            <div className="mt-2 flex flex-wrap gap-3">
                              {msg.products.map(({ product }) => (
                                <StylistProductFeedback
                                  key={product.id}
                                  productId={product.id}
                                  userId={userId}
                                  threadId={threadId}
                                  compact
                                />
                              ))}
                            </div>
                          </>
                        ) : null}

                        {msg.role === "assistant" && !msg.streaming && msg.miniMap ? (
                          <div className="w-full min-w-0">
                            <ChatMiniMap
                              marketSlug={msg.miniMap.market_slug}
                              level={msg.miniMap.level}
                              startNodeId={msg.miniMap.start_node_id}
                              goalNodeId={msg.miniMap.goal_node_id}
                            />
                          </div>
                        ) : null}

                        {msg.role === "assistant" && !msg.streaming && msg.suggestions?.length ? (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex w-full flex-wrap gap-2"
                          >
                            {msg.suggestions.map((s) => (
                              <button
                                key={`${msg.id}-${s}`}
                                type="button"
                                disabled={isLoading}
                                onClick={() => void sendMessage(s)}
                                className="rounded-full border border-border-subtle bg-elevated px-3 py-1.5 text-xs text-text-300 transition-colors hover:border-gold-500/40 hover:text-text-100 disabled:opacity-50"
                              >
                                {s}
                              </button>
                            ))}
                          </motion.div>
                        ) : null}
                      </motion.div>
                    ))}

                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-start space-y-1"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-gold">
                          <Bot className="h-4 w-4 text-canvas" />
                        </div>
                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border-subtle bg-surface p-3.5 shadow-xs">
                          <div className="flex gap-1.5">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-text-400" style={{ animationDelay: "0ms" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-text-400" style={{ animationDelay: "150ms" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-text-400" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} aria-hidden />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border-subtle p-4">
                <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface p-1.5 transition-colors focus-within:border-gold-500/50">
                  <StylistPhotoUpload
                    disabled={isLoading}
                    openSignal={photoOpenSignal}
                    onSend={handleStylistPhoto}
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nima qidiryapsiz..."
                    className="flex-1 bg-transparent text-sm text-text-100 placeholder:text-text-400 focus:outline-none"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={startListening}
                    disabled={isLoading}
                    aria-label="Ovozli xabar"
                    className={cn(
                      "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                      listening ? "bg-electric-500/15 text-electric-500" : "text-text-400 hover:bg-elevated hover:text-text-100",
                    )}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || isLoading}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-gold text-canvas transition-all hover:scale-105 disabled:opacity-40"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
