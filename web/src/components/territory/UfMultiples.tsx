"use client";

import Link from "next/link";
import { useId } from "react";
import { belowShare, type Stats } from "@/lib/rows";
import { cn } from "@/lib/utils";

type Item = { key: string; title: string; subtitle?: string; href: string; stats: Stats[] };

const W = 160;
const H = 40;
const PAD = 3;

const pctLabel = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 && v > 0 ? 1 : 0 })}%`;

/**
 * Small multiples: one sparkline card per territory of the share of municipalities below 25%, all on the
 * same y-scale so heights compare across cards. The selected year is marked. Plain SVG (no Recharts):
 * 27 cards render instantly and need no tooltip; the card title attribute carries the numbers.
 */
export default function UfMultiples({ items, years, year, cols = "sm:grid-cols-3 lg:grid-cols-5" }: { items: Item[]; years: number[]; year: number; cols?: string }) {
  const uid = useId().replace(/:/g, "");
  const yi = years.indexOf(year);
  const series = items.map((it) => it.stats.map(belowShare));
  const max = Math.max(5, ...series.flat().filter((v): v is number => v != null));
  const x = (i: number) => (i / Math.max(1, years.length - 1)) * W;
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);

  return (
    <ul className={cn("grid grid-cols-2 gap-2", cols)}>
      {items.map((it, k) => {
        const vals = series[k];
        // line broken at gaps; the area closes each run down to the baseline
        const runs: [number, number][][] = [];
        vals.forEach((v, i) => {
          if (v == null) return;
          if (i === 0 || vals[i - 1] == null) runs.push([]);
          runs[runs.length - 1].push([x(i), y(v)]);
        });
        const line = runs.map((r) => r.map(([px, py], j) => `${j ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")).join("");
        const area = runs
          .map((r) => `M${r[0][0].toFixed(1)},${H}` + r.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join("") + `L${r[r.length - 1][0].toFixed(1)},${H}Z`)
          .join("");
        const cur = yi >= 0 ? vals[yi] : null;
        const s = yi >= 0 ? it.stats[yi] : undefined;
        const gid = `${uid}-g${k}`;
        const summary = `${it.title}: ${cur == null ? "sem dados" : `${pctLabel(cur)} dos municípios abaixo de 25% em ${year}`}`;
        return (
          <li key={it.key}>
            <Link
              href={it.href}
              title={summary}
              aria-label={summary}
              className="group block rounded-lg border bg-card px-3 pt-2.5 pb-2 transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium">{it.title}</span>
                <span className={cn("text-[13px] font-medium tnum", cur ? "text-critical" : "text-muted-foreground")}>{pctLabel(cur)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{it.subtitle}</span>
                {s && (
                  <span className="tnum">
                    {s.below}/{s.reported}
                  </span>
                )}
              </div>
              {/* stretched to the card width; strokes keep their thickness */}
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1.5 h-10 w-full overflow-visible" aria-hidden>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--critical)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--critical)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <line x1={0} x2={W} y1={H - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                {yi >= 0 && <line x1={x(yi)} x2={x(yi)} y1={0} y2={H - PAD} stroke="var(--axis)" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
                <path d={area} fill={`url(#${gid})`} />
                <path d={line} fill="none" stroke="var(--critical)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {cur != null && (
                  <line x1={x(yi)} x2={x(yi)} y1={y(cur)} y2={y(cur)} stroke="var(--critical)" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
