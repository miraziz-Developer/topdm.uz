"use client";

import { CrmPageHeader } from "@/components/crm-page-header";
import { ShopLiveChatPanel } from "@/components/shop-live-chat-panel";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <CrmPageHeader
        eyebrow="Muloqot"
        title="Jonli mijoz chati"
        description="Saytdan yozgan mijozlarga tez javob bering — suhbatlar va tez javoblar bitta joyda"
      />
      <ShopLiveChatPanel />
    </div>
  );
}
