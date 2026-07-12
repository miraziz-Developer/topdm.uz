"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Radio } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
// EmptyState = { title, description? }
// PageLoader = { rows? }
import {
  getBusinessRules,
  upsertBusinessRule,
  deleteBusinessRule,
  sendBroadcast,
  type BusinessRule,
} from "@/lib/admin-api";

export default function SettingsPage() {
  const qc = useQueryClient();

  // --- Business Rules ---
  const rulesQ = useQuery({ queryKey: ["business-rules"], queryFn: getBusinessRules });
  const [editRule, setEditRule] = useState<Partial<BusinessRule> | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const upsertMut = useMutation({
    mutationFn: upsertBusinessRule,
    onSuccess: () => {
      toast.success("Qoida saqlandi");
      setEditRule(null);
      setNewKey("");
      setNewValue("");
      setNewDesc("");
      void qc.invalidateQueries({ queryKey: ["business-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBusinessRule,
    onSuccess: () => {
      toast.success("Qoida o'chirildi");
      void qc.invalidateQueries({ queryKey: ["business-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Broadcast ---
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [bcTarget, setBcTarget] = useState<"all" | "verified" | "blocked">("all");

  const broadcastMut = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (data) => {
      toast.success(`Xabar yuborildi: ${data.sent} ta do'kon`);
      setBcTitle("");
      setBcBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rulesQ.isLoading) return <PageLoader rows={4} />;

  const rules = rulesQ.data?.items ?? [];

  return (
    <div className="space-y-8">
      {/* ---- Business Rules ---- */}
      <section className="admin-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Biznes qoidalar</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditRule({ scope: "global", is_active: true })}
          >
            <Plus className="h-4 w-4 mr-1" /> Yangi qoida
          </Button>
        </div>

        {editRule !== null && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <h3 className="text-sm font-medium">
              {editRule.id ? "Qoidani tahrirlash" : "Yangi qoida"}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="rule_key (masalan: platform_product_markup_pct)"
                value={editRule.rule_key ?? newKey}
                onChange={(e) =>
                  editRule.id
                    ? setEditRule({ ...editRule, rule_key: e.target.value })
                    : setNewKey(e.target.value)
                }
              />
              <Input
                placeholder="rule_value (masalan: 0.15)"
                value={editRule.rule_value ?? newValue}
                onChange={(e) =>
                  editRule.id
                    ? setEditRule({ ...editRule, rule_value: e.target.value })
                    : setNewValue(e.target.value)
                }
              />
            </div>
            <Input
              placeholder="Tavsif (ixtiyoriy)"
              value={editRule.description ?? newDesc}
              onChange={(e) =>
                editRule.id
                  ? setEditRule({ ...editRule, description: e.target.value })
                  : setNewDesc(e.target.value)
              }
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  upsertMut.mutate({
                    rule_key: editRule.id ? (editRule.rule_key ?? "") : newKey,
                    rule_value: editRule.id ? (editRule.rule_value ?? "") : newValue,
                    scope: editRule.scope ?? "global",
                    is_active: editRule.is_active ?? true,
                    description: editRule.id ? editRule.description : newDesc || null,
                  })
                }
                disabled={upsertMut.isPending}
              >
                Saqlash
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditRule(null)}>
                Bekor
              </Button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <EmptyState title="Hali qoida yo'q" description="Yangi qoida qo'shing" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kalit</th>
                  <th>Qiymat</th>
                  <th>Scope</th>
                  <th>Holat</th>
                  <th>Tavsif</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.rule_key}</td>
                    <td className="font-mono text-xs">{r.rule_value}</td>
                    <td className="text-xs text-muted-foreground">{r.scope}</td>
                    <td>
                      <span
                        className={`admin-badge ${r.is_active ? "admin-badge-success" : "admin-badge-pending"}`}
                      >
                        {r.is_active ? "Faol" : "Nofaol"}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">{r.description ?? "—"}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditRule({ ...r })}
                        >
                          Tahrir
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (confirm("O'chirishni tasdiqlaysizmi?")) {
                              deleteMut.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Broadcast ---- */}
      <section className="admin-card space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Broadcast xabar</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Barcha yoki tanlangan do&apos;konlarga push xabar yuborish.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Sarlavha"
            value={bcTitle}
            onChange={(e) => setBcTitle(e.target.value)}
          />
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={bcTarget}
            onChange={(e) => setBcTarget(e.target.value as "all" | "verified" | "blocked")}
          >
            <option value="all">Barcha do&apos;konlar</option>
            <option value="verified">Faqat tasdiqlangan</option>
            <option value="blocked">Faqat bloklangan</option>
          </select>
        </div>
        <textarea
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[100px]"
          placeholder="Xabar matni..."
          value={bcBody}
          onChange={(e) => setBcBody(e.target.value)}
        />
        <Button
          onClick={() =>
            broadcastMut.mutate({ title: bcTitle, body: bcBody, target: bcTarget })
          }
          disabled={!bcTitle.trim() || !bcBody.trim() || broadcastMut.isPending}
        >
          <Radio className="h-4 w-4 mr-2" />
          Yuborish
        </Button>
      </section>
    </div>
  );
}
