"use client";

import { motion } from "framer-motion";
import { KeyRound, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/lib/api";

const PHONE_REGEX = /^\+998\d{9}$/;

export default function AuthPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  const sendOtp = async () => {
    if (!PHONE_REGEX.test(phone)) {
      push("Telefon +998XXXXXXXXX formatida bo'lsin", "error");
      return;
    }
    setLoading(true);
    try {
      await postJson("/auth/otp/send", { phone });
      push("OTP kod yuborildi!", "success");
      setStep("otp");
    } catch {
      push("OTP yuborishda xatolik yuz berdi", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) {
      push("OTP kodni kiriting", "error");
      return;
    }
    setLoading(true);
    try {
      await postJson("/auth/otp/verify", { phone, otp });
      push("Kirish muvaffaqiyatli!", "success");
      setTimeout(() => (window.location.href = "/"), 1000);
    } catch {
      push("Kod noto'g'ri yoki vaqti tugagan", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas pb-20 md:pb-6">
      <Navigation />
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/10">
              <ShieldCheck className="h-8 w-8 text-gold-500" />
            </div>
            <h1 className="text-2xl font-bold text-text-100">Kirish</h1>
            <p className="mt-2 text-sm text-text-400">
              {step === "phone"
                ? "Telefon raqamingizni kiriting"
                : `${phone} raqamiga kod yuborildi`}
            </p>
          </div>

          {step === "phone" ? (
            <div className="space-y-4">
              <Input
                placeholder="+998901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="h-4 w-4" />}
                label="Telefon raqam"
              />
              <Button className="w-full" onClick={sendOtp} isLoading={loading}>
                OTP yuborish
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                leftIcon={<KeyRound className="h-4 w-4" />}
                label="Tasdiqlash kodi"
                maxLength={6}
              />
              <Button className="w-full" onClick={verifyOtp} isLoading={loading}>
                Tasdiqlash
              </Button>
              <button
                onClick={() => setStep("phone")}
                className="w-full text-center text-sm text-text-400 transition-colors hover:text-gold-500"
              >
                Boshqa raqamga yuborish
              </button>
            </div>
          )}
        </motion.div>
      </div>
      <BottomNav />
    </main>
  );
}
