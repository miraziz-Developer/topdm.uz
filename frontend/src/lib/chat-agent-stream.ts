import type { ChatAgentBlock, ChatAgentSearchDeeplink, StylistClientProfilePayload } from "@/lib/api";
import { getBozorClientHeaders } from "@/lib/client-context";
import { resolveBrowserApiBaseUrl } from "@/lib/http-client";

export type ChatAgentStreamDone = {
  type: "done";
  assistant_text: string;
  blocks?: ChatAgentBlock[];
  suggestions?: string[];
  route?: string;
  engine?: string;
  search_deeplink?: ChatAgentSearchDeeplink;
};

export type ChatAgentStreamHandlers = {
  onToken: (delta: string) => void;
  onDone: (payload: ChatAgentStreamDone) => void;
  onError: (error: Error) => void;
};

export type ChatAgentStreamPayload = {
  user_id: string;
  thread_id?: string;
  text?: string;
  user_nav_node_id?: string;
  image_base64?: string;
  image_mime?: string;
  photo_mode?: "look_check" | "personal_style" | "find_similar";
  client_profile?: StylistClientProfilePayload;
};

function parseSseDataLine(line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const raw = trimmed.slice(5).trim();
  if (!raw || raw === "[DONE]") return { type: "done_marker" };
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** POST + SSE reader for `/chat/agent/turn/stream`. */
export async function chatAgentTurnStream(
  payload: ChatAgentStreamPayload,
  handlers: ChatAgentStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const base = typeof window === "undefined" ? "/api/v1" : resolveBrowserApiBaseUrl();
  const response = await fetch(`${base}/chat/agent/turn/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...getBozorClientHeaders(),
    },
    body: JSON.stringify(payload),
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = `So'rov muvaffaqiyatsiz (${response.status})`;
    try {
      const json = JSON.parse(raw) as { detail?: string };
      if (typeof json.detail === "string") message = json.detail;
    } catch {
      if (raw) message = raw.slice(0, 240);
    }
    handlers.onError(new Error(message));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError(new Error("Streaming body unavailable"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const flushSseBuffer = (raw: string) => {
    for (const line of raw.split("\n")) {
      const parsed = parseSseDataLine(line);
      if (!parsed || typeof parsed !== "object") continue;
      const event = parsed as Record<string, unknown>;
      if (event.type === "done_marker") continue;
      if (event.type === "token" && typeof event.delta === "string") {
        handlers.onToken(event.delta);
        continue;
      }
      if (event.type === "done") {
        handlers.onDone(event as ChatAgentStreamDone);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      if (done) break;

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        flushSseBuffer(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) flushSseBuffer(buffer);
  } catch (err) {
    if (signal?.aborted) return;
    handlers.onError(err instanceof Error ? err : new Error("Stream interrupted"));
  }
}
