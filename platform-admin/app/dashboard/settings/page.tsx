"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio, Settings2, Percent, DollarSign, ShieldAlert, ShoppingCart, Truck, ToggleLeft, ToggleRight, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import {
  getBusinessRules,
  upsertBusinessRule,
  deleteBusinessRule,
  sendBroadcast,
  type BusinessRule,
} from "@/lib/admin-api";

// Tayyor platform sozlamalari — faqat real keraklilar
const PRESET_CONFIGS = [
  {
    rule_key: "platform_product_markup_pct",
    label: "Platforma foydasi (narx ustamasi)",
    description: "Har bir mahsulot narxiga qo'shiladigan foiz — bu bizning foydamiz. Do'konchi o'z narxini kiritadi, mijoz shu foiz qo'shilgan narxni to'laydi. Masalan: 20 = 20%.",
    icon: Percent,
    unit: "%",
    type: "float",
    defaultValue: "15",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    rule_key: "merchant_debt_block_threshold_uzs",
    label: "Qarzdorlik bloklash chegarasi",
    description: "Do'kon qancha qarzga kirsa avtomatik bloklash. UZS da.",
    icon: ShieldAlert,
    unit: "UZS",
    type: "int",
    defaultValue: "500000",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  {
    rule_key: "min_order_amount_uzs",
    label: "Minimal buyurtma summasi",
    description: "Bundan kam summa bo'lsa buyurtma qabul qilinmaydi. UZS da.",
    icon: ShoppingCart,
    unit: "UZS",
    type: "int",
    defaultValue: "10000",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
];

function PresetCard({
  config,
  currentRule,
  onSave,
  onToggle,
  isSaving,
}: {
  config: typeof PRESET_CONFIGS[0];
  currentRule?: BusinessRule;
  onSave: (key: string, value: string) => void;
  onToggle: (rule: BusinessRule, active: boolean) => void;
  isSaving: boolean;
}) {
  const Icon = config.icon;
  const currentValue = currentRule?.rule_value ?? config.defaultValue;
  const isActive = currentRule ? currentRule.is_active : false;
  const exists = !!currentRule;

  const [localValue, setLocalValue] = useState(currentValue);

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-5 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-background/50">
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{config.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        </div>
        {exists && (
          <button
            onClick={() => onToggle(currentRule!, !isActive)}
            className="flex-shrink-0 mt-0.5"
            title={isActive ? "O'chirish" : "Yoqish"}
          >
            {isActive ? (
              <ToggleRight className="h-7 w-7 text-green-400" />
            ) : (
              <ToggleLeft className="h-7 w-7 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className="pr-14 font-mono text-sm"
            step={config.type === "float" ? "0.1" : "1000"}
            min="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
            {config.unit}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => onSave(config.rule_key, localValue)}
          disabled={isSaving}
          className="flex-shrink-0"
        >
          {exists ? "Saqlash" : "Qo'shish"}
        </Button>
      </div>

      {exists && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isActive ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"
            }`}
          >
            {isActive ? "Faol" : "Nofaol"}
          </span>
          <span className="font-mono opacity-60">{config.rule_key}</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();

  const rulesQ = useQuery({
    queryKey: ["business-rules"],
    queryFn: getBusinessRules,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const upsertMut = useMutation({
    mutationFn: upsertBusinessRule,
    onSuccess: () => {
      toast.success("Sozlama saqlandi");
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

  // Custom qoida
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Broadcast
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
  const presetKeys = PRESET_CONFIGS.map((c) => c.rule_key);
  const customRules = rules.filter((r) => !presetKeys.includes(r.rule_key));

  const getRuleByKey = (key: string) => rules.find((r) => r.rule_key === key);

  const handleSave = (key: string, value: string) => {
    upsertMut.mutate({
      rule_key: key,
      rule_value: value,
      scope: "global",
      is_active: true,
    });
  };

  const handleToggle = (rule: BusinessRule, active: boolean) => {
    upsertMut.mutate({
      rule_key: rule.rule_key,
      rule_value: rule.rule_value,
      scope: rule.scope ?? "global",
      is_active: active,
      description: rule.description ?? undefined,
    });
  };

  return (
    <div className="space-y-8">
      {/* ---- Platform Sozlamalari ---- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Platform Sozlamalari</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Raqamni o&apos;zgartiring va &quot;Saqlash&quot; tugmasini bosing. O&apos;zgarishlar 30 soniyada barcha narxlarga ta&apos;sir qiladi.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {PRESET_CONFIGS.map((config) => (
            <PresetCard
              key={config.rule_key}
              config={config}
              currentRule={getRuleByKey(config.rule_key)}
              onSave={handleSave}
              onToggle={handleToggle}
              isSaving={upsertMut.isPending}
            />
          ))}
        </div>
      </section>

      {/* ---- Qo'shimcha (Custom) Qoidalar ---- */}
      <section className="admin-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Qo&apos;shimcha qoidalar</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowCustomForm(!showCustomForm)}
          >
            <Plus className="h-4 w-4 mr-1" /> Yangi qoida
          </Button>
        </div>

        {showCustomForm && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <h3 className="text-sm font-medium">Yangi qoida</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="rule_key (masalan: my_custom_rule)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <Input
                placeholder="rule_value (masalan: 10)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <Input
              placeholder="Tavsif (ixtiyoriy)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  upsertMut.mutate({
                    rule_key: newKey,
                    rule_value: newValue,
                    scope: "global",
                    is_active: true,
                    description: newDesc || null,
                  });
                  setNewKey("");
                  setNewValue("");
                  setNewDesc("");
                  setShowCustomForm(false);
                }}
                disabled={!newKey.trim() || !newValue.trim() || upsertMut.isPending}
              >
                Saqlash
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCustomForm(false)}>
                Bekor
              </Button>
            </div>
          </div>
        )}

        {customRules.length === 0 ? (
          <EmptyState title="Qo'shimcha qoidalar yo'q" description="Yangi qoida qo'shing" />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kalit</th>
                  <th>Qiymat</th>
                  <th>Holat</th>
                  <th>Tavsif</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {customRules.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.rule_key}</td>
                    <td className="font-mono text-xs">{r.rule_value}</td>
                    <td>
                      <button
                        onClick={() => handleToggle(r, !r.is_active)}
                        className="flex items-center gap-1"
                      >
                        {r.is_active ? (
                          <ToggleRight className="h-5 w-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span
                          className={`text-xs ${r.is_active ? "text-green-400" : "text-muted-foreground"}`}
                        >
                          {r.is_active ? "Faol" : "Nofaol"}
                        </span>
                      </button>
                    </td>
                    <td className="text-xs text-muted-foreground">{r.description ?? "—"}</td>
                    <td>
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
