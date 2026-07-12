"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, User, X } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUsers, type UserItem } from "@/lib/admin-api";
import { cn, formatDate } from "@/lib/utils";

const PAGE = 50;

function UserDetailPanel({ user, onClose }: { user: UserItem; onClose: () => void }) {
  return (
    <div className="admin-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Foydalanuvchi tafsilotlari
        </h3>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          ✕ Yopish
        </button>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono text-xs">{user.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ism</dt>
          <dd className="font-medium">{user.full_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Telefon</dt>
          <dd>{user.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{user.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Telegram ID</dt>
          <dd className="font-mono">{user.telegram_id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rol</dt>
          <dd>
            <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
              {user.role ?? "user"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ro&apos;yxatdan o&apos;tgan</dt>
          <dd>{formatDate(user.created_at ?? "")}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<UserItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", query, offset],
    queryFn: () => getUsers({ q: query || undefined, offset }),
  });

  if (isLoading && !data) return <PageLoader rows={6} />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="admin-card">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setOffset(0);
          }}
        >
          <Input
            placeholder="Telefon, email yoki ism..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
          {query && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setQuery(""); setOffset(0); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="admin-card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            Foydalanuvchilar
            <span className="ml-2 text-sm font-normal text-muted-foreground">({total} ta)</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              size="sm"
              variant="ghost"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {offset + 1}–{Math.min(offset + PAGE, total)} / {total}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Foydalanuvchi topilmadi" description="Qidiruv so'zini o'zgartiring" />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Foydalanuvchi</th>
                <th>Telefon</th>
                <th>Email</th>
                <th>Telegram</th>
                <th>Ro&apos;yxat sanasi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    "cursor-pointer hover:bg-secondary/30",
                    selected?.id === u.id && "bg-secondary/40"
                  )}
                  onClick={() => setSelected(selected?.id === u.id ? null : u)}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                        {(u.full_name ?? u.phone ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{u.full_name ?? "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{u.phone ?? "—"}</td>
                  <td className="text-sm text-muted-foreground">{u.email ?? "—"}</td>
                  <td>
                    {u.telegram_id ? (
                      <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                        Ulangan
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-sm text-muted-foreground">{formatDate(u.created_at ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <UserDetailPanel user={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
