"use client";

import Link from "next/link";
import { Eye, Film, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { ReelPreviewMedia } from "@/components/reels/reel-preview-media";
import { isUnreliableShopMedia } from "@/lib/shop-branding";

interface ReelItem {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  playable?: boolean;
  caption?: string;
  shop: { name: string; slug: string; logo_url?: string | null };
  views_count: number;
  likes_count: number;
}

const PREVIEW_LIMIT = 12;
const CARD_WIDTH = "w-[100px] sm:w-[112px]";

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Oxirgi + tasodifiy aralash — har safar biroz boshqacha tartib. */
function mixReels(items: ReelItem[]): ReelItem[] {
  if (items.length <= 1) return items;
  const sorted = [...items].sort((a, b) => b.views_count - a.views_count);
  const recent = sorted.slice(0, Math.min(4, sorted.length));
  const rest = sorted.slice(recent.length);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...recent, ...rest];
}

function ReelThumb({ reel }: { reel: ReelItem }) {
  return (
    <Link
      href={`/reels?video_id=${reel.id}`}
      className={`group relative block shrink-0 snap-start overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10 transition duration-300 hover:-translate-y-0.5 hover:ring-electric-400/60 ${CARD_WIDTH} aspect-[9/16]`}
    >
      <ReelPreviewMedia
        videoUrl={reel.video_url}
        thumbnailUrl={
          reel.thumbnail_url ||
          (isUnreliableShopMedia(reel.shop?.logo_url) ? null : reel.shop?.logo_url)
        }
        playable={reel.playable !== false}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90 transition group-hover:opacity-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-white/35">
          <Play className="ml-0.5 h-3.5 w-3.5 text-white" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2">
        <p className="line-clamp-1 text-[10px] font-bold text-white">{reel.shop.name}</p>
        <div className="mt-0.5 flex items-center gap-1 text-white/70">
          <Eye className="h-2.5 w-2.5 shrink-0" />
          <p className="text-[9px]">{fmt(reel.views_count)}</p>
        </div>
      </div>
    </Link>
  );
}

export function ReelsPreviewStrip() {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/reels/feed?limit=${PREVIEW_LIMIT}&session_id=home`)
      .then((r) => r.json())
      .then((d) => {
        const raw: ReelItem[] = d.items ?? [];
        const items = raw.filter((item) => {
          const hasVideo = Boolean(item.video_url?.trim());
          const canShow =
            item.playable !== false ||
            Boolean(item.thumbnail_url?.trim()) ||
            Boolean(item.shop?.logo_url?.trim() && !isUnreliableShopMedia(item.shop.logo_url));
          return hasVideo && canShow;
        });
        setReels(mixReels(items));
      })
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-3xl border border-border-100 bg-white/85 p-3 shadow-[0_10px_30px_rgba(3,3,8,0.06)] backdrop-blur-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-neon-500 to-electric-500">
                <Film className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-100">Reels</h2>
                <p className="text-[11px] text-text-400">Do&apos;konlar videolari</p>
              </div>
            </div>
            <Link href="/reels" className="shrink-0 text-xs font-bold text-electric-500 transition hover:underline">
              Barchasini ko&apos;rish →
            </Link>
          </div>

          {loading ? (
            <div className="scrollbar-hide -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`skeleton shrink-0 snap-start rounded-2xl ${CARD_WIDTH} aspect-[9/16]`}
                />
              ))}
            </div>
          ) : reels.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-subtle bg-elevated/40 px-4 py-8 text-center text-sm text-ink-500">
              Hali reel yo&apos;q. CRM orqali video yuklang — shu yerda chiqadi.
            </p>
          ) : (
            <div className="scrollbar-hide -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
              {reels.map((reel) => (
                <ReelThumb key={reel.id} reel={reel} />
              ))}
            </div>
          )}

          <div className="mt-3">
            <Link
              href="/reels"
              className="flex items-center justify-center gap-2 rounded-2xl border border-neon-500/20 bg-gradient-to-r from-neon-500/8 to-electric-500/8 py-2.5 text-sm font-bold text-neon-600 transition hover:from-neon-500/12 hover:to-electric-500/12"
            >
              <Film className="h-4 w-4" />
              Reels — to&apos;liq ko&apos;rish
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
