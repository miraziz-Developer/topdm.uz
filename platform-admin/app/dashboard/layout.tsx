"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { BrandPageLoader } from "@/components/brand-page-loader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then(async (res) => {
        if (!res.ok) throw new Error("unauth");
        const data = (await res.json()) as { username?: string };
        setUsername(data.username ?? "admin");
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <BrandPageLoader />;
  if (!username) return null;

  return <AdminShell username={username}>{children}</AdminShell>;
}
