"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, LifeBuoy, MessageCircle, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createMerchantSupportTicket,
  getMerchantSupportAiConfig,
  listMerchantSupportTickets,
  sendMerchantSupportAiChat,
  type MerchantSupportTicket,
  type SupportAiChatMessage,
  type SupportAiConfig,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "problem", label: "Muammo", hint: "Ishlamayapti, xato chiqyapti" },
  { id: "suggestion", label: "Taklif", hint: "Yaxshilash g'oyasi" },
  { id: "question", label: "Savol", hint: "Qanday qilish kerak?" },
] as const;

type TabId = "ai" | "tickets";

const CHAT_INPUT_CLASS =
  "min-h-[88px] w-full resize-y rounded-2xl border-2 border-slate-300 bg-white px-4 py-3.5 text-[15px] leading-relaxed text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70";

function formatWhen(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("uz-UZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ChatBubble({
  role,
  content,
  escalated,
}: {
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-md ring-2 ring-primary/20">
          <Bot className="h-[18px] w-[18px]" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[min(88%,34rem)] rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed shadow-md",
          isUser
            ? "rounded-br-md bg-gradient-to-br from-primary to-violet-600 text-white"
            : escalated
              ? "rounded-bl-md border-2 border-amber-300 bg-amber-50 text-amber-950"
              : "rounded-bl-md border border-white/80 bg-white text-slate-800",
        )}
      >
        {!isUser ? (
          <p
            className={cn(
              "mb-1.5 text-[11px] font-bold uppercase tracking-wider",
              escalated ? "text-amber-800" : "text-primary",
            )}
          >
            AI yordamchi
          </p>
        ) : null}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
      {isUser ? (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white shadow-md">
          <User className="h-[18px] w-[18px]" />
        </div>
      ) : null}
    </div>
  );
}

function SupportTabs({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="flex gap-2 rounded-2xl border-2 border-slate-200 bg-slate-100/90 p-1.5 shadow-inner">
      <button
        type="button"
        onClick={() => onChange("ai")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
          tab === "ai"
            ? "bg-white text-primary shadow-md ring-1 ring-slate-200"
            : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
        )}
      >
        <MessageCircle className="h-4 w-4" />
        AI yordam
      </button>
      <button
        type="button"
        onClick={() => onChange("tickets")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
          tab === "tickets"
            ? "bg-white text-primary shadow-md ring-1 ring-slate-200"
            : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
        )}
      >
        <LifeBuoy className="h-4 w-4" />
        Murojaatlar
      </button>
    </div>
  );
}

