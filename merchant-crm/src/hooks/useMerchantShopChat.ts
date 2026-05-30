"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMerchantChatMessages,
  listMerchantChatThreads,
  type ChatMessageItem,
  type ChatThreadSummary,
} from "@/lib/api";
import type { ChatConnectionState } from "@/components/ui/connection-status";
import { getAccessToken } from "@/lib/auth";
import { wsBaseUrl } from "@/lib/http-client";

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
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
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

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    const res = await listMerchantChatThreads();
    setThreads(res.items);
    return res.items;
  }, []);

  const openSocket = useCallback(
    (threadId: string) => {
      const token = getAccessToken();
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
          if (activeThreadRef.current === threadId) openSocket(threadId);
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
          if (payload.type === "error") {
            setError(String(payload.message || "Xatolik"));
            return;
          }
          if (payload.body && payload.sender_role) {
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
            void refreshThreads();
          }
        } catch {
          /* ignore */
        }
      };
    },
    [clearReconnectTimer, refreshThreads],
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      intentionalCloseRef.current = false;
      setActiveThreadId(threadId);
      activeThreadRef.current = threadId;
      setError(null);
      const history = await getMerchantChatMessages(threadId);
      setMessages(history.items);
      openSocket(threadId);
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
    openSocket(threadId);
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
