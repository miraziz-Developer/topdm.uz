import { cn } from "@/lib/utils";

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Kutilmoqda", cls: "admin-badge-pending" },
  confirmed: { label: "Tasdiqlangan", cls: "admin-badge-ok" },
  delivered: { label: "Yetkazilgan", cls: "admin-badge-ok" },
  completed: { label: "Yakunlangan", cls: "admin-badge-ok" },
  cancelled: { label: "Bekor", cls: "admin-badge-danger" },
};

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  held_in_escrow: { label: "Escrowda", cls: "admin-badge-pending" },
  released_to_merchant: { label: "Yetkazilgan", cls: "admin-badge-ok" },
  refunded: { label: "Qaytarilgan", cls: "admin-badge-danger" },
  paid: { label: "To'langan", cls: "admin-badge-ok" },
  success: { label: "To'langan", cls: "admin-badge-ok" },
};

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Ochiq", cls: "admin-badge-pending" },
  in_progress: { label: "Jarayonda", cls: "admin-badge-pending" },
  resolved: { label: "Hal qilindi", cls: "admin-badge-ok" },
  closed: { label: "Yopilgan", cls: "admin-badge-danger" },
};

export function StatusBadge({
  status,
  kind = "order",
}: {
  status: string;
  kind?: "order" | "payment" | "ticket" | "generic";
}) {
  const map = kind === "payment" ? PAYMENT_STATUS : kind === "ticket" ? TICKET_STATUS : ORDER_STATUS;
  const cfg = map[status] ?? { label: status, cls: "admin-badge-pending" };
  return <span className={cn("admin-badge", cfg.cls)}>{cfg.label}</span>;
}