export function MerchantSupportPanel() {
  const [tab, setTab] = useState<TabId>("ai");
  const [aiConfig, setAiConfig] = useState<SupportAiConfig | null>(null);
  const [chat, setChat] = useState<SupportAiChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [lastEscalated, setLastEscalated] = useState(false);

  const [tickets, setTickets] = useState<MerchantSupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("problem");
  const [ticketMessage, setTicketMessage] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getMerchantSupportAiConfig()
      .then((cfg) => {
        setAiConfig(cfg);
        setChat([{ role: "assistant", content: cfg.greeting }]);
      })
      .catch(() => {
        setChat([
          {
            role: "assistant",
            content: "Salom! Savolingizni yozing — yordam berishga harakat qilaman.",
          },
        ]);
      });
  }, []);

  const refreshTickets = async () => {
    try {
      const res = await listMerchantSupportTickets();
      setTickets(res.items);
    } catch {
      toast.error("Murojaatlar yuklanmadi");
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    void refreshTickets();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, chatLoading]);

  useEffect(() => {
    if (tab === "tickets") {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [tickets.length, tab]);

  const handleAiSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: SupportAiChatMessage = { role: "user", content: text };
    const history = chat.filter((m) => m.role === "user" || m.role === "assistant");
    setChat((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    setLastEscalated(false);
    try {
      const res = await sendMerchantSupportAiChat({
        message: text,
        history: history.slice(-20),
      });
      setChat((prev) => [...prev, { role: "assistant", content: res.reply }]);
      setLastEscalated(res.escalated);
      if (res.escalated && !aiConfig?.admin_telegram) {
        setAiConfig((c) =>
          c
            ? {
                ...c,
                admin_telegram: res.admin_telegram,
                admin_telegram_url: res.admin_telegram_url,
              }
            : c,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI javob bermadi");
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Xatolik yuz berdi. Pastdagi tugma orqali admin bilan bog'laning.",
        },
      ]);
      setLastEscalated(true);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTicketSend = async () => {
    const text = ticketMessage.trim();
    if (text.length < 5) {
      toast.error("Xabar juda qisqa");
      return;
    }
    setSending(true);
    try {
      const res = await createMerchantSupportTicket({ category, message: text });
      setTickets((prev) => [res.item, ...prev]);
      setTicketMessage("");
      toast.success(res.message ?? "Yuborildi");
      setTab("tickets");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  };

  const adminHandle = aiConfig?.admin_telegram;
  const adminUrl = aiConfig?.admin_telegram_url;

  return (
    <div className="space-y-5">
      <div className="support-info-banner">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Tez yordam</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Avval <strong className="font-semibold text-slate-900">AI yordamchi</strong>dan so&apos;rang — ko&apos;p
              savollarga darhol javob beradi. Hal bo&apos;lmasa admin yoki murojaat qoldiring.
            </p>
          </div>
        </div>
      </div>

      <SupportTabs tab={tab} onChange={setTab} />

      {tab === "ai" ? (
        <>
          <section className="support-chat-shell overflow-hidden">
            <div className="support-chat-header">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">AI yordamchi</h2>
                  <p className="text-sm text-white/75">24/7 — mahsulot, banner, buyurtma, balans</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-300/30">
                Onlayn
              </span>
            </div>

            <div className="support-chat-thread">
              {chat.map((m, i) => (
                <ChatBubble
                  key={`${m.role}-${i}`}
                  role={m.role}
                  content={m.content}
                  escalated={m.role === "assistant" && lastEscalated && i === chat.length - 1}
                />
              ))}
              {chatLoading ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/90 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                  </span>
                  Javob yozilmoqda…
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>

            {(lastEscalated || adminHandle) && adminUrl ? (
              <div className="border-t border-amber-200/80 bg-amber-50 px-4 py-4 sm:px-5">
                <p className="text-sm font-bold text-amber-950">Admin bilan bog&apos;lanish</p>
                <p className="mt-1 text-sm text-amber-900/80">
                  AI bu savolni to&apos;liq hal qila olmadi — platforma adminiga yozing.
                </p>
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#1a8bc4]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Telegram: {adminHandle}
                </a>
              </div>
            ) : null}

            <div className="support-chat-composer">
              <label htmlFor="support-ai-input" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Xabaringiz
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <textarea
                  id="support-ai-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAiSend();
                    }
                  }}
                  placeholder="Savolingizni shu yerga yozing… Enter — yuborish, Shift+Enter — yangi qator"
                  rows={3}
                  maxLength={2000}
                  disabled={chatLoading}
                  className={CHAT_INPUT_CLASS}
                />
                <Button
                  onClick={() => void handleAiSend()}
                  isLoading={chatLoading}
                  disabled={!chatInput.trim() || chatLoading}
                  className="h-12 shrink-0 rounded-2xl px-6 text-base font-bold shadow-lg shadow-primary/25"
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Yuborish
                </Button>
              </div>
            </div>
          </section>

          <section className="support-ticket-card">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
              <p className="text-base font-bold text-slate-900">Yoki murojaat qoldiring</p>
              <p className="mt-1 text-sm text-slate-600">Jamoamiz admin panelda ko&apos;radi va javob beradi</p>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <textarea
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Muammo yoki taklifingizni batafsil yozing…"
                rows={3}
                maxLength={4000}
                className={CHAT_INPUT_CLASS}
              />
              <Button
                onClick={() => void handleTicketSend()}
                isLoading={sending}
                disabled={ticketMessage.trim().length < 5}
                variant="secondary"
                className="h-11 w-full rounded-2xl border-2 border-slate-300 bg-white text-base font-bold text-slate-800 shadow-sm hover:bg-slate-50 sm:w-auto"
              >
                Murojaat yuborish
              </Button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="support-chat-shell overflow-hidden">
            <div className="support-chat-header support-chat-header--muted">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary shadow-md">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Murojaatlar tarixi</h2>
                  <p className="text-sm text-white/75">Oldingi xabarlaringiz va jamoa javoblari</p>
                </div>
              </div>
            </div>

            <div className="support-chat-thread min-h-[280px]">
              {ticketsLoading ? (
                <div className="skeleton h-28 rounded-2xl" />
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center">
                  <LifeBuoy className="mb-3 h-10 w-10 text-slate-400" />
                  <p className="text-base font-semibold text-slate-700">Hali murojaat yo&apos;q</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    AI yordamchidan so&apos;rang yoki pastda yangi murojaat qoldiring.
                  </p>
                </div>
              ) : (
                [...tickets].reverse().map((t) => (
                  <div key={t.id} className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-[min(92%,34rem)] rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-violet-600 px-4 py-3.5 text-[15px] text-white shadow-md">
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
                          {t.category_label} · {t.status_label}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{t.message}</p>
                        <p className="mt-2 text-xs text-white/70">{formatWhen(t.created_at)}</p>
                      </div>
                    </div>
                    {t.admin_note ? (
                      <div className="flex justify-start">
                        <div className="max-w-[min(92%,34rem)] rounded-2xl rounded-bl-md border border-white/80 bg-white px-4 py-3.5 text-[15px] text-slate-800 shadow-md">
                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                            Bozorliii jamoasi
                          </p>
                          <p className="whitespace-pre-wrap leading-relaxed">{t.admin_note}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>
          </section>

          <section className="support-ticket-card">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
              <p className="text-base font-bold text-slate-900">Yangi murojaat</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Turini tanlang</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    title={c.hint}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-bold transition",
                      category === c.id
                        ? "bg-primary text-white shadow-md shadow-primary/25"
                        : "border-2 border-slate-300 bg-white text-slate-700 hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <textarea
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Muammo, taklif yoki savolingizni batafsil yozing…"
                rows={4}
                maxLength={4000}
                className={CHAT_INPUT_CLASS}
              />
              <Button
                onClick={() => void handleTicketSend()}
                isLoading={sending}
                disabled={ticketMessage.trim().length < 5}
                className="h-12 w-full rounded-2xl px-6 text-base font-bold shadow-lg shadow-primary/25 sm:w-auto"
                leftIcon={<Send className="h-4 w-4" />}
              >
                Yuborish
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
