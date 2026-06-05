"use client";

import { Copy, Download, Link2, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CrmSection } from "@/components/crm/crm-section";
import { ShopQrPoster } from "@/components/shop-qr-poster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMerchantShareKit, type MerchantShareKit } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  compact?: boolean;
};

export function ShopShareKitPanel({ compact = false }: Props) {
  const [kit, setKit] = useState<MerchantShareKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState("invite_long");

  useEffect(() => {
    getMerchantShareKit()
      .then((data) => {
        setKit(data);
        setActiveId(data.share_messages[0]?.id ?? "invite_long");
      })
      .catch(() => toast.error("Ma'lumot yuklanmadi"))
      .finally(() => setLoading(false));
  }, []);

  const copy = (text: string, label = "Nusxalandi") => {
    void navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const activeMessage = kit?.share_messages.find((m) => m.id === activeId) ?? kit?.share_messages[0];

  if (loading) {
    return <div className="skeleton h-72 rounded-2xl" />;
  }

  if (!kit) {
    return (
      <div className="crm-surface-card py-14 text-center">
        <p className="text-sm text-text-400">Havola va QR hozircha tayyor emas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="crm-surface-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(240px,280px)_1fr]">
          <div className="flex flex-col items-center border-b border-border-subtle bg-gradient-to-b from-electric-500/[0.06] to-canvas/30 p-6 lg:border-b-0 lg:border-r">
            <p className="text-center text-lg font-bold text-text-100">{kit.shop_name}</p>
            <p className="mt-1 text-center text-xs text-text-400">Mijoz skaner qiladi — do&apos;koningiz ochiladi</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={kit.qr_poster_url || kit.qr_image_url}
              alt={`${kit.shop_name} QR`}
              className="mt-4 w-full max-w-[220px] rounded-xl bg-white p-2 shadow-md ring-1 ring-border-subtle"
            />
            <a href={kit.qr_download_url} download={`${kit.shop_slug}-qr-bozorliii.png`} className="mt-4 w-full max-w-[220px]">
              <button type="button" className="crm-btn-primary w-full">
                <Download className="mr-2 inline h-4 w-4" />
                QR yuklab olish
              </button>
            </a>
            <div className="mt-4 w-full max-w-[220px]">
              <ShopQrPoster kit={kit} />
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Do&apos;kon havolasi</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={kit.shop_url} className="font-mono text-xs" />
                <Button type="button" variant="secondary" onClick={() => copy(kit.shop_url, "Havola nusxalandi")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {kit.location_line ? <p className="mt-2 text-xs text-text-400">{kit.location_line}</p> : null}
              <p className="text-xs text-text-400">{kit.hours_line}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={kit.whatsapp_share_url} target="_blank" rel="noreferrer">
                <Button type="button" variant="secondary" size="sm">
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  WhatsApp
                </Button>
              </a>
              <a href={kit.telegram_share_url} target="_blank" rel="noreferrer">
                <Button type="button" variant="secondary" size="sm">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                  Telegram
                </Button>
              </a>
              <Button type="button" variant="secondary" size="sm" onClick={() => copy(kit.default_message)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Matnni nusxalash
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!compact ? (
        <CrmSection
          title="Mijozga yuborish matni"
          description="Tayyor xabar — bir bosishda nusxalang yoki WhatsAppda yuboring"
          icon={Link2}
        >
          <div className="flex flex-wrap gap-1 rounded-xl bg-canvas p-1">
            {kit.share_messages.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => setActiveId(msg.id)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-semibold transition",
                  activeId === msg.id ? "bg-surface text-electric-600 shadow-sm ring-1 ring-border-subtle" : "text-text-400 hover:text-text-100",
                )}
              >
                {msg.label}
              </button>
            ))}
          </div>

          {activeMessage ? (
            <div className="mt-4 space-y-3">
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border-subtle bg-canvas/80 p-4 text-sm leading-relaxed text-text-100">
                {activeMessage.text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => copy(activeMessage.text, `${activeMessage.label} nusxalandi`)}
                >
                  <Copy className="mr-2 inline h-4 w-4" />
                  Nusxalash
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(activeMessage.text)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" variant="secondary">
                    WhatsAppda yuborish
                  </Button>
                </a>
              </div>
            </div>
          ) : null}
        </CrmSection>
      ) : null}
    </div>
  );
}
