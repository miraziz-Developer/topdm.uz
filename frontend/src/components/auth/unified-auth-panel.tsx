"use client";

import { motion } from "framer-motion";
import { Mail, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { TelegramLoginButton, type TelegramAuthPayload } from "@/components/auth/telegram-login-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useToast } from "@/components/ui/toast";
import { authTelegram, sendEmailOtp, sendTelegramOtp, verifyEmailOtp, verifyTelegramOtp } from "@/lib/api";
import { ApiError } from "@/lib/http-client";
import { authMetaFromTokenResponse, establishSession, setClientSession } from "@/lib/auth";
import type { AuthTokenResponse } from "@/lib/api";
import { useUserStore } from "@/stores/user-store";
import { cn } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

type AuthMode = "primary" | "email" | "otp" | "tg_user" | "tg_otp";

type UnifiedAuthPanelProps = {
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
};

export function UnifiedAuthPanel({ onSuccess, redirectTo = "/profile", className }: UnifiedAuthPanelProps) {
  const router = useRouter();
  const { push } = useToast();
  const refreshProfile = useUserStore((state) => state.refresh);

  const [mode, setMode] = useState<AuthMode>("primary");
  const [email, setEmail] = useState("");
  const [tgUsername, setTgUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const botHandle = TELEGRAM_BOT ? `@${TELEGRAM_BOT.replace(/^@+/, "")}` : "";

  const finishLogin = useCallback(
    async (auth: AuthTokenResponse) => {
      await establishSession(auth.token);
      setClientSession(authMetaFromTokenResponse(auth));
      await refreshProfile();
      push("Kirish muvaffaqiyatli!", "success");
      onSuccess?.();
      router.push(redirectTo);
    },
    [onSuccess, push, redirectTo, refreshProfile, router],
  );

  const handleTelegramWidget = useCallback(
    async (payload: TelegramAuthPayload) => {
      setLoading(true);
      try {
        const res = await authTelegram(payload as unknown as Record<string, unknown>);
        await finishLogin(res);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Telegram orqali kirish muvaffaqiyatsiz";
        push(message, "error");
      } finally {
        setLoading(false);
      }
    },
    [finishLogin, push],
  );

  const normalizedTgUsername = tgUsername.trim().replace(/^@+/, "").toLowerCase();

  const sendTelegramCode = async () => {
    if (!normalizedTgUsername || normalizedTgUsername.length < 5) {
      push("Telegram username kiriting (masalan: username)", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await sendTelegramOtp(normalizedTgUsername);
      if (process.env.NODE_ENV === "development" && res.dev_otp) {
        push(`Kod yuborildi (dev: ${res.dev_otp})`, "success");
      } else {
        push(`Kod ${botHandle} botiga yuborildi`, "success");
      }
      setMode("tg_otp");
      setOtp("");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Kod yuborib bo'lmadi. Avval botda /start bosing.";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyTelegramCode = async () => {
    if (otp.length < 4) {
      push("4 xonali kodni kiriting", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyTelegramOtp({ telegram_username: normalizedTgUsername, otp });
      await finishLogin(res);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Kod noto'g'ri yoki muddati tugagan";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      push("Email manzilini to'g'ri kiriting", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await sendEmailOtp(normalizedEmail);
      if (process.env.NODE_ENV === "development" && res.dev_otp) {
        push(`Kod yuborildi (dev: ${res.dev_otp})`, "success");
      } else {
        push("Tasdiqlash kodi emailingizga yuborildi", "success");
      }
      setMode("otp");
      setOtp("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Kod yuborib bo'lmadi";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailCode = async () => {
    if (otp.length < 4) {
      push("4 xonali kodni kiriting", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp({ email: normalizedEmail, otp });
      await finishLogin(res);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Kod noto'g'ri yoki muddati tugagan";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full max-w-md", className)}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel-strong overflow-hidden rounded-3xl shadow-elevated ring-1 ring-black/[0.04]"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-border-subtle bg-gradient-electric px-6 py-8 text-center text-white"
        >
          <div className="mx-auto mb-4 flex justify-center">
            <BozorliiiLogo variant="icon" size="lg" href={null} className="rounded-2xl ring-2 ring-white/30" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bozorliii.uz ga kirish</h1>
          <p className="mt-2 text-sm text-white/85">Telegram yoki email — xavfsiz va tez</p>
        </motion.div>

        <div className="space-y-6 p-6">
          {mode === "primary" ? (
            <>
              <div className="space-y-3">
                <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-500">
                  Asosiy usul
                </p>
                <TelegramLoginButton
                  botUsername={TELEGRAM_BOT.replace(/^@+/, "")}
                  onAuth={handleTelegramWidget}
                  className="w-full"
                />
                {loading ? (
                  <p className="text-center text-xs text-ink-500">Telegram tasdiqlanmoqda…</p>
                ) : null}
                <p className="text-center text-[11px] leading-relaxed text-ink-400">
                  Tugma chiqmasa: BotFather → <span className="font-medium">/setdomain</span> →{" "}
                  <span className="font-medium">bozorliii.online</span>
                </p>
              </div>

              <div className="relative flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border-subtle" />
                <span className="text-xs font-medium text-ink-400">yoki</span>
                <div className="h-px flex-1 bg-border-subtle" />
              </div>

              <Button type="button" variant="secondary" className="w-full" onClick={() => setMode("tg_user")}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Bot orqali kod (username)
              </Button>

              <Button type="button" variant="secondary" className="w-full" onClick={() => setMode("email")}>
                <Mail className="mr-2 h-4 w-4" />
                Email orqali davom etish
              </Button>
            </>
          ) : null}

          {mode === "email" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void sendEmailCode();
              }}
            >
              <Input
                type="email"
                label="Email manzil"
                placeholder="siz@mail.uz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                disabled={loading}
              />
              <Button type="submit" className="w-full" isLoading={loading} leftIcon={<Send className="h-4 w-4" />}>
                Kod yuborish
              </Button>
              <button
                type="button"
                onClick={() => setMode("primary")}
                className="w-full text-center text-sm text-ink-500 hover:text-electric-600"
              >
                Telegram orqali kirish
              </button>
            </form>
          ) : null}

          {mode === "tg_user" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void sendTelegramCode();
              }}
            >
              <p className="text-center text-xs text-ink-500">
                Avval {botHandle} da <span className="font-semibold">/start</span> bosing, keyin username kiriting.
              </p>
              <Input
                label="Telegram username"
                placeholder="username"
                value={tgUsername}
                onChange={(e) => setTgUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
              <Button type="submit" className="w-full" isLoading={loading} leftIcon={<Send className="h-4 w-4" />}>
                Kod yuborish
              </Button>
              <button
                type="button"
                onClick={() => setMode("primary")}
                className="w-full text-center text-sm text-ink-500 hover:text-electric-600"
              >
                Telegram tugmasiga qaytish
              </button>
            </form>
          ) : null}

          {mode === "tg_otp" ? (
            <div className="space-y-5">
              <p className="text-center text-sm text-ink-600">
                <span className="font-semibold text-ink-900">@{normalizedTgUsername}</span> uchun botdan 4 xonali kod
              </p>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              <Button
                className="w-full"
                onClick={() => void verifyTelegramCode()}
                isLoading={loading}
                disabled={otp.length < 4}
              >
                Tasdiqlash
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("tg_user");
                  setOtp("");
                }}
                className="w-full text-center text-sm text-ink-500 hover:text-electric-600"
              >
                Username o&apos;zgartirish
              </button>
            </div>
          ) : null}

          {mode === "otp" ? (
            <div className="space-y-5">
              <p className="text-center text-sm text-ink-600">
                <span className="font-semibold text-ink-900">{normalizedEmail}</span> manziliga 4 xonali kod yuborildi
              </p>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              <Button className="w-full" onClick={() => void verifyEmailCode()} isLoading={loading} disabled={otp.length < 4}>
                Tasdiqlash
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("email");
                  setOtp("");
                }}
                className="w-full text-center text-sm text-ink-500 hover:text-electric-600"
              >
                Emailni o&apos;zgartirish
              </button>
            </div>
          ) : null}

          {TELEGRAM_BOT ? (
            <p className="text-center text-[11px] leading-relaxed text-ink-400">
              Telegram bot:{" "}
              <Link
                href={`https://t.me/${TELEGRAM_BOT.replace(/^@+/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-electric-600"
              >
                {botHandle}
              </Link>
            </p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
