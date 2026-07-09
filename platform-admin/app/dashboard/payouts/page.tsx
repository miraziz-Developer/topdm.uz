"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { StatusBadge } from "@/components/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/card";
import { completePayout, getIncomingPayments, getPendingPayouts, rejectPayout } from "@/lib/admin-api";
import { cn, formatDate, formatUzs } from "@/lib/utils";

const INCOMING_STATUS = [
  { value: "", label: "Barchasi" },
  { value: "held_in_escrow", label: "Escrowda" },
  { value: "released_to_merchant", label: "Yetkazilgan" },
  { value: "refunded", label: "Qaytarilgan" },
];

export default function PayoutsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [days, setDays] = useState(30);
  const [payStatus, setPayStatus] = useState("");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const incomingQ = useQuery({
    queryKey: ["incoming-payments", days, payStatus],
    queryFn: () => getIncomingPayments(days, payStatus || undefined),
    enabled: tab === "incoming",
  });

  const outgoingQ = useQuery({
    queryKey: ["pending-payouts"],
    queryFn: getPendingPayouts,
    enabled: tab === "outgoing",
  });

  const completeMut = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref?: string }) => completePayout(id, ref),
    onSuccess: () => {
      toast.success("To'lov tasdiqlandi");
      void qc.invalidateQueries({ queryKey: ["pending-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => rejectPayout(id, note),
    onSuccess: () => {
      toast.success("To'lov bekor qilindi");
      void qc.invalidateQueries({ queryKey: ["pending-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incoming = incomingQ.data;
  const outgoing = outgoingQ.data?.items ?? [];
  const isLoading = tab === "incoming" ? incomingQ.isLoading : outgoingQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("incoming")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
            tab === "incoming" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowDownLeft className="h-4 w-4" />
          Kirim — bizga to&apos;laganlar
        </button>
        <button
          type="button"
          onClick={() => setTab("outgoing")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
            tab === "outgoing" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
          Chiqim — do&apos;konlarga
        </button>
      </div>

      {tab === "incoming" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={`Kirim (${days} kun)`}
              value={formatUzs(incoming?.summary.total_incoming_uzs ?? 0)}
              icon={<CreditCard className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              label="To'lovlar soni"
              value={incoming?.summary.payments ?? 0}
              icon={<ArrowDownLeft className="h-5 w-5" />}
              tone="green"
            />
            <StatCard
              label="Platforma komissiyasi"
              value={formatUzs(incoming?.summary.platform_commission_uzs ?? 0)}
              icon={<CreditCard className="h-5 w-5" />}
              tone="purple"
            />
          </div>

          <div className="admin-card flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted-foreground">Davr:</label>
            <select
              className="h-9 rounded-lg border border-input bg-secondary/50 px-3 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 kun</option>
              <option value={30}>30 kun</option>
              <option value={90}>90 kun</option>
            </select>
            <label className="text-sm text-muted-foreground">Holat:</label>
            <select
              className="h-9 rounded-lg border border-input bg-secondary/50 px-3 text-sm"
              value={payStatus}
              onChange={(e) => setPayStatus(e.target.value)}
            >
              {INCOMING_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-card overflow-x-auto">
            <h2 className="mb-4 text-base font-semibold">Mijoz to&apos;lovlari ({incoming?.items.length ?? 0})</h2>
            {isLoading ? (
              <PageLoader rows={4} />
            ) : (incoming?.items ?? []).length === 0 ? (
              <EmptyState title="To'lov yo'q" description="Tanlangan davr yoki filtr bo'yicha ma'lumot topilmadi" />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mijoz</th>
                    <th>Do&apos;kon</th>
                    <th>Summa</th>
                    <th>Komissiya</th>
                    <th>Provider</th>
                    <th>Reference</th>
                    <th>Holat</th>
                    <th>Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {(incoming?.items ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>{p.customer_phone ?? "—"}</td>
                      <td>{p.shop_name ?? (p.shop_id ? `${p.shop_id.slice(0, 8)}…` : "—")}</td>
                      <td className="font-semibold">{formatUzs(p.amount_uzs)}</td>
                      <td className="text-muted-foreground">
                        {p.platform_commission_uzs != null ? formatUzs(p.platform_commission_uzs) : "—"}
                      </td>
                      <td className="uppercase">{p.provider ?? "click"}</td>
                      <td className="font-mono text-xs">{p.reference ?? "—"}</td>
                      <td>
                        <StatusBadge status={p.status} kind="payment" />
                      </td>
                      <td className="text-muted-foreground">{formatDate(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {outgoingQ.data?.total_pending_uzs != null && outgoing.length > 0 ? (
            <StatCard
              label="Jami pending payout"
              value={formatUzs(outgoingQ.data.total_pending_uzs)}
              icon={<ArrowUpRight className="h-5 w-5" />}
              tone="amber"
            />
          ) : null}
          <div className="admin-card overflow-x-auto">
            <h2 className="mb-4 text-base font-semibold">Do&apos;kon payout so&apos;rovlari ({outgoing.length})</h2>
            {isLoading ? (
              <PageLoader rows={4} />
            ) : outgoing.length === 0 ? (
              <EmptyState title="Pending payout yo'q" />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Do&apos;kon</th>
                    <th>Summa</th>
                    <th>Manzil</th>
                    <th>Vaqt</th>
                    <th>Reference</th>
                    <th>Rad sababi</th>
                    <th>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {outgoing.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <p className="font-medium">{p.shop_name ?? "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.shop_id.slice(0, 8)}…</p>
                      </td>
                      <td className="font-semibold">{formatUzs(p.amount_uzs)}</td>
                      <td>{p.destination ?? "—"}</td>
                      <td className="text-muted-foreground">{formatDate(p.created_at)}</td>
                      <td>
                        <Input
                          className="h-8 w-28"
                          placeholder="ref"
                          value={refs[p.id] ?? ""}
                          onChange={(e) => setRefs((r) => ({ ...r, [p.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <Input
                          className="h-8 w-32"
                          placeholder="sabab"
                          value={rejectNotes[p.id] ?? ""}
                          onChange={(e) => setRejectNotes((r) => ({ ...r, [p.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => completeMut.mutate({ id: p.id, ref: refs[p.id] })}
                          >
                            To&apos;landi
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => rejectMut.mutate({ id: p.id, note: rejectNotes[p.id] })}
                          >
                            Bekor
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
