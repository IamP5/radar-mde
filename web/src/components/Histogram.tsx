"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BINS, HIST_HI as HI, HIST_LO as LO, HIST_NB as NB, binColor, histCounts } from "@/lib/bins";
import { MDE_MIN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AXIS, CHART_CLASS, GRID, niceTicks } from "./chart-parts";

type Props = {
  /** raw MDE % values, or … */
  values?: number[];
  /** … counts already binned with `histCounts` (server-side for Brasil/região) */
  counts?: number[];
  /** value to mark ("this municipality") */
  mark?: { value: number; label: string } | null;
  height?: number;
  /** @deprecated the chart is responsive now; kept for call-site compatibility */
  width?: number;
  ariaLabel: string;
};


const config: ChartConfig = Object.fromEntries(BINS.map((b) => [b.key, { label: b.label, color: b.color }]));

/** x position on the continuous bucket axis: bucket i spans [i, i+1]. */
const xOf = (v: number) => (v < LO ? 0.5 : v >= HI ? NB - 0.5 : v - LO + 1);
const bucketLabel = (i: number) => (i === 0 ? `< ${LO}%` : i === NB - 1 ? `≥ ${HI}%` : `${i + LO - 1}–${i + LO}%`);
const center = (i: number) => (i === 0 ? LO - 1 : i === NB - 1 ? HI : i + LO - 1 + 0.5);
/** y ticks: "2 mil" instead of "2.000" so they fit a 44px axis on phones */
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v));
const X_TICKS = [15, 20, 25, 30, 35, 40, 45].map((t) => t - LO + 1);

/** Distribution of MDE % in 1-point buckets, open-ended at both ends, colored by MDE bin, with the 25% minimum marked. */
export default function Histogram({ values, counts: pre, mark, height = 220, ariaLabel }: Props) {
  const counts = useMemo(() => pre ?? histCounts(values ?? []), [pre, values]);
  const data = useMemo(() => counts.map((count, i) => ({ x: i + 0.5, i, count, label: bucketLabel(i), fill: binColor(center(i)) })), [counts]);
  const max = Math.max(1, ...data.map((d) => d.count));
  const { ticks, domain } = niceTicks(0, max, 2);
  // buckets 0..(MDE_MIN - LO) hold every value < 25%
  const below = counts.slice(0, MDE_MIN - LO + 1).reduce((a, b) => a + b, 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const int = (v: number) => v.toLocaleString("pt-BR");
  const modal = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]);

  return (
    <div>
      <p className="sr-only">
        {ariaLabel}. {int(total)} municípios; {int(below)} abaixo de 25%. Faixa mais comum: {modal.label} ({int(modal.count)}).
        {mark && ` ${mark.label}: ${mark.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%.`}
      </p>
      <ChartContainer config={config} className={cn(CHART_CLASS, "h-[220px]")} style={{ height }} aria-hidden>
        <BarChart data={data} accessibilityLayer={false} barCategoryGap={1} margin={{ top: 22, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, NB]}
            ticks={X_TICKS}
            {...AXIS}
            tickFormatter={(v: number) => `${v + LO - 1}%`}
            allowDataOverflow
          />
          <YAxis {...AXIS} width={44} domain={domain} ticks={ticks} allowDecimals={false} tickFormatter={compact} />
          <ChartTooltip
            cursor={{ fill: "var(--accent)", fillOpacity: 0.6 }}
            content={
              <ChartTooltipContent
                hideLabel
                hideIndicator
                formatter={(_, __, item) => (
                  <div className="grid gap-0.5">
                    <div className="text-sm font-medium text-foreground tabular-nums">{int(item.payload.count)} municípios</div>
                    <div className="text-muted-foreground">aplicaram {item.payload.label} em MDE</div>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.i} fill={d.fill} />
            ))}
          </Bar>
          <ReferenceLine
            x={xOf(MDE_MIN)}
            stroke="var(--foreground)"
            strokeOpacity={0.7}
            strokeDasharray="4 4"
            label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => (
              <text x={(viewBox?.x ?? 0) - 6} y={(viewBox?.y ?? 0) - 8} textAnchor="end" fontSize={12} fill="var(--muted-foreground)" className="tabular-nums">
                {int(below)} abaixo de 25%
              </text>
            )}
          />
          {mark && (
            <ReferenceLine
              x={xOf(mark.value)}
              stroke="var(--ink)"
              strokeWidth={2}
              label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => (
                <text x={(viewBox?.x ?? 0) + 6} y={(viewBox?.y ?? 0) + 12} fontSize={12} fontWeight={500} fill="var(--foreground)">
                  {mark.label}
                </text>
              )}
            />
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
