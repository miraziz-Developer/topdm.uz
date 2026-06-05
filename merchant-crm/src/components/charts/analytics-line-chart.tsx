"use client";

import { cn } from "@/lib/utils";

export type DailyPoint = {
  date: string;
  /** Backend yoki frontend formatlangan o‘q (uzun davrlar uchun). */
  label?: string;
  views: number;
  leads: number;
  orders: number;
  map_routes: number;
};

export type LineSeriesDef = {
  key: keyof Pick<DailyPoint, "views" | "leads" | "orders" | "map_routes">;
  label: string;
  color: string;
};

type Props = {
  title: string;
  points: DailyPoint[];
  lines: LineSeriesDef[];
  className?: string;
  height?: number;
};

const PAD = { top: 12, right: 8, bottom: 28, left: 36 };

function formatPointLabel(point: DailyPoint): string {
  if (point.label) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(point.label)) {
      const d = new Date(`${point.label}T12:00:00`);
      return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
    }
    return point.label;
  }
  const d = new Date(`${point.date}T12:00:00`);
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
}

function visibleLabelIndices(count: number): Set<number> {
  if (count <= 10) return new Set([...Array(count).keys()]);
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(count / maxLabels));
  const out = new Set<number>();
  for (let i = 0; i < count; i += step) out.add(i);
  out.add(count - 1);
  return out;
}

function buildPath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return "";
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const safeMax = max > 0 ? max : 1;

  return values
    .map((v, i) => {
      const x = PAD.left + i * step;
      const y = PAD.top + innerH - (v / safeMax) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function AnalyticsLineChart({ title, points, lines, className, height = 200 }: Props) {
  const width = 640;
  const labels = points.map((p) => formatPointLabel(p));
  const labelVisible = visibleLabelIndices(points.length);
  const maxVal = Math.max(
    1,
    ...lines.flatMap((line) => points.map((p) => Number(p[line.key] ?? 0))),
  );

  const innerW = width - PAD.left - PAD.right;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = PAD.top + (height - PAD.top - PAD.bottom) * (1 - t);
    const val = Math.round(maxVal * t);
    return { y, val };
  });

  return (
    <div className={cn("crm-surface-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-100">{title}</p>
        <div className="flex flex-wrap gap-3">
          {lines.map((line) => (
            <span key={line.key} className="flex items-center gap-1.5 text-xs font-medium text-text-400">
              <span className="h-2 w-4 rounded-full" style={{ backgroundColor: line.color }} />
              {line.label}
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={title}
      >
        {gridLines.map((g) => (
          <g key={g.y}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={g.y}
              y2={g.y}
              stroke="currentColor"
              className="text-border-subtle"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={PAD.left - 6} y={g.y + 4} textAnchor="end" className="fill-text-400 text-[10px]">
              {g.val}
            </text>
          </g>
        ))}
        {lines.map((line) => {
          const values = points.map((p) => Number(p[line.key] ?? 0));
          const path = buildPath(values, width, height, maxVal);
          return (
            <g key={line.key}>
              <path d={path} fill="none" stroke={line.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {values.map((v, i) => {
                const x = PAD.left + i * step;
                const innerH = height - PAD.top - PAD.bottom;
                const y = PAD.top + innerH - (v / maxVal) * innerH;
                return (
                  <circle key={`${line.key}-${i}`} cx={x} cy={y} r={3.5} fill={line.color} stroke="#fff" strokeWidth={1.5} />
                );
              })}
            </g>
          );
        })}
        {labels.map((label, i) => {
          if (!labelVisible.has(i)) return null;
          const x = PAD.left + i * step;
          return (
            <text
              key={`${label}-${i}`}
              x={x}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
              className="fill-text-400 text-[10px]"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
