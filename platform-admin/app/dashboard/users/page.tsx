"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUsers } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";

const PAGE = 50;

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", query, offset],
    queryFn: () => getUsers({ q: query || undefined, offset }),
  });

  if (isLoading && !data) return <PageLoader rows={6} />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
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
            placeholder="Telefon, email yoki ism"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="admin-card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Foydalanuvchilar ({total})</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {offset + 1}–{offset + items.length} / {total}
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
          <EmptyState title="Foydalanuvchi topilmadi" />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th>Email</th>
                <th>Telegram</th>
                <th>Ro&apos;yxatdan o&apos;tgan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name ?? "—"}</td>
                  <td>{u.phone ?? "—"}</td>
                  <td className="text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="font-mono text-xs">{u.telegram_id ?? "—"}</td>
                  <td className="text-muted-foreground">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
