"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { StatusBadge } from "@/components/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { getSupportTickets, updateTicket } from "@/lib/admin-api";
import { cn, formatDate } from "@/lib/utils";

const TABS = [
  { value: "open", label: "Ochiq" },
  { value: "in_progress", label: "Jarayonda" },
  { value: "resolved", label: "Hal qilingan" },
  { value: "", label: "Barchasi" },
];

const SUPPORT_CATEGORY: Record<string, string> = {
  problem: "Muammo",
  suggestion: "Taklif",
  question: "Savol",
};

function ticketAge(iso?: string | null) {
  if (!iso) return "";
  const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hrs < 24) return `${hrs}s oldin`;
  return `${Math.floor(hrs / 24)} kun oldin`;
}

export default function SupportPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("open");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets", tab],
    queryFn: () => getSupportTickets(tab || undefined),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, admin_note }: { id: string; status?: string; admin_note?: string }) =>
      updateTicket(id, { status, admin_note }),
    onSuccess: () => {
      toast.success("Murojaat yangilandi");
      void qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <PageLoader rows={3} />;

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === t.value ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="admin-card">
          <EmptyState
            title={tab === "open" ? "Ochiq murojaat yo'q 🎉" : "Murojaat topilmadi"}
            description={tab === "open" ? "Yangi murojaatlar shu yerda ko'rinadi" : undefined}
          />
        </div>
      ) : (
        items.map((t) => (
          <div key={t.id} className="admin-card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.shop_name ?? "Do'kon"}</p>
                <p className="text-xs text-muted-foreground">
                  {t.category ? SUPPORT_CATEGORY[t.category] ?? t.category : "—"} · {t.merchant_phone ?? "—"} ·{" "}
                  {formatDate(t.created_at)}
                  {t.created_at ? <span className="ml-2 text-amber-400">({ticketAge(t.created_at)})</span> : null}
                </p>
              </div>
              <StatusBadge status={t.status} kind="ticket" />
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{t.message}</p>
            <Textarea
              placeholder="Admin izohi"
              value={notes[t.id] ?? t.admin_note ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => updateMut.mutate({ id: t.id, status: "resolved", admin_note: notes[t.id] })}
              >
                Hal qilindi
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => updateMut.mutate({ id: t.id, status: "in_progress", admin_note: notes[t.id] })}
              >
                Jarayonda
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: t.id, admin_note: notes[t.id] })}>
                Izohni saqlash
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
