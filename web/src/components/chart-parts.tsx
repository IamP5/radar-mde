"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { XAxisTickContentProps } from "recharts";

/** Shared Recharts styling for the shadcn charts (DESIGN.md · Charts). */

/** ChartContainer classes: tabular tick numbers, crisp 12px text. Combine with a height class. */
export const CHART_CLASS = "aspect-auto w-full text-xs [&_.recharts-text]:tabular-nums";

export const TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

/** Spread onto XAxis / YAxis: no axis line, no tick marks, 8px gap. */
export const AXIS = { axisLine: false, tickLine: false, tickMargin: 8, tick: TICK } as const;

export const GRID = { vertical: false, stroke: "var(--grid)" } as const;

export const ACTIVE_DOT = { r: 4, stroke: "var(--background)", strokeWidth: 2 } as const;

/** 3–5 round ticks covering [lo, hi]; returns the ticks and the padded domain. */
export function niceTicks(lo: number, hi: number, target = 4) {
  const span = hi - lo || 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target + 1) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 1e6; t += step) ticks.push(+t.toFixed(6));
  return { ticks, domain: [start, end] as [number, number] };
}

/** Evenly spaced year ticks that always include the last year (and the selected one when it fits). */
export function yearTicks(years: number[], plotWidth: number, minGap = 40) {
  const n = years.length;
  const step = Math.max(1, Math.ceil((minGap * n) / Math.max(1, plotWidth)));
  return years.filter((_, i) => (n - 1 - i) % step === 0);
}

/** X tick for year axes: the selected year in foreground and medium weight. */
export function YearTick(props: XAxisTickContentProps & { selected?: number; short?: boolean }) {
  const { x, y, payload, selected, short } = props;
  const isSel = payload.value === selected;
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor="middle"
      fontSize={12}
      fill={isSel ? "var(--foreground)" : "var(--muted-foreground)"}
      fontWeight={isSel ? 500 : 400}
      className="tabular-nums"
    >
      {short ? `’${String(payload.value).slice(2)}` : payload.value}
    </text>
  );
}

/** Tooltip row: colored line indicator, muted name, value right-aligned. Use inside ChartTooltipContent `formatter`. */
export function TooltipRow({ color, name, value, dashed, strong }: { color: string; name: ReactNode; value: ReactNode; dashed?: boolean; strong?: boolean }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span
        aria-hidden
        className={dashed ? "h-3 w-0 shrink-0 border-l-[1.5px] border-dashed" : "h-3 w-1 shrink-0 rounded-[2px]"}
        style={dashed ? { borderColor: color } : { background: color }}
      />
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{name}</span>
      <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

/** Arrow keys / Home / End move the selected year on a focused interactive chart. */
export function yearKeys(years: number[], selected: number | undefined, onSelect: ((y: number) => void) | undefined) {
  return (e: KeyboardEvent) => {
    if (!onSelect || !years.length) return;
    const i = selected != null ? years.indexOf(selected) : years.length - 1;
    const next =
      e.key === "ArrowLeft" ? Math.max(0, i - 1)
      : e.key === "ArrowRight" ? Math.min(years.length - 1, i + 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? years.length - 1
      : null;
    if (next == null) return;
    e.preventDefault();
    if (years[next] !== selected) onSelect(years[next]);
  };
}
