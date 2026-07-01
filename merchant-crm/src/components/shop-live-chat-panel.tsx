"use client";

import {
  MessageCircle,
  MessagesSquare,
  Send,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChatQuickReplies } from "@/components/chat-quick-replies";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { Input } from "@/components/ui/input";
import { useMerchantShopChat } from "@/hooks/useMerchantShopChat";
import { cn } from "@/lib/utils";

function formatChatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function threadLabel(thread: { customer_display_name?: string | null; customer_key: string }) {
  return thread.customer_display_name?.trim() || thread.customer_key || "Mijoz";
}

function threadInitial(name: string) {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

export function ShopLiveChatPanel() {
  const {
    threads,
    totalUnread,
    activeThreadId,
    messages,
    connectionState,
    loading,
    error,
    selectThread,
    send,
    reconnect,
  } = useMerchantShopChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const canSend = connectionState === "online" && Boolean(activeThreadId);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activeThreadId]);

  const submit = () => {
    if (!draft.trim() || !canSend) return;
    send(draft);
    setDraft("");
  };

  if (loading) {
    return <div className="skeleton min-h-[420px] rounded-3xl" />;
  }

  return (
    <div className="space-y-4">
      <div className="crm-surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-100">
            {threads.length ? `${threads.length} ta suhbat` : "Hali mijoz xabari yo'q"}
            {totalUnread > 0 ? (
              <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-electric-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm text-text-400">
            Yangi xabarlar avtomatik keladi — yangilash shart emas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionStatus state={connectionState} />
        </div>
      </div>

      <div className="crm-surface-card overflow-hidden">
        <div className="grid min-h-[min(72vh,560px)] lg:grid-cols-[minmax(240px,280px)_1fr]">
          <aside className="flex flex-col border-b border-border-subtle lg:border-b-0 lg:border-r">
            <div className="border-b border-border-subtle bg-canvas/50 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Mijozlar</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!threads.length ? (
                <div className="px-4 py-12 text-center">
                  <MessagesSquare className="mx-auto h-9 w-9 text-text-400/45" />
                  <p className="mt-3 text-sm font-medium text-text-100">Suhbat yo&apos;q</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-400">
                    Mijoz saytdan yozganda ro&apos;yxat shu yerda paydo bo&apos;ladi
                  </p>
                </div>
              ) : (
                threads.map((thread) => {
                  const active = activeThreadId === thread.id;
                  const name = threadLabel(thread);
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => void selectThread(thread.id)}
                      className={cn(
                        "flex w-full gap-3 border-b border-border-subtle/70 px-4 py-3.5 text-left transition last:border-b-0",
                        active ? "bg-electric-500/[0.06]" : "hover:bg-canvas/80",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                          active ? "bg-electric-500 text-white" : "bg-canvas text-text-400",
                        )}
                      >
                        {threadInitial(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-text-100">{name}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {(thread.unread_count ?? 0) > 0 ? (
                              <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-electric-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {(thread.unread_count ?? 0) > 99 ? "99+" : thread.unread_count}
                              </span>
                            ) : null}
                            {thread.updated_at ? (
                              <span className="text-[10px] tabular-nums text-text-400">
                                {formatChatTime(thread.updated_at)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text-400">
                          {thread.last_message || "Yangi suhbat"}
                        </p>
                      </div>
                      {active ? (
                        <span className="mt-2 h-8 w-1 shrink-0 rounded-full bg-electric-500" aria-hidden />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-[320px] flex-col bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/12 text-gold-600">
                  {activeThread ? <UserRound className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-100">
                    {activeThread ? threadLabel(activeThread) : "Suhbatni tanlang"}
                  </p>
                  <p className="text-xs text-text-400">
                    {activeThread ? "Jonli muloqot" : "Chapdan mijozni tanlang"}
                  </p>
                </div>
              </div>
              <ConnectionStatus state={connectionState} className="hidden sm:inline-flex" />
            </header>

            {error ? (
              <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red/20 bg-red/5 px-3 py-2 text-sm text-red sm:mx-5">
                <span>{error}</span>
                {connectionState === "offline" && activeThreadId ? (
                  <Button type="button" size="sm" variant="secondary" onClick={reconnect}>
                    Qayta ulanish
                  </Button>
                ) : null}
              </div>
            ) : null}

            {connectionState === "offline" && activeThreadId && !error ? (
              <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm text-amber-900 sm:mx-5">
                <span>Ulanish uzildi — xabar yuborish vaqtincha ishlamaydi</span>
                <Button type="button" size="sm" variant="secondary" onClick={reconnect}>
                  Ulanish
                </Button>
              </div>
            ) : null}

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              {!activeThreadId ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                  <MessageCircle className="h-10 w-10 text-text-400/40" />
                  <p className="mt-3 font-medium text-text-100">Xabarlar shu yerda</p>
                  <p className="mt-1 max-w-xs text-sm text-text-400">
                    Mijozlar ro&apos;yxatidan birini tanlang yoki yangi xabar kuting
                  </p>
                </div>
              ) : !messages.length ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-text-100">Hali xabar yo&apos;q</p>
                  <p className="mt-1 text-sm text-text-400">Birinchi javobni siz yozishingiz mumkin</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const mine = msg.sender_role === "merchant";
                  const system = msg.sender_role === "system";
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start", system && "items-center")}
                    >
                      <div
                        className={cn(
                          "max-w-[min(100%,22rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                          system && "bg-canvas text-xs text-text-400",
                          !system && mine && "bg-electric-500 text-white",
                          !system && !mine && "bg-canvas text-text-100 ring-1 ring-border-subtle",
                        )}
                      >
                        {msg.body}
                      </div>
                      {!system ? (
                        <span className="px-1 text-[10px] tabular-nums text-text-400">
                          {formatChatTime(msg.created_at)}
                        </span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <ChatQuickReplies disabled={!canSend} onPick={(text) => setDraft(text)} />

            <div className="border-t border-border-subtle bg-canvas/30 p-3 sm:p-4">
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    canSend ? "Javob yozing…" : activeThreadId ? "Ulanishni kuting…" : "Avval mijozni tanlang"
                  }
                  disabled={!canSend}
                  className="bg-surface"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <Button type="button" onClick={submit} disabled={!canSend || !draft.trim()} className="shrink-0 px-4">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Yuborish</span>
                </Button>
              </div>
              <p className="mt-2 hidden text-[11px] text-text-400 sm:block">
                Enter — yuborish · Tez javoblar tugmalaridan foydalaning
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
