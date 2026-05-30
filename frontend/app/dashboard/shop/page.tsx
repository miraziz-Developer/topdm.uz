"use client";

import { motion } from "framer-motion";
import { BarChart3, Eye, Package, Phone, RefreshCw, ShoppingBag, Sparkles, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getShopDashboard } from "@/lib/api";
import { formatNumber, timeAgo } from "@/lib/utils";

interface DashboardData {
  stats: {
    total_products: number;
    total_leads: number;
    total_views: number;
    total_visits: number;
  };
  leads: Array<{
    id: string;
    customer_phone: string;
    customer_name: string | null;
    status: string;
    ref_token: string | null;
  }>;
}

const statusColors: Record<string, string> = {
  new: "bg-gold-500/20 text-gold-400 border-gold-500/30",
  pending: "bg-gold-500/20 text-gold-400 border-gold-500/30",
  contacted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  visited: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  new: "Yangi",
  pending: "Kutilmoqda",
  contacted: "Bog'landi",
  visited: "Keldi",
  done: "Tugadi",
  cancelled: "Bekor",
};

export default function DashboardPage() {
  const [shopId, setShopId] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "leads">("overview");

  const loadDashboard = async (id?: string) => {
    const target = id || shopId;
    if (!target) return;
    setLoading(true);
    setError("");
    try {
      const result = await getShopDashboard(target);
      setData(result as DashboardData);
    } catch {
      setError("Dashboard yuklanmadi. Shop ID ni tekshiring.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!data || !shopId) return;
    const interval = setInterval(() => loadDashboard(), 30000);
    return () => clearInterval(interval);
  }, [data, shopId]);

  const stats = [
    { label: "Ko'rishlar", value: data?.stats.total_views ?? 0, icon: Eye, color: "text-gold-500", bg: "bg-gold-500/10" },
    { label: "So'rovlar", value: data?.stats.total_leads ?? 0, icon: Phone, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Tashriflar", value: data?.stats.total_visits ?? 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Tovarlar", value: data?.stats.total_products ?? 0, icon: Package, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-6">
      <Navigation />
      <div className="page-content-top mx-auto max-w-6xl px-4 pb-6 sm:px-5">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-100">Do'kon paneli</h1>
            <p className="mt-1 text-text-400">Statistikalar va so'rovlarni kuzating</p>
          </div>
          {data && (
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/banners">
                <Button variant="secondary" size="sm" leftIcon={<Sparkles className="h-4 w-4" />}>
                  Premium reklama
                </Button>
              </Link>
              <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => loadDashboard()} isLoading={loading}>
                Yangilash
              </Button>
            </div>
          )}
        </div>

        {/* Shop ID input */}
        {!data && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-4 py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gold-500/10">
              <BarChart3 className="h-10 w-10 text-gold-500" />
            </div>
            <h2 className="text-xl font-semibold text-text-100">Do'kon paneliga kirish</h2>
            <p className="text-sm text-text-400">Do'koningiz ID sini kiriting</p>
            <Input
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              placeholder="Shop ID kiriting"
              error={error || undefined}
            />
            <Button className="w-full" onClick={() => loadDashboard()} isLoading={loading}>
              Kiritish
            </Button>
          </motion.div>
        )}

        {/* Dashboard content */}
        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-2xl border border-border-subtle bg-surface p-5 transition-all hover:border-border-strong hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-4 price-mono text-3xl font-bold text-text-100">{formatNumber(stat.value)}</div>
                  <div className="mt-1 text-sm text-text-400">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-border-subtle bg-surface p-1">
              {(["overview", "leads"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-gold-500 text-canvas shadow-sm"
                      : "text-text-400 hover:text-text-100"
                  }`}
                >
                  {tab === "overview" ? "📊 Umumiy" : "📋 So'rovlar"}
                </button>
              ))}
            </div>

            {/* Leads Table */}
            {activeTab === "leads" && (
              <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div className="border-b border-border-subtle px-5 py-4">
                  <h3 className="font-semibold text-text-100">Oxirgi so'rovlar</h3>
                </div>
                {data.leads.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <ShoppingBag className="mb-4 h-12 w-12 text-text-400" />
                    <p className="text-text-400">Hozircha so'rovlar mavjud emas</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {data.leads.map((lead, i) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-elevated"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10 text-sm font-semibold text-gold-500">
                            {(lead.customer_name || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-text-100">{lead.customer_name || "Noma'lum"}</div>
                            <div className="text-sm text-text-400">{lead.customer_phone}</div>
                          </div>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColors[lead.status] || statusColors.new}`}>
                          {statusLabels[lead.status] || lead.status}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Overview - simple stats summary */}
            {activeTab === "overview" && (
              <div className="rounded-2xl border border-border-subtle bg-surface p-6">
                <h3 className="mb-4 font-semibold text-text-100">Qisqacha ma'lumot</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-elevated p-4">
                    <span className="text-text-300">Jami tovarlar</span>
                    <span className="price-mono font-semibold text-text-100">{data.stats.total_products}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-elevated p-4">
                    <span className="text-text-300">Jami so'rovlar</span>
                    <span className="price-mono font-semibold text-emerald-400">{data.stats.total_leads}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-elevated p-4">
                    <span className="text-text-300">Jami ko'rishlar</span>
                    <span className="price-mono font-semibold text-gold-500">{formatNumber(data.stats.total_views)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-elevated p-4">
                    <span className="text-text-300">Jami tashriflar</span>
                    <span className="price-mono font-semibold text-blue-400">{formatNumber(data.stats.total_visits)}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
