"use client";

import { MessageCircle, MoreHorizontal, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { getMerchantDashboard, updateMerchantLead } from "@/lib/api";
import { shortId } from "@/lib/short-id";
import { cn } from "@/lib/utils";

const LEAD_STATUSES = [
  { value: "pending", label: "Yangi" },
  { value: "contacted", label: "Bog'lanildi" },
  { value: "visited", label: "Tashrif" },
  { value: "done", label: "Yakun" },
  { value: "cancelled", label: "Bekor" },
] as const;

const LEAD_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  pending: { label: "Yangi", variant: "warning" },
  contacted: { label: "Bog'lanildi", variant: "default" },
  visited: { label: "Tashrif", variant: "default" },
  done: { label: "Yakun", variant: "success" },
  cancelled: { label: "Bekor", variant: "danger" },
};

type LeadRow = {
  id: string;
  customer_phone: string;
  customer_name?: string;
  status: string;
};

type FilterKey = "open" | "done" | "all";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "open", label: "Ochiq" },
  { key: "done", label: "Yakun" },
  { key: "all", label: "Hammasi" },
];

function matchesFilter(lead: LeadRow, filter: FilterKey): boolean {
  const closed = ["done", "cancelled"].includes(lead.status);
  if (filter === "open") return !closed;
  if (filter === "done") return closed;
  return true;
}

export function LeadsPanel() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("open");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const data = await getMerchantDashboard();
    setLeads(data.leads ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        toast.error("Murojaatlarni yuklab bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const counts = useMemo(() => {
    const open = leads.filter((l) => !["done", "cancelled"].includes(l.status)).length;
    const done = leads.filter((l) => ["done", "cancelled"].includes(l.status)).length;
    return { open, done, all: leads.length };
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (!matchesFilter(l, filter)) return false;
      if (!q) return true;
      return (
        l.customer_phone.includes(q) ||
        l.customer_name?.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        shortId(l.id).toLowerCase().includes(q)
      );
    });
  }, [leads, filter, query]);

  const changeStatus = async (leadId: string, status: string) => {
    setBusyId(leadId);
    try {
      const res = await updateMerchantLead(leadId, status);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: res.status } : l)));
      toast.success("Saqlandi");
    } catch {
      toast.error("Yangilab bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="skeleton h-96 rounded-3xl" />;
  }

  return (
    <div className="crm-surface-card overflow-hidden">
      <div className="border-b border-border-subtle p-4 sm:p-5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Murojaat qidirish..."
            className="h-11 w-full rounded-full border border-border-subtle bg-canvas pl-10 pr-4 text-sm text-text-100 placeholder:text-text-400 focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/15"
          />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border-subtle px-4 sm:gap-5 sm:px-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "shrink-0 border-b-2 py-3.5 text-sm font-medium transition",
              filter === tab.key
                ? "border-text-100 text-text-100"
                : "border-transparent text-text-400 hover:text-text-200",
            )}
          >
            {tab.label}
            <span className="ml-1 tabular-nums text-text-400">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      {!leads.length ? (
        <div className="py-20 text-center">
          <UserRound className="mx-auto h-10 w-10 text-text-400/40" />
          <p className="mt-3 font-medium text-text-100">Murojaat yo&apos;q</p>
          <p className="mt-1 text-sm text-text-400">Xarita yoki mahsulotdan murojaatlar shu yerda</p>
        </div>
      ) : !visible.length ? (
        <div className="py-16 text-center text-sm text-text-400">Qidiruv bo&apos;yicha topilmadi</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs font-medium text-text-400">
                  <th className="px-4 py-3.5 sm:px-5">Mijoz</th>
                  <th className="px-4 py-3.5">Telefon</th>
                  <th className="px-4 py-3.5">Holat</th>
                  <th className="w-12 px-4 py-3.5 sm:px-5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const meta = LEAD_META[lead.status] ?? { label: lead.status, variant: "default" as const };
                  const closed = ["done", "cancelled"].includes(lead.status);
                  return (
                    <tr
                      key={lead.id}
                      className={cn(
                        "border-b border-border-subtle/80 transition hover:bg-canvas/50 last:border-b-0",
                        closed && "opacity-70",
                      )}
                    >
                      <td className="px-4 py-4 sm:px-5">
                        <p className="font-semibold text-text-100">{lead.customer_name || "Mijoz"}</p>
                        <p className="mt-0.5 text-xs text-text-400">ID: {shortId(lead.id)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={`tel:${lead.customer_phone}`}
                          className="inline-flex items-center gap-1.5 font-medium text-electric-600 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {lead.customer_phone}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        {closed ? (
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        ) : (
                          <select
                            value={lead.status}
                            disabled={busyId === lead.id}
                            onChange={(e) => void changeStatus(lead.id, e.target.value)}
                            className="h-9 max-w-[9.5rem] rounded-lg border border-border-subtle bg-canvas px-2 text-xs font-medium text-text-100"
                          >
                            {LEAD_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-4 sm:px-5">
                        <a
                          href={`tel:${lead.customer_phone}`}
                          className="inline-flex rounded-lg p-2 text-text-400 hover:bg-canvas hover:text-electric-600"
                          aria-label="Qo'ng'iroq"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border-subtle/80 md:hidden">
            {visible.map((lead) => {
              const meta = LEAD_META[lead.status] ?? { label: lead.status, variant: "default" as const };
              return (
                <li key={lead.id} className="space-y-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-100">{lead.customer_name || "Mijoz"}</p>
                      <a href={`tel:${lead.customer_phone}`} className="text-sm text-electric-600">
                        {lead.customer_phone}
                      </a>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <select
                    value={lead.status}
                    disabled={busyId === lead.id}
                    onChange={(e) => void changeStatus(lead.id, e.target.value)}
                    className="h-10 w-full rounded-xl border border-border-subtle bg-canvas px-3 text-sm"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
