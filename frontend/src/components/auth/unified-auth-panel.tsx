"use client";

import { motion } from "framer-motion";
import { Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useToast } from "@/components/ui/toast";
import { authGoogle, authApple, sendEmailOtp, verifyEmailOtp } from "@/lib/api";
import { ApiError } from "@/lib/http-client";
import { authMetaFromTokenResponse, establishSession, setClientSession } from "@/lib/auth";
import type { AuthTokenResponse } from "@/lib/api";
import { useUserStore } from "@/stores/user-store";
import { cn } from "@/lib/utils";
import { MARKET } from "@/components/brand/premium-market-ui";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type AuthMode = "primary" | "email" | "otp";

type UnifiedAuthPanelProps = {
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
              shape?: string;
              locale?: string;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string };
          user?: { name?: { firstName?: string; lastName?: string }; email?: string };
        }>;
      };
    };
  }
}

export function UnifiedAuthPanel({ onSuccess, redirectTo = "/profile", className }: UnifiedAuthPanelProps) {
  const router = useRouter();
  const { push } = useToast();
  const refreshProfile = useUserStore((state) => state.refresh);

  const [mode, setMode] = useState<AuthMode>("primary");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const normalizedEmail = email.trim().toLowerCase();

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

  // Google Sign In SDK yuklash
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const scriptId = "google-gsi-script";
    if (document.getElementById(scriptId)) {
      if (window.google?.accounts?.id) {
        setGoogleReady(true);
      }
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, []);

  // Google tugmasini render qilish
  useEffect(() => {
    if (!googleReady || !googleBtnRef.current || !GOOGLE_CLIENT_ID) return;
    window.google?.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setLoading(true);
        try {
          const res = await authGoogle(response.credential);
          await finishLogin(res);
        } catch (err) {
          const message = err instanceof ApiError ? err.message : "Google orqali kirish muvaffaqiyatsiz";
          push(message, "error");
        } finally {
          setLoading(false);
        }
      },
      cancel_on_tap_outside: true,
    });
    window.google?.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: googleBtnRef.current.offsetWidth || 360,
      text: "signin_with",
      shape: "rectangular",
      locale: "uz",
    });
  }, [googleReady, finishLogin, push]);

  // Apple Sign In
  const handleAppleSignIn = useCallback(async () => {
    const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    if (!appleClientId) {
      push("Apple Sign In sozlanmagan", "error");
      return;
    }
    setLoading(true);
    try {
      // Apple JS SDK yuklash
      if (!window.AppleID) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Apple SDK yuklanmadi"));
          document.head.appendChild(script);
        });
      }
      window.AppleID?.auth.init({
        clientId: appleClientId,
        scope: "name email",
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const data = await window.AppleID?.auth.signIn();
      if (!data?.authorization?.id_token) throw new Error("Apple token olinmadi");
      const userName = data.user?.name
        ? `${data.user.name.firstName ?? ""} ${data.user.name.lastName ?? ""}`.trim()
        : undefined;
      const res = await authApple({
        identity_token: data.authorization.id_token,
        user: { name: userName, email: data.user?.email },
      });
      await finishLogin(res);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && (err as { error: string }).error === "popup_closed_by_user") {
        // Foydalanuvchi o'zi yopdi — xato ko'rsatmaymiz
        return;
      }
      const message = err instanceof ApiError ? err.message : "Apple orqali kirish muvaffaqiyatsiz";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  }, [finishLogin, push]);

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
        className={cn(MARKET.authCard, "overflow-hidden rounded-3xl shadow-elevated", className)}
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
          <p className="mt-2 text-sm text-white/85">Google, Apple yoki email — xavfsiz va tez</p>
        </motion.div>

        <div className="space-y-4 p-6">
          {mode === "primary" ? (
            <>
              {/* Google Sign In */}
              {GOOGLE_CLIENT_ID ? (
                <div className="space-y-2">
                  <p className="text-center text-xs font-semibold uppercase tracking-widest text-ink-500">
                    Tezkor kirish
                  </p>
                  <div
                    ref={googleBtnRef}
                    className="flex w-full items-center justify-center overflow-hidden rounded-xl"
                    style={{ minHeight: 44 }}
                  />
                  {!googleReady && (
                    <Button type="button" variant="secondary" className="w-full" disabled>
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Google yuklanmoqda…
                    </Button>
                  )}
                </div>
              ) : null}

              {/* Apple Sign In */}
              {process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full bg-black text-white hover:bg-gray-900"
                  onClick={() => void handleAppleSignIn()}
                  isLoading={loading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Apple orqali kirish
                </Button>
              ) : null}

              {(GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID) ? (
                <div className="relative flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border-subtle" />
                  <span className="text-xs font-medium text-ink-400">yoki</span>
                  <div className="h-px flex-1 bg-border-subtle" />
                </div>
              ) : null}

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
                Orqaga qaytish
              </button>
            </form>
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
        </div>
      </motion.div>
    </motion.div>
  );
}
