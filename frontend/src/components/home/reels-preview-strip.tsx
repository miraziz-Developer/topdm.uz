"use client";

import Link from "next/link";
import { Eye, Film, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ReelItem {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  shop: { name: string; slug: string; logo_url?: string };
  views_count: number;
  likes_count: number;
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function ReelThumb({
  reel,
  idx,
  featured = false,
  compact = false,
}: {
  reel: ReelItem;
  idx: number;
  featured?: boolean;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    setPlaying(true);
    void videoRef.current?.play().catch(() => {});
  };
  const stop = () => {
    setPlaying(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  };

  return (
    <Link
      href={`/reels?video_id=${reel.id}`}
      className={`group relative block overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10 transition duration-300 hover:-translate-y-0.5 hover:ring-electric-400/60 ${
        featured ? "h-[280px] sm:h-[320px]" : compact ? "h-[160px] sm:h-[152px]" : "h-[210px] sm:h-[240px]"
      }`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onTouchStart={play}
    >
      {/* Thumbnail */}
      {reel.thumbnail_url && (
        <img
          src={reel.thumbnail_url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${playing ? "opacity-0" : "opacity-100"}`}
        />
      )}
      {!reel.thumbnail_url && (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={reel.video_url}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsInline
        preload={idx < 3 ? "metadata" : "none"}
      />

      {/* Gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Play button */}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition group-hover:bg-white/35">
            <Play className="ml-0.5 h-4 w-4 text-white" />
          </div>
        </div>
      )}

      {/* Bottom */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className={`line-clamp-1 font-bold text-white ${featured ? "text-xs" : "text-[11px]"}`}>{reel.shop.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-white/70">
          <Eye className="h-3 w-3" />
          <p className="text-[10px]">{fmt(reel.views_count)} ko'rish</p>
        </div>
      </div>
    </Link>
  );
}

export function ReelsPreviewStrip() {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/reels/feed?limit=8&session_id=home")
      .then((r) => r.json())
      .then((d) => setReels(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && !reels.length) return null;

  return (
    <section className="py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-3xl border border-border-100 bg-white/85 p-3 shadow-[0_10px_30px_rgba(3,3,8,0.06)] backdrop-blur-sm sm:p-4">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-neon-500 to-electric-500">
                <Film className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-100">Reels</h2>
                <p className="text-[11px] text-text-400">Do'konlar videolari</p>
              </div>
            </div>
            <Link
              href="/reels"
              className="text-xs font-bold text-electric-500 transition hover:underline"
            >
              Barchasini ko'rish →
            </Link>
          </div>

          {/* Showcase layout */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`skeleton rounded-2xl ${i === 0 ? "col-span-2 h-[280px] sm:col-span-2 sm:h-[320px]" : "h-[160px] sm:h-[152px]"}`}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {reels.slice(0, 5).map((reel, i) => (
                <div
                  key={reel.id}
                  className={i === 0 ? "col-span-2 sm:col-span-2 sm:row-span-2" : ""}
                >
                  <ReelThumb reel={reel} idx={i} featured={i === 0} compact={i > 0} />
                </div>
              ))}
            </div>
          )}

          {/* Full feed CTA */}
          <div className="mt-3">
            <Link
              href="/reels"
              className="flex items-center justify-center gap-2 rounded-2xl border border-neon-500/20 bg-gradient-to-r from-neon-500/8 to-electric-500/8 py-3 text-sm font-bold text-neon-600 transition hover:from-neon-500/12 hover:to-electric-500/12"
            >
              <Film className="h-4 w-4" />
              Reels — TikTok uslubida to'liq ko'rish
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
