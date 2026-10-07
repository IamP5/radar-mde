"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis, usePlotArea, useYAxisScale } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { ACTIVE_DOT, AXIS, CHART_CLASS, GRID, TooltipRow, YearTick, niceTicks, yearKeys, yearTicks } from "./chart-parts";
import { useWidth } from "./useWidth";

export type Series = { key: string; label: string; color: string; values: (number | null)[]; emphasis?: boolean; href?: string };

type Props = {
  years: number[];
  series: Series[];
  selected?: number;
  onSelect?: (y: number) => void;
  fmt: (v: number) => string;
  ariaLabel: string;
  height?: number;
  /** y-axis floor; defaults to 0 */
  min?: number;
  /** optional shaded span of years, e.g. the pandemic `{ from: 2020, to: 2021, label: "pandemia" }` */
  band?: { from: number; to: number; label?: string };
};

const LABEL_W = 108;
const LABEL_GAP = 14;

/** Multi-series line chart: crosshair + tooltip listing every series, direct labels at the line ends (≤5 series). */
export default function MultiLine({ years, series, selected, onSelect, fmt, ariaLabel, height = 280, min = 0, band }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 720, 0, 4000);
  const direct = series.length <= 5 && width >= 480;

  const data = useMemo(
    () => years.map((year, i) => Object.fromEntries([["year", year], ...series.map((s) => [s.key, s.values[i]] as const)])),
    [years, series],
  );
  const config = useMemo<ChartConfig>(() => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])), [series]);
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const { ticks, domain } = niceTicks(min, Math.max(min + 1, ...all));
  const byKey = new Map(series.map((s) => [s.key, s]));

  const last = years.length - 1;
  const summary = series
    .map((s) => (s.values[last] == null ? null : `${s.label} ${fmt(s.values[last]!)}`))
    .filter(Boolean)
    .join("; ");

  return (
    <div
      ref={box}
      role="group"
      aria-label={onSelect ? `${ariaLabel}. Setas esquerda e direita mudam o ano.` : ariaLabel}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={yearKeys(years, selected, onSelect)}
      className="rounded-md"
    >
      <p className="sr-only">
        {ariaLabel}. Em {years[last]}: {summary}.
      </p>
      <ChartContainer config={config} className={cn(CHART_CLASS, "h-[280px]", onSelect && "cursor-pointer")} style={{ height }} aria-hidden>
        <LineChart
          data={data}
          accessibilityLayer={false}
          margin={{ top: 8, right: direct ? LABEL_W : 12, bottom: 0, left: 0 }}
          onClick={(s) => s.activeLabel != null && onSelect?.(Number(s.activeLabel))}
        >
          <CartesianGrid {...GRID} />
          {band && (
            <ReferenceArea
              x1={band.from}
              x2={band.to}
              fill="var(--muted-foreground)"
              fillOpacity={0.08}
              strokeOpacity={0}
              label={band.label ? { value: band.label, position: "insideTop", fontSize: 11, fill: "var(--muted-foreground)" } : undefined}
            />
          )}
          <XAxis
            dataKey="year"
            {...AXIS}
            ticks={yearTicks(years, width - 44 - (direct ? LABEL_W : 12) - 16)}
            interval={0}
            padding={{ left: 8, right: 8 }}
            tick={(p) => <YearTick {...p} selected={selected} />}
          />
          <YAxis {...AXIS} width={44} domain={domain} ticks={ticks} tickFormatter={(v: number) => fmt(v)} allowDataOverflow />
          {selected != null && <ReferenceLine x={selected} stroke="var(--foreground)" strokeOpacity={0.25} />}
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            itemSorter={(item) => -(typeof item.value === "number" ? item.value : -Infinity)}
            content={
              <ChartTooltipContent
                indicator="line"
                className="min-w-44"
                labelFormatter={(_, p) => (
                  <span className="flex items-baseline justify-between gap-3 tabular-nums">
                    {p?.[0]?.payload?.year}
                    {onSelect && <span className="font-normal text-muted-foreground">clique para fixar</span>}
                  </span>
                )}
                formatter={(value, name, item) => {
                  const s = byKey.get(String(item.dataKey ?? name));
                  return (
                    <TooltipRow
                      color={s?.color ?? String(item.color)}
                      name={s?.label ?? name}
                      value={typeof value === "number" ? fmt(value) : "—"}
                      strong={s?.emphasis}
                    />
                  );
                }}
              />
            }
          />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.key}
              type="linear"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.emphasis ? "6 3" : undefined}
              strokeOpacity={focus != null && focus !== s.key ? 0.15 : 1}
              dot={false}
              activeDot={{ ...ACTIVE_DOT, fill: s.color }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {direct && <EndLabels series={series} focus={focus} setFocus={setFocus} />}
        </LineChart>
      </ChartContainer>
      {!direct && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {series.map((s) => {
            const inner = (
              <>
                <span aria-hidden className={cn("inline-block w-3", s.emphasis ? "border-t-2 border-dashed" : "h-0.5 rounded-full")} style={s.emphasis ? { borderColor: s.color } : { background: s.color }} />
                <span className={s.emphasis ? "font-medium text-foreground" : undefined}>{s.label}</span>
              </>
            );
            const cls = "flex items-center gap-1.5 rounded-sm transition-colors duration-150";
            return (
              <li key={s.key} onPointerEnter={() => setFocus(s.key)} onPointerLeave={() => setFocus(null)}>
                {s.href ? (
                  <Link href={s.href} className={cn(cls, "hover:text-foreground")}>
                    {inner}
                  </Link>
                ) : (
                  <span className={cls}>{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Labels at the right of the plot, at each series' last value, nudged apart so they never overlap. */
function EndLabels({ series, focus, setFocus }: { series: Series[]; focus: string | null; setFocus: (k: string | null) => void }) {
  const yScale = useYAxisScale();
  const area = usePlotArea();
  if (!yScale || !area) return null;
  const ends = series
    .map((s) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] == null) i--;
      return { s, y: i >= 0 ? (yScale(s.values[i]) ?? null) : null };
    })
    .filter((e): e is { s: Series; y: number } => e.y != null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < LABEL_GAP) ends[i].y = ends[i - 1].y + LABEL_GAP;
  const bottom = area.y + area.height;
  for (let i = ends.length - 1; i >= 0; i--) {
    const limit = i === ends.length - 1 ? bottom : ends[i + 1].y - LABEL_GAP;
    if (ends[i].y > limit) ends[i].y = limit;
  }
  const x = area.x + area.width + 10;
  return (
    <g>
      {ends.map(({ s, y }) => {
        const label = (
          <text
            x={x}
            y={y}
            dy={4}
            fontSize={12}
            fill={s.emphasis ? "var(--foreground)" : "var(--muted-foreground)"}
            fontWeight={s.emphasis ? 500 : 400}
            opacity={focus != null && focus !== s.key ? 0.35 : 1}
          >
            <tspan fill={s.color}>● </tspan>
            {s.label.length > 15 ? `${s.label.slice(0, 14)}…` : s.label}
            <title>{s.label}</title>
          </text>
        );
        return (
          <g key={s.key} onPointerEnter={() => setFocus(s.key)} onPointerLeave={() => setFocus(null)} onClick={(e) => e.stopPropagation()}>
            {s.href ? <Link href={s.href}>{label}</Link> : label}
          </g>
        );
      })}
    </g>
  );
}
