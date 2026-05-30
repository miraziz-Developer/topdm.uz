"use client";

import { motion } from "framer-motion";
import { Camera, Loader2, UserRound } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function avatarStorageKey(userId: string) {
  return `bozor_avatar_${userId}`;
}

function loadStoredAvatar(userId: string): string | null {
  try {
    return localStorage.getItem(avatarStorageKey(userId));
  } catch {
    return null;
  }
}

function saveStoredAvatar(userId: string, dataUrl: string) {
  try {
    localStorage.setItem(avatarStorageKey(userId), dataUrl);
  } catch {
    /* quota */
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

type ProfileAvatarUploadProps = {
  userId: string;
  displayName: string;
  className?: string;
};

export function ProfileAvatarUpload({ userId, displayName, className }: ProfileAvatarUploadProps) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const stored = loadStoredAvatar(userId);
    if (stored) setAvatarUrl(stored);
  }, [userId]);

  useEffect(() => {
    return () => {
      if (previewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  const triggerFileInput = useCallback(() => {
    if (!isUploading) fileInputRef.current?.click();
  }, [isUploading]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      if (!ACCEPT.includes(file.type)) {
        push("Faqat JPG, PNG yoki WebP rasmlar qabul qilinadi", "error");
        return;
      }
      if (file.size > MAX_BYTES) {
        push("Rasm hajmi 5 MB dan oshmasligi kerak", "error");
        return;
      }

      if (previewRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previewRef.current);
      }
      const localPreview = URL.createObjectURL(file);
      previewRef.current = localPreview;
      setAvatarUrl(localPreview);
      setIsUploading(true);

      try {
        const dataUrl = await readFileAsDataUrl(file);
        // Backend: POST /api/v1/auth/me/avatar (multipart) — keyingi bosqich
        await new Promise((resolve) => setTimeout(resolve, 600));
        saveStoredAvatar(userId, dataUrl);
        if (previewRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(previewRef.current);
          previewRef.current = null;
        }
        setAvatarUrl(dataUrl);
        push("Profil rasmi yangilandi", "success");
      } catch {
        push("Rasmni yuklab bo'lmadi", "error");
        const fallback = loadStoredAvatar(userId);
        setAvatarUrl(fallback);
      } finally {
        setIsUploading(false);
      }
    },
    [push, userId],
  );

  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <motion.button
      type="button"
      onClick={triggerFileInput}
      disabled={isUploading}
      whileHover={{ scale: isUploading ? 1 : 1.02 }}
      whileTap={{ scale: isUploading ? 1 : 0.98 }}
      className={cn(
        "group relative shrink-0 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50 focus-visible:ring-offset-2",
        isUploading && "cursor-wait",
        className,
      )}
      aria-label="Profil rasmini o'zgartirish"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT.join(",")}
        onChange={(e) => void handleFileChange(e)}
        className="sr-only"
        tabIndex={-1}
      />

      <motion.div
        className={cn(
          "relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-2xl p-[2.5px]",
          "bg-gradient-to-tr from-neon-500 via-amber-400 to-electric-500 shadow-gold",
          "transition-shadow duration-300 group-hover:shadow-hover",
        )}
      >
        <motion.div
          className="relative h-full w-full overflow-hidden rounded-[14px] bg-elevated ring-1 ring-white/80"
          animate={isUploading ? { opacity: 0.85 } : { opacity: 1 }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              fill
              className="object-cover"
              sizes="72px"
              unoptimized={avatarUrl.startsWith("data:") || avatarUrl.startsWith("blob:")}
            />
          ) : (
            <motion.div
              className="flex h-full w-full items-center justify-center bg-gradient-gold text-white"
              initial={false}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.25 }}
            >
              {initials.length >= 1 ? (
                <span className="text-lg font-bold tracking-tight">{initials}</span>
              ) : (
                <UserRound className="h-7 w-7" aria-hidden />
              )}
            </motion.div>
          )}

          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-ink-900/0 transition-colors duration-300 group-hover:bg-ink-900/35"
            initial={false}
          >
            {!isUploading ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/20 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                <Camera className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </span>
            ) : null}
          </motion.div>

          {isUploading ? (
            <motion.div className="absolute inset-0 flex items-center justify-center bg-ink-900/45 backdrop-blur-[2px]">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            </motion.div>
          ) : null}
        </motion.div>
      </motion.div>

      <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-electric-500 text-white shadow-md transition group-hover:scale-110">
        <Camera className="h-3 w-3" aria-hidden />
      </span>
    </motion.button>
  );
}
