"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Camera, ChevronDown, Loader2, Send, Sparkles, X, Wallet, Search as SearchIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useAIChat } from "@/hooks/useAIChat";

const quickActions = [
  { icon: "👔", label: "Look taklif qil", query: "Maktab kechasi uchun premium look taklif qil" },
  { icon: "💰", label: "Byudjetga mosla", query: "100 000 so'mgacha arzon variant top" },
  { icon: "📸", label: "Rasm orqali qidir", query: "" },
];

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { messages, isLoading, sendMessage, clearChat } = useAIChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  return (
    <>
      {/* Floating trigger */}
      <AnimatePresence>
        {!open && (
          <motion.button
            id="ai-trigger"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-3.5 font-semibold text-canvas shadow-gold transition-transform hover:scale-105 md:bottom-8 animate-float"
            onClick={() => setOpen(true)}
          >
            <Bot className="h-5 w-5" />
            <span className="hidden sm:inline">AI bilan toping</span>
            <span className="inline sm:hidden">AI</span>
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-gold-500" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />
            
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[70] flex h-[85vh] flex-col rounded-t-3xl border-t border-border-strong bg-canvas shadow-modal md:inset-auto md:bottom-8 md:right-8 md:h-[600px] md:w-[420px] md:rounded-2xl md:border"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-gold">
                    <Bot className="h-5 w-5 text-canvas" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-100">Bozor AI</h3>
                    <p className="text-xs text-text-400">Onlayn • Har doim tayyor</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button onClick={clearChat} className="rounded-lg p-2 text-text-400 transition-colors hover:bg-surface hover:text-text-100">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-text-400 transition-colors hover:bg-surface hover:text-text-100">
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/10">
                      <Sparkles className="h-8 w-8 text-gold-500" />
                    </div>
                    <h4 className="mb-2 text-lg font-semibold text-text-100">Salom! Men Bozor AI</h4>
                    <p className="mb-6 max-w-[280px] text-sm text-text-400">
                      Nima qidiryapsiz? Rasmni yuboring yoki yozing — eng mos tovarlarni topaman!
                    </p>
                    <div className="flex flex-col gap-2 w-full max-w-[280px]">
                      {quickActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => {
                            if (action.query) {
                              setText(action.query);
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
                  <div className="space-y-4">
                    {messages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {m.role === "assistant" && (
                          <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-gold">
                            <Bot className="h-4 w-4 text-canvas" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            m.role === "user"
                              ? "rounded-tr-sm border border-gold-500/30 bg-gold-500/15 text-text-100"
                              : "rounded-tl-sm bg-surface text-text-200"
                          }`}
                        >
                          {m.content}
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start"
                      >
                        <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-gold">
                          <Bot className="h-4 w-4 text-canvas" />
                        </div>
                        <div className="rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
                          <div className="flex gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-text-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-2 w-2 rounded-full bg-text-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-2 w-2 rounded-full bg-text-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border-subtle p-4">
                <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface p-1.5 transition-colors focus-within:border-gold-500/50">
                  <button className="flex-shrink-0 rounded-lg p-2 text-text-400 transition-colors hover:bg-elevated hover:text-text-100">
                    <Camera className="h-5 w-5" />
                  </button>
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
