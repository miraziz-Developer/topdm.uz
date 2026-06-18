"use client";

import { AtSign, KeyRound, Phone, Store } from "lucide-react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { BRAND } from "@/components/brand/brand-tokens";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api";
import { getAccessToken, setAccessToken } from "@/lib/auth";
import { safeCrmNextPath } from "@/lib/crm-next-path";

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
const PHONE_REGEX = /^\+998\d{9}$/;
const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "bot";

type LoginMode = "telegram" | "shop_password" | "shop_otp";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const afterLogin = safeCrmNextPath(nextRaw);
  const [mode, setMode] = useState<LoginMode>("shop_password");

  useEffect(() => {
    if (getAccessToken()) {
      router.replace(afterLogin);
    }
  }, [router, afterLogin]);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("+998");
  const [otp, setOtp] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [password, setPassword] = useState("");
  const [shopOtp, setShopOtp] = useState("");
  const [step, setStep] = useState<"username" | "otp">("username");
  const [shopOtpSent, setShopOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = username.trim().replace(/^@+/, "").toLowerCase();
  const botHandle = `@${TELEGRAM_BOT.replace(/^@+/, "")}`;

  const finishLogin = (token: string) => {
    setAccessToken(token);
    window.location.href = afterLogin;
  };

  const sendTelegramCode = async () => {
    if (!USERNAME_REGEX.test(normalized)) {
      setError("Username noto'g'ri");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ dev_otp?: string }>("/auth/send-otp", {
        telegram_username: normalized,
      });
      if (process.env.NODE_ENV === "development" && res.dev_otp) {
        setError(`Dev kod: ${res.dev_otp}`);
      }
      setStep("otp");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyTelegram = async () => {
    setLoading(true);
    setError(null);
    try {
      const phonePayload = phone.trim();
      const response = await postJson<{ token: string; role: string }>("/auth/verify-otp", {
        telegram_username: normalized,
        otp: otp.trim(),
        ...(PHONE_REGEX.test(phonePayload) ? { phone: phonePayload } : {}),
      });
      if (response.role !== "merchant") {
        setError(
          "Merchant topilmadi. Botda /register yoki /start shop_<id> va kontakt ulashing.",
        );
        return;
      }
      finishLogin(response.token);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await postJson<{ token: string; role: string }>("/auth/merchant/login", {
        login_code: loginCode.trim().toUpperCase(),
        password,
      });
      if (response.role !== "merchant") {
        setError("Merchant hisob topilmadi");
        return;
      }
      finishLogin(response.token);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const sendShopOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ dev_otp?: string }>("/auth/merchant/send-otp", {
        login_code: loginCode.trim().toUpperCase(),
      });
      setShopOtpSent(true);
      if (process.env.NODE_ENV === "development" && res.dev_otp) {
        setError(`Dev kod (bot): ${res.dev_otp}`);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyShopOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await postJson<{ token: string; role: string }>("/auth/merchant/verify-otp", {
        login_code: loginCode.trim().toUpperCase(),
        otp: shopOtp.trim(),
      });
      finishLogin(response.token);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const modeBtn = (m: LoginMode, label: string) => (
    <button
      type="button"
      className={cn(
        "rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300",
        mode === m
          ? "bg-gradient-electric text-white shadow-[0_4px_14px_rgba(0,102,255,0.35)]"
          : "bg-elevated/80 text-text-400 hover:bg-elevated hover:text-text-100",
      )}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas lg:flex-row">
      <div className="premium-aurora pointer-events-none absolute inset-0 opacity-80" />

      <div className="relative hidden flex-1 flex-col justify-between p-12 lg:flex">
        <BozorliiiLogo variant="full" size="lg" href={null} badge="CRM" showTagline />
        <div className="max-w-md space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-electric-500/20 bg-electric-500/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-electric-600">
            Premium merchant panel
          </span>
          <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-text-100">
            Do&apos;koningizni{" "}
            <span className="text-gradient-electric">bir joydan</span> boshqaring
          </h2>
          <p className="text-base leading-relaxed text-text-400">
            Buyurtmalar, chat, mahsulotlar va pul yechish — barchasi bir xil brendda, mobil va desktopda.
          </p>
        </div>
        <p className="text-xs text-text-400">© {BRAND.name}</p>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="crm-page-enter premium-glass w-full max-w-md space-y-6 rounded-3xl p-8 sm:p-10">
        <div className="mb-2 lg:hidden">
          <BozorliiiLogo variant="full" size="sm" href={null} badge="CRM" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-electric-500">Kirish</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-100">Hisobingizga kiring</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-400">
            Login va parol — eng tez yo&apos;l. Boshqa usullar pastdagi tablarda.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl bg-elevated/50 p-1.5">
          {modeBtn("shop_password", "Login + parol")}
          {modeBtn("shop_otp", "Do'kon OTP")}
          {modeBtn("telegram", "@username")}
        </div>

        {mode === "shop_password" ? (
          <>
            <Input
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
              placeholder="MUROD-A1B2"
              label="Do'kon login"
              leftIcon={<Store className="h-4 w-4" />}
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Parol"
              leftIcon={<KeyRound className="h-4 w-4" />}
            />
            <Button className="w-full" onClick={loginWithPassword} disabled={loading}>
              Kirish
            </Button>
          </>
        ) : null}

        {mode === "shop_otp" ? (
          <>
            <Input
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
              placeholder="MUROD-A1B2"
              label="Do'kon login"
              leftIcon={<Store className="h-4 w-4" />}
            />
            {!shopOtpSent ? (
              <Button className="w-full" onClick={sendShopOtp} disabled={loading}>
                Kod yuborish (Telegram bot)
              </Button>
            ) : (
              <>
                <Input
                  value={shopOtp}
                  onChange={(e) => setShopOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  label="6 xonali kod"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                />
                <Button className="w-full" onClick={verifyShopOtp} disabled={loading}>
                  Tasdiqlash
                </Button>
              </>
            )}
          </>
        ) : null}

        {mode === "telegram" ? (
          step === "username" ? (
            <>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                label="Telegram @username"
                leftIcon={<AtSign className="h-4 w-4" />}
              />
              <p className="text-xs text-text-400">
                Avval{" "}
                <Link
                  href={`https://t.me/${TELEGRAM_BOT.replace(/^@+/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-electric-600 underline"
                >
                  {botHandle}
                </Link>{" "}
                da <strong>/register</strong> yoki <strong>/start</strong>
              </p>
              <Button className="w-full" onClick={sendTelegramCode} disabled={loading}>
                Kod yuborish
              </Button>
            </>
          ) : (
            <>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                label="6 xonali kod"
                leftIcon={<KeyRound className="h-4 w-4" />}
              />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                label="Do'kon telefoni (+998…)"
                leftIcon={<Phone className="h-4 w-4" />}
              />
              <Button className="w-full" onClick={verifyTelegram} disabled={loading}>
                Kirish
              </Button>
              <button type="button" onClick={() => setStep("username")} className="text-sm text-text-400">
                Orqaga
              </button>
            </>
          )
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-red/20 bg-red/5 px-3 py-2 text-sm text-red">{error}</p>
        ) : null}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas">
          <p className="text-sm text-text-400">Yuklanmoqda…</p>
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function extractError(err: unknown): string {
  if (!(err instanceof Error)) return "Xatolik";
  const raw = err.message;
  if (raw.includes("bot_not_started") || raw.includes("/start")) {
    const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@+/, "") ?? "bot";
    return `Iltimos, avval @${bot} ni ochib /register bosing`;
  }
  const match = raw.match(/— (.+)$/);
  return match?.[1] ?? (raw.replace(/^API error: \d+ — ?/, "") || "Xatolik");
}
