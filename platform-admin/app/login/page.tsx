"use client";

import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      {/* Navy B icon */}
      <div
        className="flex shrink-0 items-center justify-center rounded-xl font-black text-white"
        aria-hidden="true"
        style={{ width: 40, height: 40, fontSize: 22, background: "#003366", boxShadow: "0 2px 12px rgba(0,51,102,0.35)" }}
      >
        B
      </div>
      {/* Wordmark */}
      <span className="inline-flex items-baseline font-black leading-none select-none" style={{ fontSize: 22 }}>
        <span className="text-[#0a0a0a]">BoZor</span>
        <span className="relative text-[#0a0a0a]">
          <span className="absolute left-0 right-0 -top-[1px] flex justify-center gap-[2.5px]">
            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: "#003366" }} />
            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: "#f59e0b" }} />
            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: "#f97316" }} />
          </span>
          lI
        </span>
        <span className="text-[#0a0a0a]">II</span>
        <span className="ml-1.5 inline-flex items-center rounded-md border text-[10px] font-bold tracking-wide px-1.5 py-0.5" style={{ borderColor: "#e2e8f0", background: "#f8fafc", color: "#64748b" }}>
          ADMIN
        </span>
      </span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? "Login xato");
      }
      toast.success("Xush kelibsiz!");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login xato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLockup className="mb-4" />
          <p className="mt-3 text-sm text-muted-foreground">
            Bozorliii biznes boshqaruv paneli — faqat platforma egasi uchun
          </p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Login
              </label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Parol
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Kirish..." : "CRM ga kirish"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
