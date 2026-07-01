"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMerchantChatMessages,
  markMerchantChatThreadRead,
  type ChatMessageItem,
  type ChatThreadSummary,
} from "@/lib/api";
import type { ChatConnectionState } from "@/components/ui/connection-status";
import { getAccessToken } from "@/lib/auth";
import {
  getMerchantChatInboxState,
  patchMerchantChatInboxThread,
  refreshMerchantChatInbox,
  subscribeMerchantChatInbox,
} from "@/lib/merchant-chat-inbox-bus";
import { wsBaseUrl } from "@/lib/http-client";
import { resolveMerchantSession } from "@/lib/merchant-session";

const MAX_RECONNECT_DELAY_MS = 12_000;

function deriveConnectionState(
  activeThreadId: string | null,
  connected: boolean,
  reconnecting: boolean,
  connecting: boolean,
): ChatConnectionState {
  if (!activeThreadId) return "idle";
  if (connected) return "online";
  if (reconnecting) return "reconnecting";
  if (connecting) return "connecting";
  return "offline";
}

export function useMerchantShopChat() {
  const [threads, setThreads] = useState<ChatThreadSummary[]>(() => getMerchantChatInboxState().threads);
  const [totalUnread, setTotalUnread] = useState(() => getMerchantChatInboxState().totalUnread);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const activeThreadRef = useRef<string | null>(null);

  useEffect(() => {
    activeThreadRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(
    () =>
      subscribeMerchantChatInbox((inbox) => {
        setThreads(inbox.threads);
        setTotalUnread(inbox.totalUnread);
      }),
    [],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    await refreshMerchantChatInbox();
    return getMerchantChatInboxState().threads;
  }, []);

  const markActiveThreadRead = useCallback(async (threadId: string) => {
    try {
      const res = await markMerchantChatThreadRead(threadId);
      if (res.thread) {
        patchMerchantChatInboxThread(threadId, { unread_count: 0, ...res.thread });
      } else {
        patchMerchantChatInboxThread(threadId, { unread_count: 0 });
      }
    } catch {
      patchMerchantChatInboxThread(threadId, { unread_count: 0 });
    }
  }, []);

  const openSocket = useCallback(
    async (threadId: string) => {
      const token = (await resolveMerchantSession()) ?? getAccessToken();
      if (!token) return;
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }

      setConnecting(true);
      setConnected(false);
      const ws = new WebSocket(
        `${wsBaseUrl()}/ws/chat/${threadId}?role=merchant&token=${encodeURIComponent(token)}`,
      );
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setConnecting(false);
        setReconnecting(false);
        setError(null);
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        socketRef.current = null;
        if (intentionalCloseRef.current || activeThreadRef.current !== threadId) {
          setReconnecting(false);
          return;
        }
        setReconnecting(true);
        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current = attempt + 1;
        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 800 * 2 ** attempt);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (activeThreadRef.current === threadId) void openSocket(threadId);
        }, delay);
      };

      ws.onerror = () => setError("Chat ulanishi uzildi — qayta ulanmoqda…");

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            body?: string;
            sender_role?: string;
            id?: string;
            thread_id?: string;
            message?: string;
          };
          if (payload.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (payload.type === "error") {
            setError(String(payload.message || "Xatolik"));
            return;
          }
          const isChatMessage =
            payload.type === "message" || (Boolean(payload.body) && Boolean(payload.sender_role));
          if (!isChatMessage) return;

          const role = payload.sender_role as ChatMessageItem["sender_role"];
          setMessages((prev) => {
            if (payload.id && prev.some((m) => m.id === payload.id)) return prev;
            return [
              ...prev,
              {
                id: payload.id || crypto.randomUUID(),
                thread_id: threadId,
                sender_role: role,
                body: payload.body!,
                created_at: new Date().toISOString(),
                metadata: {},
              },
            ];
          });

          if (role === "customer" && activeThreadRef.current === threadId) {
            void markActiveThreadRead(threadId);
          }
        } catch {
          /* ignore */
        }
      };
    },
    [clearReconnectTimer, markActiveThreadRead],
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      intentionalCloseRef.current = false;
      setActiveThreadId(threadId);
      activeThreadRef.current = threadId;
      setError(null);
      const history = await getMerchantChatMessages(threadId);
      setMessages(history.items);
      patchMerchantChatInboxThread(threadId, { unread_count: 0 });
      void openSocket(threadId);
    },
    [openSocket],
  );

  const send = useCallback((text: string) => {
    const body = text.trim();
    if (!body || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ body }));
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    socketRef.current?.close();
    socketRef.current = null;
    setConnected(false);
    setConnecting(false);
    setReconnecting(false);
  }, [clearReconnectTimer]);

  const reconnect = useCallback(() => {
    const threadId = activeThreadRef.current;
    if (!threadId) return;
    intentionalCloseRef.current = false;
    clearReconnectTimer();
    void openSocket(threadId);
  }, [clearReconnectTimer, openSocket]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await refreshThreads();
        if (!cancelled && items.length > 0) {
          await selectThread(items[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Chat yuklanmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [disconnect, refreshThreads, selectThread]);

  const connectionState = deriveConnectionState(activeThreadId, connected, reconnecting, connecting);

  return {
    threads,
    totalUnread,
    activeThreadId,
    messages,
    connected,
    reconnecting,
    connecting,
    connectionState,
    loading,
    error,
    selectThread,
    send,
    refreshThreads,
    reconnect,
  };
}
