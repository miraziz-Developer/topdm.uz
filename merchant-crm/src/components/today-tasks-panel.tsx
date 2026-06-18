"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getMerchantToday, type TodayTask } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-text-400/50",
};

const TYPE_LABEL: Record<string, string> = {
  order: "Buyurtma",
  chat: "Chat",
  lead: "Murojaat",
  system: "Tizim",
  catalog: "Katalog",
};

type Props = {
  initialData?: Awaited<ReturnType<typeof getMerchantToday>> | null;
};

export function TodayTasksPanel({ initialData = null }: Props) {
  const [tasks, setTasks] = useState<TodayTask[]>(initialData?.tasks ?? []);
  const [counts, setCounts] = useState<Record<string, number>>(initialData?.counts ?? {});
  const [alerts, setAlerts] = useState(initialData?.alerts ?? []);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) {
      setTasks(initialData.tasks);
      setCounts(initialData.counts);
      setAlerts(initialData.alerts);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getMerchantToday();
        if (cancelled) return;
        setTasks(data.tasks);
        setCounts(data.counts);
        setAlerts(data.alerts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  if (loading) {
    return <div className="skeleton h-64 rounded-2xl" />;
  }

  return (
    <section className="crm-surface-card flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Bugun</p>
          <h2 className="text-base font-bold text-text-100">Vazifalar</h2>
        </div>
        <div className="flex gap-3 text-xs text-text-400">
          <span>
            <strong className="text-text-100">{counts.pending_orders ?? 0}</strong> buyurtma
          </span>
          <span>
            <strong className="text-text-100">{counts.chats_waiting ?? 0}</strong> suhbat
          </span>
          <span>
            <strong className="text-text-100">{counts.open_leads ?? 0}</strong> murojaat
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/80" />
          <p className="mt-3 font-medium text-text-100">Hammasi joyida</p>
          <p className="mt-1 text-sm text-text-400">Yangi vazifa paydo bo&apos;lsa shu yerda chiqadi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs font-medium text-text-400">
                <th className="px-4 py-2.5 sm:px-5">Vazifa</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Turi</th>
                <th className="w-10 px-4 py-2.5 sm:px-5" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={`${task.type}-${task.id}`}
                  className="border-b border-border-subtle/80 transition last:border-b-0 hover:bg-canvas/50"
                >
                  <td className="px-4 py-3 sm:px-5">
                    <Link href={task.href} className="group flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.low,
                        )}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-text-100 group-hover:text-electric-600">{task.title}</p>
                        <p className="mt-0.5 truncate text-xs text-text-400">{task.subtitle}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-xs font-medium text-text-400 sm:table-cell">
                    {TYPE_LABEL[task.type] ?? task.type}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <Link
                      href={task.href}
                      className="inline-flex rounded-lg p-2 text-text-400 hover:bg-canvas hover:text-electric-600"
                      aria-label="Ochish"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alerts.length > 0 ? (
        <div className="mt-auto border-t border-border-subtle bg-canvas/40 px-4 py-3 sm:px-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-400">So&apos;nggi signal</p>
          <ul className="space-y-2">
            {alerts.slice(0, 2).map((a, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric-500" />
                <div>
                  <p className="font-medium text-text-100">{a.title}</p>
                  <p className="text-text-400">{a.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
