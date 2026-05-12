"use client";

import { useCallback, useState } from "react";

import { stylistLookbook } from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    try {
      const response = await stylistLookbook({
        user_id: "web-user",
        text: content,
      });
      const assistant: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.explanation || "Tayyor!",
      };
      setMessages((prev) => [...prev, assistant]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Hozir ulanish muammosi. Qayta urinib ko'ring.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
