/** Global AI chat ochish (duplicate #ai-trigger muammosiz). */

export const AI_CHAT_OPEN_EVENT = "bozor:ai-chat-open";
export const STYLIST_PROMPT_EVENT = "bozor:stylist-prompt";

export function openAIChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_CHAT_OPEN_EVENT));
}
