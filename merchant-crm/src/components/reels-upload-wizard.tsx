"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Film,
  Hash,
  Heart,
  MessageCircle,
  Play,
  Search,
  Share2,
  Tag,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { getMerchantProducts, getJson, postFormData } from "@/lib/api";

interface Product {
  id: string;
  name: string;
  price: number;
  images?: string[];
}

interface ReelsVideo {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  hashtags?: string[];
  views_count: number;
  likes_count: number;
  shares_count?: number;
  saves_count?: number;
  comments_count?: number;
  tagged_products?: Product[];
  created_at: string;
}

/* ─── Upload Wizard ──────────────────────────────────────────── */
export function ReelsUploadWizard({ onSuccess }: { onSuccess?: (v: ReelsVideo) => void }) {
  const [step, setStep] = useState<"upload" | "edit" | "done">("upload");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tagged, setTagged] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMerchantProducts().then((d: { items?: Product[] }) => setProducts(d.items || [])).catch(() => {});
  }, []);

  const onFilePick = (file: File) => {
    if (!file.type.startsWith("video/")) { setError("Faqat video fayl (MP4/WebM)"); return; }
    if (file.size > 50 * 1024 * 1024) { setError("Video 50MB dan kichik bo'lishi kerak"); return; }
    setVideoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setStep("edit");
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#+/, "");
    if (tag && !hashtags.includes(tag)) setHashtags((h) => [...h, tag]);
    setHashtagInput("");
  };

  const toggleProduct = (p: Product) =>
    setTagged((prev) => prev.find((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]);

  const handleSubmit = async () => {
    if (!videoFile) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      if (caption) fd.append("caption", caption);
      if (hashtags.length) fd.append("hashtags", hashtags.join(","));
      if (tagged.length) fd.append("tagged_product_ids", tagged.map((p) => p.id).join(","));

      const result = await postFormData<{ video: ReelsVideo }>("/reels/merchant/upload", fd);
      setStep("done");
      onSuccess?.(result.video);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklashda xato");
    } finally {
      setUploading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green/15">
          <Film className="h-8 w-8 text-green" />
        </div>
        <h3 className="text-xl font-bold text-text-100">Reel yuklandi!</h3>
        <p className="text-sm text-text-400">Feed algoritmida ko&apos;rinishga tayyorlanmoqda</p>
        <Button onClick={() => { setStep("upload"); setVideoFile(null); setPreviewUrl(null); setTagged([]); setHashtags([]); setCaption(""); }}>
          Yangi reel qo&apos;shish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <div
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFilePick(f); }}
          onClick={() => fileRef.current?.click()}
          className="group flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-electric-500/30 bg-electric-500/5 transition hover:border-electric-500/60 hover:bg-electric-500/8"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-electric-500/10 text-electric-500 transition group-hover:bg-electric-500/20">
            <Upload className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="font-bold text-text-100">Video tashlang yoki tanlang</p>
            <p className="mt-1 text-sm text-text-400">9:16 format, MP4 / WebM, maks 50MB</p>
          </div>
          <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFilePick(f); }} />
        </div>
      )}

      {step === "edit" && previewUrl && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Video preview */}
          <div className="flex justify-center">
            <div className="relative w-[220px]">
              <video
                src={previewUrl}
                className="w-full rounded-2xl object-cover shadow-elevated"
                style={{ aspectRatio: "9/16" }}
                muted
                loop
                playsInline
                autoPlay
              />
              <button
                type="button"
                onClick={() => { setStep("upload"); setVideoFile(null); setPreviewUrl(null); }}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Edit form */}
          <div className="space-y-5">
            {/* Caption */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-400">
                Tavsif (caption)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Do'koningiz, mahsulot yoki hazil haqida yozing..."
                rows={3}
                className="w-full resize-none rounded-2xl border border-border-subtle bg-white p-3 text-sm outline-none transition focus:border-electric-500"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-400">
                <Hash className="h-3.5 w-3.5" /> Hashtaglar
              </label>
              <div className="flex gap-2">
                <input
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addHashtag(); } }}
                  placeholder="#Ippodrom #Prikol #Kiyim"
                  className="flex-1 rounded-xl border border-border-subtle bg-white px-3 py-2 text-sm outline-none focus:border-electric-500"
                />
                <Button size="sm" variant="secondary" onClick={addHashtag}>+</Button>
              </div>
              {hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 rounded-full bg-electric-500/10 px-2.5 py-0.5 text-xs font-semibold text-electric-600">
                      #{tag}
                      <button type="button" onClick={() => setHashtags((h) => h.filter((t) => t !== tag))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Product tagging */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-400">
                <Tag className="h-3.5 w-3.5" /> Mahsulot tagging ({tagged.length} tanlandi)
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mahsulot qidiring..."
                  className="w-full rounded-xl border border-border-subtle bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-electric-500"
                />
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border-subtle bg-canvas p-2">
                {filteredProducts.slice(0, 15).map((p) => {
                  const isTagged = tagged.some((t) => t.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                        isTagged ? "bg-electric-500/12 text-electric-700" : "hover:bg-white",
                      )}
                    >
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-elevated" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-text-400">{p.price.toLocaleString("uz-UZ")} so&apos;m</p>
                      </div>
                      {isTagged && <div className="h-5 w-5 rounded-full bg-electric-500 text-white flex items-center justify-center text-xs font-bold">✓</div>}
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="py-4 text-center text-xs text-text-400">Mahsulot topilmadi</p>
                )}
              </div>
            </div>

            {error && <p className="rounded-xl border border-red/20 bg-red/5 px-3 py-2 text-sm text-red">{error}</p>}

            <Button className="w-full" onClick={handleSubmit} disabled={uploading}>
              {uploading ? "Yuklanmoqda..." : "Reelni nashr qilish →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const fmtCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${(n / 1000).toFixed(1)}K` : String(n);

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002").replace(/\/$/, "");

function MerchantReelViewerModal({
  videos,
  index,
  onClose,
  onIndexChange,
}: {
  videos: ReelsVideo[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const video = videos[index];
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasPrev = index > 0;
  const hasNext = index < videos.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1);
  }, [hasPrev, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1);
  }, [hasNext, index, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => undefined);
  }, [video?.id]);

  if (!video) return null;

  const videoSrc = resolveMediaUrl(video.video_url);
  const posterSrc = video.thumbnail_url ? resolveMediaUrl(video.thumbnail_url) : undefined;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
        onClick={onClose}
      >
        <motion.div
          key={video.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="relative flex h-[100dvh] w-full max-w-md flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm font-semibold">Reel ko&apos;rish</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              aria-label="Yopish"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="relative mx-4 flex-1 overflow-hidden rounded-3xl bg-black">
            <video
              ref={videoRef}
              key={videoSrc}
              src={videoSrc}
              poster={posterSrc}
              className="h-full w-full object-contain"
              playsInline
              loop
              controls
              autoPlay
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              {video.caption ? <p className="text-sm font-medium text-white">{video.caption}</p> : null}
              {video.hashtags?.length ? (
                <p className="mt-1 text-xs text-white/70">{video.hashtags.map((t) => `#${t}`).join(" ")}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 px-4 py-3 text-xs font-semibold text-white/90">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {fmtCount(video.views_count)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {fmtCount(video.likes_count)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {video.comments_count ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" /> {video.shares_count ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bookmark className="h-3.5 w-3.5" /> {video.saves_count ?? 0}
            </span>
          </div>

          <footer className="flex items-center justify-between gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={goPrev}
              className="rounded-full bg-white/10 p-2 text-white disabled:opacity-30"
              aria-label="Oldingi"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <a
              href={`${SITE_URL}/reels`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-electric px-4 py-2.5 text-sm font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              Mijozlar ko&apos;rinishi
            </a>
            <button
              type="button"
              disabled={!hasNext}
              onClick={goNext}
              className="rounded-full bg-white/10 p-2 text-white disabled:opacity-30"
              aria-label="Keyingi"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Merchant Reels Gallery (3-column TikTok grid) ─────────── */
export function MerchantReelsGallery({ shopSlug: _shopSlug }: { shopSlug?: string }) {
  const [videos, setVideos] = useState<ReelsVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    getJson<{ items: ReelsVideo[] }>("/reels/merchant/my")
      .then((d) => setVideos(d.items || []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[9/16] rounded-xl" />
        ))}
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Film className="h-12 w-12 text-text-400" />
        <p className="font-semibold text-text-100">Hali reel yo&apos;q</p>
        <p className="text-sm text-text-400">Birinchi marketingvideo yuklang — mijozlar ko&apos;rsin</p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-text-400">Reel ustiga bosing — to&apos;liq ekranda ko&apos;ring (Instagram/TikTok kabi)</p>
      <div className="grid grid-cols-3 gap-1">
        {videos.map((v, i) => {
          const thumb = v.thumbnail_url ? resolveMediaUrl(v.thumbnail_url) : resolveMediaUrl(v.video_url);
          return (
            <button
              key={v.id}
              type="button"
              className="group relative overflow-hidden rounded-xl bg-ink-900 text-left"
              style={{ aspectRatio: "9/16" }}
              onClick={() => setViewerIndex(i)}
            >
              {v.thumbnail_url ? (
                <img src={thumb} alt={v.caption || "Reel"} className="h-full w-full object-cover" />
              ) : (
                <video
                  src={resolveMediaUrl(v.video_url)}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <Play className="ml-0.5 h-5 w-5 text-ink-900" />
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-white">
                  <Eye className="h-3 w-3" />
                  {fmtCount(v.views_count)}
                  <Heart className="ml-1 h-3 w-3" />
                  {v.likes_count}
                  <MessageCircle className="ml-1 h-3 w-3" />
                  {v.comments_count ?? 0}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {viewerIndex !== null ? (
        <MerchantReelViewerModal
          videos={videos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </>
  );
}
