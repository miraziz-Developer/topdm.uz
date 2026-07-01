"use client";

import { getAccessToken } from "@/lib/auth";
import type { ChatThreadSummary } from "@/lib/api";
import { listMerchantChatThreads } from "@/lib/api";
import { wsBaseUrl } from "@/lib/http-client";
import { resolveMerchantSession } from "@/lib/merchant-session";

type InboxListener = (state: MerchantChatInboxState) => void;

export type MerchantChatInboxState = {
  threads: ChatThreadSummary[];
  totalUnread: number;
  connected: boolean;
};

let state: MerchantChatInboxState = {
  threads: [],
  totalUnread: 0,
  connected: false,
};

const listeners = new Set<InboxListener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let subscriberCount = 0;
let started = false;

const MAX_RECONNECT_DELAY_MS = 12_000;

function notify() {
  for (const listener of listeners) {
    listener(state);
  }
}

function setState(patch: Partial<MerchantChatInboxState>) {
  state = { ...state, ...patch };
  notify();
}

function mergeThreadUpdate(thread: ChatThreadSummary, totalUnread?: number) {
  const existing = state.threads.find((t) => t.id === thread.id);
  const threads = existing
    ? state.threads.map((t) => (t.id === thread.id ? { ...t, ...thread } : t))
    : [thread, ...state.threads];
  threads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const unread =
    typeof totalUnread === "number"
      ? totalUnread
      : threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
  setState({ threads, totalUnread: unread });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function refreshThreads() {
  try {
    await resolveMerchantSession();
    const res = await listMerchantChatThreads();
    setState({
      threads: res.items,
      totalUnread: res.total_unread ?? res.items.reduce((sum, t) => sum + (t.unread_count ?? 0), 0),
    });
  } catch {
    /* ignore */
  }
}

async function openInboxSocket() {
  const token = (await resolveMerchantSession()) ?? getAccessToken();
  if (!token) return;

  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  const ws = new WebSocket(`${wsBaseUrl()}/ws/chat/inbox?token=${encodeURIComponent(token)}`);
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
    setState({ connected: true });
  };

  ws.onclose = () => {
    setState({ connected: false });
    socket = null;
    if (subscriberCount <= 0) return;
    const attempt = reconnectAttempt;
    reconnectAttempt = attempt + 1;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 800 * 2 ** attempt);
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      if (subscriberCount > 0) void openInboxSocket();
    }, delay);
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as {
        type?: string;
        thread?: ChatThreadSummary;
        total_unread?: number;
      };
      if (payload.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (payload.type === "inbox_update" && payload.thread) {
        mergeThreadUpdate(payload.thread, payload.total_unread);
      }
    } catch {
      /* ignore */
    }
  };
}

function startInboxBus() {
  if (started) return;
  started = true;
  void refreshThreads();
  void openInboxSocket();
}

function stopInboxBus() {
  if (subscriberCount > 0) return;
  started = false;
  clearReconnectTimer();
  socket?.close();
  socket = null;
  setState({ connected: false });
}

export function subscribeMerchantChatInbox(listener: InboxListener): () => void {
  subscriberCount += 1;
  listeners.add(listener);
  startInboxBus();
  listener(state);

  return () => {
    listeners.delete(listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    stopInboxBus();
  };
}

export function patchMerchantChatInboxThread(threadId: string, patch: Partial<ChatThreadSummary>) {
  const threads = state.threads.map((t) => (t.id === threadId ? { ...t, ...patch } : t));
  const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
  setState({ threads, totalUnread });
}

export function getMerchantChatInboxState(): MerchantChatInboxState {
  return state;
}

export async function refreshMerchantChatInbox() {
  await refreshThreads();
}
