export function PageLoader({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-card h-24 bg-secondary/40" />
        ))}
      </div>
      <div className="admin-card space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-secondary/40" />
        ))}
      </div>
    </div>
  );
}
