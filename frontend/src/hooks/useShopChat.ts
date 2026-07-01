"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import {
  createChatThread,
  getChatMessages,
  markChatThreadRead,
  sendChatMessage,
  type ChatMessageItem,
  type ChatThreadItem,
} from "@/lib/api";
import { getChatCustomerKey } from "@/lib/utils";

const MAX_RECONNECT_DELAY_MS = 12_000;

import { publicBackendOrigin } from "@/lib/backend-origin";

function wsBaseUrl(): string {
  const origin = publicBackendOrigin();
  const url = new URL(origin);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}

function normalizeChatMessage(raw: Record<string, unknown>, fallbackThreadId: string): ChatMessageItem | null {
  const nested =
    raw.message && typeof raw.message === "object" && !Array.isArray(raw.message)
      ? (raw.message as Record<string, unknown>)
      : raw;
  const body = String(nested.body ?? "").trim();
  const senderRole = nested.sender_role;
  if (!body || (senderRole !== "customer" && senderRole !== "merchant" && senderRole !== "system")) {
    return null;
  }
  return {
    id: String(nested.id ?? crypto.randomUUID()),
    thread_id: String(nested.thread_id ?? fallbackThreadId),
    sender_role: senderRole,
    body,
    created_at: String(nested.created_at ?? new Date().toISOString()),
    metadata: (nested.metadata as Record<string, unknown>) ?? {},
  };
}

function upsertChatMessage(prev: ChatMessageItem[], incoming: ChatMessageItem): ChatMessageItem[] {
  if (prev.some((m) => m.id === incoming.id)) return prev;

  const pendingIdx = prev.findIndex(
    (m) =>
      m.id.startsWith("pending-") &&
      m.sender_role === incoming.sender_role &&
      m.body === incoming.body,
  );
  if (pendingIdx >= 0) {
    const next = [...prev];
    next[pendingIdx] = incoming;
    return next;
  }

  return [...prev, incoming];
}

export function useShopChat(shopId: string | undefined, shopName?: string) {
  const { push } = useToast();
  const [thread, setThread] = useState<ChatThreadItem | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const threadRef = useRef<ChatThreadItem | null>(null);
  const reconnectToastShownRef = useRef(false);
  const chatOpenRef = useRef(false);

  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const markRead = useCallback(async (threadId: string) => {
    try {
      await markChatThreadRead(threadId);
    } catch {
      /* ignore */
    }
    setUnreadCount(0);
  }, []);

  const openSocket = useCallback(
    (activeThread: ChatThreadItem) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      const customerKey = getChatCustomerKey();
      const ws = new WebSocket(
        `${wsBaseUrl()}/ws/chat/${activeThread.id}?role=customer&session_id=${encodeURIComponent(customerKey)}`,
      );
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        reconnectToastShownRef.current = false;
        setConnected(true);
        setReconnecting(false);
        setError(null);
      };

      ws.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (intentionalCloseRef.current || !threadRef.current) {
          setReconnecting(false);
          return;
        }
        setReconnecting(true);
        if (!reconnectToastShownRef.current) {
          reconnectToastShownRef.current = true;
          push("Chat ulanishi uzildi — qayta ulanmoqda…", "info");
        }
        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current = attempt + 1;
        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 800 * 2 ** attempt);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (threadRef.current) openSocket(threadRef.current);
        }, delay);
      };

      ws.onerror = () => setError("Chat ulanishi uzildi — qayta ulanmoqda…");

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;

          if (payload.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (payload.type === "pong" || payload.type === "system") {
            if (payload.code === "reconnect_hint") {
              push(String(payload.message || "Ulanish tiklanmoqda…"), "info");
            }
            return;
          }
          if (payload.type === "error") {
            setError(String(payload.message || "Xatolik"));
            return;
          }

          const parsed = normalizeChatMessage(payload, activeThread.id);
          if (!parsed) return;

          setMessages((prev) => upsertChatMessage(prev, parsed));
          if (parsed.sender_role === "merchant") {
            if (chatOpenRef.current) {
              void markRead(activeThread.id);
            } else {
              setUnreadCount((n) => n + 1);
            }
          }
        } catch {
          /* ignore non-json */
        }
      };
    },
    [clearReconnectTimer, markRead, push],
  );

  const ensureThread = useCallback(async () => {
    if (!shopId) return null;
    intentionalCloseRef.current = false;
    setError(null);
    const customerKey = getChatCustomerKey();
    let activeThread = threadRef.current;
    if (!activeThread) {
      const res = await createChatThread({
        shop_id: shopId,
        customer_key: customerKey,
        customer_display_name: shopName ? `Mijoz · ${shopName}` : "Mijoz",
      });
      activeThread = res.thread;
      setThread(activeThread);
      threadRef.current = activeThread;
      const history = await getChatMessages(activeThread.id);
      setMessages(history.items);
      setUnreadCount(history.unread_count ?? 0);
    }
    return activeThread;
  }, [shopId, shopName]);

  const connect = useCallback(async () => {
    try {
      const activeThread = await ensureThread();
      if (activeThread) openSocket(activeThread);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat ochib bo'lmadi";
      setError(message);
      push(message, "error");
    }
  }, [ensureThread, openSocket, push]);

  const setPanelOpen = useCallback(
    async (open: boolean) => {
      setChatOpen(open);
      chatOpenRef.current = open;
      if (open) {
        try {
          const activeThread = await ensureThread();
          if (activeThread) {
            await markRead(activeThread.id);
            openSocket(activeThread);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Chat ochib bo'lmadi";
          setError(message);
        }
      }
    },
    [ensureThread, markRead, openSocket],
  );

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      try {
        const activeThread = await ensureThread();
        if (!cancelled && activeThread) {
          openSocket(activeThread);
        }
      } catch {
        /* background connect optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, ensureThread, openSocket]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      const activeThread = threadRef.current;
      if (!body || !activeThread) return;

      const optimisticId = `pending-${crypto.randomUUID()}`;
      const optimistic: ChatMessageItem = {
        id: optimisticId,
        thread_id: activeThread.id,
        sender_role: "customer",
        body,
        created_at: new Date().toISOString(),
        metadata: {},
      };
      setMessages((prev) => [...prev, optimistic]);
      setError(null);

      const ws = socketRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ body }));
          return;
        } catch {
          /* HTTP fallback below */
        }
      }

      try {
        const res = await sendChatMessage(activeThread.id, body);
        const saved = normalizeChatMessage(res.message as unknown as Record<string, unknown>, activeThread.id);
        if (!saved) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setError("Xabar yuborilmadi");
          return;
        }
        setMessages((prev) => {
          const withoutPending = prev.filter((m) => m.id !== optimisticId);
          return upsertChatMessage(withoutPending, saved);
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        const message = err instanceof Error ? err.message : "Xabar yuborilmadi";
        setError(message);
        push(message, "error");
      }
    },
    [push],
  );

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    socketRef.current?.close();
    socketRef.current = null;
    setConnected(false);
    setReconnecting(false);
  }, [clearReconnectTimer]);

  useEffect(
    () => () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
    },
    [clearReconnectTimer],
  );

  return {
    thread,
    messages,
    connected,
    reconnecting,
    error,
    unreadCount,
    connect,
    send,
    disconnect,
    setPanelOpen,
  };
}
