"use client";

import { useEffect, useState } from "react";

import {
  getMerchantChatInboxState,
  subscribeMerchantChatInbox,
  type MerchantChatInboxState,
} from "@/lib/merchant-chat-inbox-bus";

export function useMerchantChatInbox(): MerchantChatInboxState {
  const [inbox, setInbox] = useState<MerchantChatInboxState>(() => getMerchantChatInboxState());

  useEffect(() => subscribeMerchantChatInbox(setInbox), []);

  return inbox;
}
