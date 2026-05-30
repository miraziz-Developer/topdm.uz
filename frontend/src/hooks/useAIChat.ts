"use client";

import { useCallback, useRef, useState } from "react";

import {
  type ChatAgentBlock,
  type ChatAgentProductSnapshot,
  type ChatAgentSearchDeeplink,
  type ChatAgentTurnResponse,
} from "@/lib/api";
import { chatAgentTurnStream, type ChatAgentStreamDone } from "@/lib/chat-agent-stream";
import { ApiError } from "@/lib/http-client";
import { useLocale } from "@/i18n/locale-provider";
import { parseBudgetFromQuery, type BudgetHints } from "@/lib/budget-query";
import { stylistProfileForApi } from "@/lib/stylist-profile";
import { useLocationStore } from "@/stores/location-store";
import { useUserStore } from "@/stores/user-store";
import type { Product } from "@/types";

export type ChatMiniMapBlock = Extract<ChatAgentBlock, { type: "mini_map" }>;

export type WardrobeSlotView = {
  role: string;
  product_id: string;
  item: Product;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  photoMode?: "look_check" | "personal_style" | "find_similar";
  streaming?: boolean;
  products?: Array<{ product: Product; reason: string }>;
  wardrobeSlots?: WardrobeSlotView[];
  wardrobeBudgetTotal?: number;
  miniMap?: ChatMiniMapBlock;
  searchDeeplink?: ChatAgentSearchDeeplink;
  suggestions?: string[];
  engine?: string;
  route?: string;
};

function snapshotToProduct(item: ChatAgentProductSnapshot): Product {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    images: item.images ?? [],
    category: item.category ?? undefined,
    is_available: item.is_available,
    is_featured: item.is_featured,
    view_count: item.view_count,
    shop: {
      ...item.shop,
      shop_number: item.shop?.shop_number ?? item.shop?.section,
      section: item.shop?.section ?? item.shop?.shop_number,
    },
  };
}

function filterByBudget(products: Product[], budget: BudgetHints): Product[] {
  return products.filter((item) => {
    if (budget.max_price !== undefined && item.price > budget.max_price) return false;
    if (budget.min_price !== undefined && item.price < budget.min_price) return false;
    return true;
  });
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
  }
  return out;
}

function parseAgentMessage(
  response: Pick<
    ChatAgentTurnResponse,
    "assistant_text" | "blocks" | "suggestions" | "search_deeplink" | "engine" | "route"
  >,
  budget: BudgetHints,
  messageId: string,
): ChatMessage {
  const products: Product[] = [];
  let wardrobeSlots: WardrobeSlotView[] | undefined;
  let miniMap: ChatMiniMapBlock | undefined;

  for (const block of response.blocks ?? []) {
    if (block.type === "product_cards") {
      for (const item of block.items ?? []) {
        products.push(snapshotToProduct(item));
      }
    }
    if (block.type === "wardrobe_bundle") {
      wardrobeSlots = block.slots.map((slot) => ({
        role: slot.role,
        product_id: slot.product_id,
        item: snapshotToProduct(slot.item),
      }));
    }
    if (block.type === "mini_map") {
      miniMap = block;
    }
  }

  const filtered = filterByBudget(dedupeProducts(products), budget);
  const content = response.assistant_text?.trim() || "";
  const wardrobeBudgetTotal = wardrobeSlots?.reduce((sum, s) => sum + (s.item.price || 0), 0);
  const suggestions = (response.suggestions ?? []).filter(Boolean);

  return {
    id: messageId,
    role: "assistant",
    content,
    streaming: false,
    products: filtered.length ? filtered.map((product) => ({ product, reason: "AI stylist" })) : undefined,
    wardrobeSlots,
    wardrobeBudgetTotal: wardrobeSlots?.length ? wardrobeBudgetTotal : undefined,
    miniMap,
    searchDeeplink: response.search_deeplink,
    suggestions: suggestions.length ? suggestions : undefined,
    engine: response.engine,
    route: response.route,
  };
}

function streamDoneToTurnResponse(done: ChatAgentStreamDone): Pick<
  ChatAgentTurnResponse,
  "assistant_text" | "blocks" | "suggestions" | "search_deeplink" | "engine" | "route"
> {
  return {
    assistant_text: done.assistant_text,
    blocks: done.blocks ?? [],
    suggestions: done.suggestions ?? [],
    search_deeplink: done.search_deeplink,
    engine: done.engine,
    route: done.route,
  };
}

function upsertMessage(prev: ChatMessage[], next: ChatMessage): ChatMessage[] {
  const index = prev.findIndex((m) => m.id === next.id);
  if (index === -1) return [...prev, next];
  const copy = [...prev];
  copy[index] = next;
  return copy;
}

export function useAIChat() {
  const { locale } = useLocale();
  const profile = useUserStore((state) => state.profile);
  const navNodeId = useLocationStore((state) => state.navNodeId);
  const threadIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t-${Date.now()}`,
  );
  const abortRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isTyping = isLoading && !messages.some((m) => m.streaming);

  const sendMessage = useCallback(
    async (
      content: string,
      imageBase64?: string,
      options?: { photoMode?: "look_check" | "personal_style" | "find_similar"; imagePreview?: string },
    ) => {
      const trimmed = content.trim();
      if (!trimmed && !imageBase64) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed || "📷 Rasm yuborildi",
        imagePreview: options?.imagePreview,
        photoMode: options?.photoMode,
      };
      const assistantId = crypto.randomUUID();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsLoading(true);

      const budget = parseBudgetFromQuery(trimmed);
      const userKey = profile?.phone || profile?.id || profile?.email || "web-user";

      const failAssistant = (message: string) => {
        setMessages((prev) =>
          upsertMessage(prev, {
            id: assistantId,
            role: "assistant",
            content: message,
            streaming: false,
          }),
        );
      };

      try {
        await chatAgentTurnStream(
          {
            user_id: userKey,
            thread_id: threadIdRef.current,
            text: trimmed,
            user_nav_node_id: navNodeId || "entrance-A",
            image_base64: imageBase64,
            image_mime: imageBase64?.startsWith("data:") ? undefined : "image/jpeg",
            photo_mode: options?.photoMode,
            client_profile: stylistProfileForApi(locale),
          },
          {
            onToken: (delta) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: `${m.content}${delta}`, streaming: true } : m,
                ),
              );
            },
            onDone: (done) => {
              const finalized = parseAgentMessage(streamDoneToTurnResponse(done), budget, assistantId);
              setMessages((prev) => upsertMessage(prev, finalized));
            },
            onError: (err) => {
              failAssistant(err.message);
            },
          },
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ApiError
            ? err.status === 429
              ? "Juda ko'p so'rov. Bir daqiqadan keyin qayta urinib ko'ring."
              : err.message
            : err instanceof Error
              ? err.message
              : "Hozir ulanish muammosi. Qayta urinib ko'ring.";
        failAssistant(message);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsLoading(false);
        setMessages((prev) => prev.map((m) => (m.id === assistantId && m.streaming ? { ...m, streaming: false } : m)));
      }
    },
    [locale, navNodeId, profile?.id, profile?.email, profile?.phone],
  );

  const userKey = profile?.phone || profile?.id || profile?.email || "web-user";

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setIsLoading(false);
    threadIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t-${Date.now()}`;
  }, []);

  return {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    clearChat,
    threadId: threadIdRef.current,
    userId: userKey,
  };
}
