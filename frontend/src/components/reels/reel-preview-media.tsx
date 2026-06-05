"use client";

import { useCallback, useEffect, useState } from "react";

import { isUnreliableShopMedia } from "@/lib/shop-branding";
import { resolveReelPosterUrl, resolveReelVideoUrl } from "@/lib/media";

const REEL_PREVIEW_FALLBACK =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=720&q=80";

type Props = {
  videoUrl: string;
  thumbnailUrl?: string | null;
  playable?: boolean;
  className?: string;
};

function reliablePosterUrl(thumbnailUrl?: string | null): string | undefined {
  if (isUnreliableShopMedia(thumbnailUrl)) return undefined;
  const resolved = resolveReelPosterUrl(thumbnailUrl);
  return resolved || undefined;
}

type PreviewMode = "video" | "poster" | "fallback";

/**
 * Reels kartochka — video birinchi kadr; buzuk logo poster sifatida ishlatilmaydi.
 */
export function ReelPreviewMedia({
  videoUrl,
  thumbnailUrl,
  playable = true,
  className = "absolute inset-0 h-full w-full object-cover",
}: Props) {
  const videoSrc = playable !== false ? resolveReelVideoUrl(videoUrl) : "";
  const posterSrc = reliablePosterUrl(thumbnailUrl);
  const [mode, setMode] = useState<PreviewMode>(() =>
    videoSrc ? "video" : posterSrc ? "poster" : "fallback",
  );

  useEffect(() => {
    setMode(videoSrc ? "video" : posterSrc ? "poster" : "fallback");
  }, [videoUrl, thumbnailUrl, playable, videoSrc, posterSrc]);

  const onVideoError = useCallback(() => {
    setMode(posterSrc ? "poster" : "fallback");
  }, [posterSrc]);

  const onPosterError = useCallback(() => {
    setMode("fallback");
  }, []);

  if (mode === "video" && videoSrc) {
    return (
      <video
        key={`${videoSrc}-${posterSrc ?? ""}`}
        src={videoSrc}
        poster={posterSrc}
        className={className}
        muted
        playsInline
        preload="metadata"
        onError={onVideoError}
        onLoadedData={(e) => {
          const el = e.currentTarget;
          try {
            if (el.duration > 0.15) el.currentTime = 0.12;
          } catch {
            /* ignore seek errors */
          }
        }}
      />
    );
  }

  if (mode === "poster" && posterSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={posterSrc}
        alt=""
        className={className}
        loading="lazy"
        onError={onPosterError}
      />
    );
  }

  return <ReelPreviewFallback className={className} />;
}

function ReelPreviewFallback({ className }: { className: string }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div
      className={`${className} relative overflow-hidden bg-gradient-to-br from-neutral-800 via-indigo-950 to-black`}
    >
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={REEL_PREVIEW_FALLBACK}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-85"
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : null}
    </div>
  );
}
