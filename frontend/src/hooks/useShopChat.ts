"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { createChatThread, getChatMessages, type ChatMessageItem, type ChatThreadItem } from "@/lib/api";
import { getSessionId } from "@/lib/utils";

const MAX_RECONNECT_DELAY_MS = 12_000;

import { publicBackendOrigin } from "@/lib/backend-origin";

function wsBaseUrl(): string {
  const origin = publicBackendOrigin();
  const url = new URL(origin);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}

export function useShopChat(shopId: string | undefined, shopName?: string) {
  const { push } = useToast();
  const [thread, setThread] = useState<ChatThreadItem | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const threadRef = useRef<ChatThreadItem | null>(null);
  const reconnectToastShownRef = useRef(false);

  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const openSocket = useCallback(
    (activeThread: ChatThreadItem) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      const sessionId = getSessionId();
      const ws = new WebSocket(
        `${wsBaseUrl()}/ws/chat/${activeThread.id}?role=customer&session_id=${encodeURIComponent(sessionId)}`,
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
          const payload = JSON.parse(event.data) as {
            type?: string;
            body?: string;
            sender_role?: string;
            id?: string;
            message?: string;
            code?: string;
            metadata?: Record<string, unknown>;
          };

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
          const isChatMessage =
            payload.type === "message" || (Boolean(payload.body) && Boolean(payload.sender_role));
          if (isChatMessage) {
            const role = payload.sender_role as ChatMessageItem["sender_role"];
            setMessages((prev) => {
              if (payload.id && prev.some((m) => m.id === payload.id)) return prev;
              return [
                ...prev,
                {
                  id: payload.id || crypto.randomUUID(),
                  thread_id: activeThread.id,
                  sender_role: role,
                  body: payload.body!,
                  created_at: new Date().toISOString(),
                  metadata: payload.metadata ?? {},
                },
              ];
            });
          }
        } catch {
          /* ignore non-json */
        }
      };
    },
    [clearReconnectTimer, push],
  );

  const connect = useCallback(async () => {
    if (!shopId) return;
    intentionalCloseRef.current = false;
    setError(null);
    const sessionId = getSessionId();
    let activeThread = threadRef.current;
    if (!activeThread) {
      const res = await createChatThread({
        shop_id: shopId,
        customer_key: sessionId,
        customer_display_name: shopName ? `Mijoz · ${shopName}` : "Mijoz",
      });
      activeThread = res.thread;
      setThread(activeThread);
      threadRef.current = activeThread;
      const history = await getChatMessages(activeThread.id);
      setMessages(history.items);
    }
    openSocket(activeThread);
  }, [shopId, shopName, openSocket]);

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

  return { thread, messages, connected, reconnecting, error, connect, send, disconnect };
}
