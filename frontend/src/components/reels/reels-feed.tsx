"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, ChevronDown, ChevronUp,
  Heart, MessageCircle, MoreHorizontal,
  Play, Share2, ShoppingBag, Store,
  Volume2, VolumeX, X,
} from "lucide-react";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */
interface TaggedProduct {
  id: string; name: string; price: number;
  images?: string[]; shop_slug?: string; shop_name?: string;
}
interface ReelsVideoItem {
  id: string;
  shop: { id: string; name: string; slug: string; logo_url?: string };
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  hashtags?: string[];
  tagged_products?: TaggedProduct[];
  likes_count: number;
  views_count: number;
  shares_count: number;
  saves_count?: number;
  comments_count?: number;
}

interface ReelsComment {
  id: string;
  session_id: string;
  text: string;
  reported_count?: number;
  created_at?: string | null;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${(n / 1000).toFixed(1)}K` : String(n);

function ping(videoId: string, sid: string, data: object) {
  void fetch("/api/v1/reels/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId, session_id: sid, ...data }),
  }).catch(() => {});
}

/* ─── Product Sheet ─────────────────────────────────────────── */
function ProductSheet({ products, onClose }: { products: TaggedProduct[]; onClose: () => void }) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 35, stiffness: 420 }}
      className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: "max(1.5rem,env(safe-area-inset-bottom,0px))" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-neutral-200" />
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className="font-bold text-neutral-900">Mahsulotlar ({products.length})</h3>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100">
          <X className="h-4 w-4 text-neutral-500" />
        </button>
      </div>
      <div className="max-h-[50dvh] overflow-y-auto space-y-2.5 px-4 pb-6">
        {products.map((p) => (
          <Link key={p.id} href={`/product/${p.id}`}
            className="flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 active:bg-neutral-100"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
              {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-neutral-900 leading-snug">{p.name}</p>
              {p.shop_name && <p className="mt-0.5 text-xs text-neutral-400">{p.shop_name}</p>}
              <p className="mt-1 text-base font-black text-blue-600">
                {p.price.toLocaleString("uz-UZ")} so'm
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

function CommentsSheet({
  comments,
  sessionId,
  value,
  onChange,
  onSubmit,
  onDelete,
  onReport,
  actionBusyId,
  submitting,
  onClose,
}: {
  comments: ReelsComment[];
  sessionId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDelete: (comment: ReelsComment) => void;
  onReport: (comment: ReelsComment) => void;
  actionBusyId: string | null;
  submitting: boolean;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 35, stiffness: 420 }}
      className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: "max(1.25rem,env(safe-area-inset-bottom,0px))" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-neutral-200" />
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className="font-bold text-neutral-900">Izohlar ({comments.length})</h3>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100">
          <X className="h-4 w-4 text-neutral-500" />
        </button>
      </div>

      <div className="max-h-[42dvh] overflow-y-auto space-y-2 px-4 pb-3">
        {comments.length ? comments.map((comment) => (
          <div key={comment.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
            <p className="text-sm text-neutral-800">{comment.text}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">
                {comment.reported_count ? `report: ${comment.reported_count}` : ""}
              </span>
              {comment.session_id === sessionId ? (
                <button
                  type="button"
                  onClick={() => onDelete(comment)}
                  disabled={actionBusyId === comment.id}
                  className="text-[11px] font-semibold text-red-500 disabled:opacity-50"
                >
                  O'chirish
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onReport(comment)}
                  disabled={actionBusyId === comment.id}
                  className="text-[11px] font-semibold text-amber-600 disabled:opacity-50"
                >
                  Report
                </button>
              )}
            </div>
          </div>
        )) : (
          <p className="py-8 text-center text-sm text-neutral-400">Hali izoh yo'q</p>
        )}
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Izoh yozing..."
            className="h-9 flex-1 rounded-xl px-2 text-sm outline-none"
            maxLength={500}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !value.trim()}
            className="rounded-xl bg-black px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {submitting ? "..." : "Yuborish"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Single Reel ───────────────────────────────────────────── */
function ReelCard({
  video, active, sessionId, muted, onToggleMute, onPrev, onNext, hasPrev, hasNext,
}: {
  video: ReelsVideoItem; active: boolean; sessionId: string; muted: boolean;
  onToggleMute: () => void; onPrev: () => void; onNext: () => void;
  hasPrev: boolean; hasNext: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchStart = useRef(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(video.likes_count);
  const [shares, setShares] = useState(video.shares_count);
  const [shared, setShared] = useState(false);
  const [savesCount, setSavesCount] = useState(video.saves_count ?? 0);
  const [commentsCount, setCommentsCount] = useState(video.comments_count ?? 0);
  const [paused, setPaused] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ReelsComment[]>([]);
  const [commentValue, setCommentValue] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentActionBusyId, setCommentActionBusyId] = useState<string | null>(null);
  const [capExpanded, setCapExpanded] = useState(false);
  const caption = video.caption || "";
  const videoSrc = resolveMediaUrl(video.video_url);
  const posterSrc = video.thumbnail_url ? resolveMediaUrl(video.thumbnail_url) : undefined;
  const short = caption.length > 80 ? caption.slice(0, 80) + "…" : caption;
  const hasProducts = (video.tagged_products?.length ?? 0) > 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.muted = muted;
      el.currentTime = 0;
      void el.play().catch(() => {});
      setPaused(false);
      watchStart.current = Date.now();
    } else {
      el.pause();
      if (watchStart.current > 0) {
        const secs = (Date.now() - watchStart.current) / 1000;
        const pct = el.duration > 0 ? Math.min(1, secs / el.duration) : 0;
        watchStart.current = 0;
        ping(video.id, sessionId, { watch_seconds: secs, watch_pct: pct });
      }
    }
  }, [active]); // eslint-disable-line

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

  const tapVideo = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { void el.play(); setPaused(false); }
    else { el.pause(); setPaused(true); }
  };

  const doLike = () => {
    const next = !liked; setLiked(next); setLikes(c => c + (next ? 1 : -1));
    ping(video.id, sessionId, { is_liked: next });
  };
  const doShare = () => {
    void navigator.share?.({ url: `${window.location.origin}/reels`, title: caption }).catch(() => {});
    if (!shared) {
      setShared(true);
      setShares((count) => count + 1);
      ping(video.id, sessionId, { is_shared: true });
    }
  };
  const doSave = () => {
    setSaved((prev) => {
      const next = !prev;
      setSavesCount((count) => Math.max(0, count + (next ? 1 : -1)));
      ping(video.id, sessionId, { is_saved: next });
      return next;
    });
  };
  const openComments = async () => {
    setShowComments(true);
    try {
      const data = await fetch(`/api/v1/reels/${video.id}/comments?limit=50`).then((r) => r.json());
      setComments(data.items ?? []);
    } catch {
      setComments([]);
    }
  };
  const submitComment = async () => {
    const text = commentValue.trim();
    if (!text) return;
    setCommentSubmitting(true);
    try {
      const data = await fetch(`/api/v1/reels/${video.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, text }),
      }).then((r) => r.json());
      if (data?.item) {
        setComments((prev) => [data.item, ...prev]);
        setCommentsCount((count) => count + 1);
        setCommentValue("");
      }
    } finally {
      setCommentSubmitting(false);
    }
  };
  const deleteComment = async (comment: ReelsComment) => {
    setCommentActionBusyId(comment.id);
    try {
      await fetch(`/api/v1/reels/${video.id}/comments/${comment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setCommentsCount((count) => Math.max(0, count - 1));
    } finally {
      setCommentActionBusyId(null);
    }
  };
  const reportComment = async (comment: ReelsComment) => {
    setCommentActionBusyId(comment.id);
    try {
      const data = await fetch(`/api/v1/reels/${video.id}/comments/${comment.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, reason: "abuse" }),
      }).then((r) => r.json());
      setComments((prev) => prev.map((c) => (
        c.id === comment.id ? { ...c, reported_count: data?.reported_count ?? (c.reported_count ?? 0) } : c
      )));
    } finally {
      setCommentActionBusyId(null);
    }
  };

  return (
    /*
     * DESKTOP: flex row — [video 9:16] + [right panel]
     * MOBILE: just the video full-screen
     */
    <div className="relative flex h-full w-full items-center justify-center bg-black">

      {/* ── Video column ───────────────────────────────────── */}
      <div
        className="relative h-full flex-shrink-0 overflow-hidden bg-black"
        /* 9:16 max width = min(height * 9/16, 100vw) */
        style={{ width: "min(calc(100dvh * 9 / 16), 100vw)", maxWidth: "430px" }}
      >
        {/* Blurred background for landscape videos */}
        {video.thumbnail_url && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${video.thumbnail_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(28px) brightness(0.35) saturate(1.3)",
              transform: "scale(1.15)",
            }}
          />
        )}

        {/* Main video */}
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc}
          loop
          playsInline
          muted={muted}
          preload={active ? "auto" : "none"}
          onClick={tapVideo}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            cursor: "pointer",
          }}
        />

        {/* Vignette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent" />

        {/* Pause flash */}
        <AnimatePresence>
          {paused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
                <Play className="ml-1 h-9 w-9 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom info (inside video) ─────────────────── */}
        <div
          className="absolute inset-x-3 flex flex-col gap-1.5"
          style={{ bottom: "max(5.5rem, calc(5rem + env(safe-area-inset-bottom,0px)))" }}
        >
          {/* Shop */}
          <Link
            href={`/shop/${video.shop.slug}`}
            className="flex w-fit items-center gap-2"
          >
            {video.shop.logo_url ? (
              <img src={video.shop.logo_url} alt={video.shop.name}
                className="h-9 w-9 rounded-full border-2 border-white object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-indigo-600">
                <Store className="h-4 w-4 text-white" />
              </div>
            )}
            <span className="text-[14px] font-bold text-white drop-shadow-md">
              {video.shop.name}
            </span>
            <span className="rounded-full border border-white/60 px-2 py-0.5 text-[11px] font-bold text-white">
              Kuzatish
            </span>
          </Link>

          {/* Caption */}
          {caption && (
            <p
              className="text-[13px] leading-snug text-white/95 drop-shadow"
              onClick={() => setCapExpanded(v => !v)}
            >
              {capExpanded ? caption : short}
              {caption.length > 80 && !capExpanded && (
                <span className="ml-1 font-semibold text-white/60">ko'proq</span>
              )}
            </p>
          )}

          {/* Hashtags */}
          {video.hashtags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {video.hashtags.slice(0, 5).map(tag => (
                <span key={tag} className="text-[12px] font-semibold text-blue-300">#{tag}</span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Mute — bottom right of video */}
        <button
          type="button"
          onClick={onToggleMute}
          className="absolute bottom-6 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
        >
          {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
        </button>

        {/* Product button */}
        {hasProducts && (
          <button
            type="button"
            onClick={() => setShowProducts(true)}
            className="absolute left-3 z-20 flex items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-3 py-1.5 backdrop-blur-md"
            style={{ bottom: "max(11.5rem, calc(11rem + env(safe-area-inset-bottom,0px)))" }}
          >
            <ShoppingBag className="h-4 w-4 text-white" />
            <span className="text-[12px] font-bold text-white">{video.tagged_products!.length} mahsulot</span>
          </button>
        )}

        {/* Mobile-only right sidebar */}
        <div
          className="absolute right-2 flex flex-col items-center gap-5 md:hidden"
          style={{ bottom: "max(8rem, calc(7.5rem + env(safe-area-inset-bottom,0px)))" }}
        >
          <button type="button" onClick={doLike} className="flex flex-col items-center gap-0.5">
            <motion.div whileTap={{ scale: 1.4 }}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full",
                liked ? "bg-red/15" : "bg-black/30 backdrop-blur-sm")}
            >
              <Heart className={cn("h-6 w-6", liked ? "fill-red text-red" : "text-white")} />
            </motion.div>
            <span className="text-[11px] font-bold text-white">{fmt(likes)}</span>
          </button>

          <button type="button" onClick={openComments} className="flex flex-col items-center gap-0.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-[11px] font-bold text-white">{fmt(commentsCount)}</span>
          </button>

          <button type="button" onClick={doShare} className="flex flex-col items-center gap-0.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-[11px] font-bold text-white">{fmt(shares)}</span>
          </button>

          <button type="button" onClick={doSave} className="flex flex-col items-center gap-0.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
              <Bookmark className={cn("h-5 w-5", saved ? "fill-white text-white" : "text-white")} />
            </div>
            <span className="text-[11px] font-bold text-white">{fmt(savesCount)}</span>
          </button>
        </div>

        {/* Product sheet */}
        <AnimatePresence>
          {showProducts && hasProducts && (
            <div className="absolute inset-0 z-40" onClick={() => setShowProducts(false)}>
              <ProductSheet products={video.tagged_products!} onClose={() => setShowProducts(false)} />
            </div>
          )}
          {showComments && (
            <div className="absolute inset-0 z-40" onClick={() => setShowComments(false)}>
              <CommentsSheet
                comments={comments}
                sessionId={sessionId}
                value={commentValue}
                onChange={setCommentValue}
                onSubmit={submitComment}
                onDelete={deleteComment}
                onReport={reportComment}
                actionBusyId={commentActionBusyId}
                submitting={commentSubmitting}
                onClose={() => setShowComments(false)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Desktop right panel ──────────────────────────── */}
      <div className="hidden md:flex ml-4 flex-col items-center gap-5 self-end pb-16">
        {/* Shop avatar */}
        <div className="relative mb-1">
          <Link href={`/shop/${video.shop.slug}`}>
            {video.shop.logo_url ? (
              <img src={video.shop.logo_url} alt={video.shop.name}
                className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-lg" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                <Store className="h-5 w-5 text-white" />
              </div>
            )}
          </Link>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600">
            <span className="text-[10px] font-black text-white leading-none">+</span>
          </div>
        </div>

        {/* Like */}
        <button type="button" onClick={doLike} className="flex flex-col items-center gap-1">
          <motion.div whileTap={{ scale: 1.3 }}
            className={cn("flex h-11 w-11 items-center justify-center rounded-full",
              liked ? "bg-red/15" : "bg-neutral-800/70 backdrop-blur-sm")}
          >
            <Heart className={cn("h-[26px] w-[26px]", liked ? "fill-red text-red" : "text-white")} />
          </motion.div>
          <span className="text-[11px] font-bold text-white">{fmt(likes)}</span>
        </button>

        {/* Comment */}
        <button type="button" onClick={openComments} className="flex flex-col items-center gap-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/70 backdrop-blur-sm">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">{fmt(commentsCount)}</span>
        </button>

        {/* Share */}
        <button type="button" onClick={doShare} className="flex flex-col items-center gap-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/70 backdrop-blur-sm">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">{fmt(shares)}</span>
        </button>

        {/* Save */}
        <button type="button" onClick={doSave} className="flex flex-col items-center gap-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/70 backdrop-blur-sm">
            <Bookmark className={cn("h-5 w-5", saved ? "fill-white text-white" : "text-white")} />
          </div>
          <span className="text-[11px] font-bold text-white">{fmt(savesCount)}</span>
        </button>

        {/* More */}
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/70 backdrop-blur-sm">
          <MoreHorizontal className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* ── Desktop up/down nav arrows (far right) ──────── */}
      <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/80 text-white transition hover:bg-neutral-700/80 disabled:opacity-30"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800/80 text-white transition hover:bg-neutral-700/80 disabled:opacity-30"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Feed ─────────────────────────────────────────────── */
export function ReelsFeed({ shopSlug, category }: { shopSlug?: string; category?: string }) {
  const [videos, setVideos] = useState<ReelsVideoItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(`s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const busy = useRef(false);
  const pageRef = useRef(0);

  const load = useCallback(async (p: number) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const params = new URLSearchParams({
        page: String(p), limit: "8", session_id: sessionId.current,
      });
      if (shopSlug) params.set("shop_slug", shopSlug);
      if (category) params.set("category", category);
      const d = await fetch(`/api/v1/reels/feed?${params}`).then(r => r.json());
      const items: ReelsVideoItem[] = d.items ?? [];
      setVideos(prev => p === 0 ? items : [...prev, ...items]);
      setHasMore(d.has_more ?? false);
      pageRef.current = p + 1;
      setPage(p + 1);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [shopSlug, category]);

  useEffect(() => {
    setVideos([]); pageRef.current = 0; setLoading(true);
    void load(0);
  }, [load]);

  /* Scroll-snap intersection observer */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cards = el.querySelectorAll("[data-reel]");
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = Number((e.target as HTMLElement).dataset.reelIdx ?? 0);
          setActiveIdx(idx);
          if (idx >= videos.length - 2 && hasMore && !busy.current) void load(pageRef.current);
        }
      });
    }, { threshold: 0.6, root: el });
    cards.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, [videos, hasMore, load]);

  /* Keyboard nav */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") setActiveIdx(i => Math.min(i + 1, videos.length - 1));
      if (e.key === "ArrowUp") setActiveIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videos.length]);

  /* Scroll to active on keyboard nav */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.querySelector(`[data-reel-idx="${activeIdx}"]`) as HTMLElement | null;
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeIdx]);

  if (!loading && !videos.length) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-black text-center">
        <span className="text-5xl">🎬</span>
        <p className="text-lg font-bold text-white">Hali reel yo'q</p>
        <p className="text-sm text-white/50">Do'konlar video yuklasa bu yerda chiqadi</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="scrollbar-hide overflow-y-scroll snap-y snap-mandatory"
      style={{ height: "100dvh" }}
    >
      {videos.map((v, idx) => (
        <div
          key={v.id}
          data-reel
          data-reel-idx={idx}
          className="snap-start snap-always"
          style={{ height: "100dvh" }}
        >
          <ReelCard
            video={v}
            active={activeIdx === idx}
            sessionId={sessionId.current}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            onPrev={() => setActiveIdx(i => Math.max(0, i - 1))}
            onNext={() => setActiveIdx(i => Math.min(videos.length - 1, i + 1))}
            hasPrev={idx > 0}
            hasNext={idx < videos.length - 1}
          />
        </div>
      ))}
      {loading && (
        <div className="flex snap-start snap-always items-center justify-center bg-black" style={{ height: "100dvh" }}>
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        </div>
      )}
    </div>
  );
}
