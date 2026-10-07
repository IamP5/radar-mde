"use client";

import { useId, useMemo, useRef } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { ACTIVE_DOT, AXIS, CHART_CLASS, GRID, TooltipRow, YearTick, niceTicks, yearTicks } from "./chart-parts";
import { useWidth } from "./useWidth";

type Pt = { year: number; value: number | null; min?: number };

type Props = {
  points: Pt[];
  label: string;
  /** Shown beside the dashed legal-minimum line; omit when points carry no `min`. */
  thresholdLabel?: string;
  unit?: "%" | "R$";
  height?: number;
  /** context lines (e.g. state and national medians), thin and unlabelled on the plot, listed in the tooltip */
  refs?: { label: string; color: string; values: (number | null)[] }[];
  /** shaded span of years (e.g. 2020–2021, EC 119/2022) with a small label */
  band?: { from: number; to: number; label: string };
  /** years whose value is out of the municipality's own pattern: hollow warning dot + tooltip note */
  flagged?: number[];
};

const fmt = (v: number, unit: "%" | "R$", short = false) =>
  unit === "%"
    ? `${v.toFixed(short ? (Number.isInteger(v) ? 0 : 1) : 2).replace(".", ",")}%`
    : short
      ? v >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v))
      : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

/** Single-series area/line with an optional dashed legal-minimum reference (may step), context lines, tooltip on hover. */
export default function TrendChart({ points, label, thresholdLabel, unit = "%", height = 220, refs = [], band, flagged = [] }: Props) {
  const gid = `trend-${useId().replace(/:/g, "")}`;
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 600, 0, 4000);
  const hasThr = points.some((p) => p.min != null);
  const data = useMemo(
    () =>
      points.map((p, i) => ({
        year: p.year,
        value: p.value,
        min: p.min ?? null,
        below: p.value != null && p.min != null && p.value < p.min,
        flag: p.value != null && flagged.includes(p.year),
        ...Object.fromEntries(refs.map((r, k) => [`ref${k}`, r.values[i] ?? null])),
      })),
    [points, refs, flagged],
  );
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  if (vals.length === 0)
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        O município não informou este indicador no período.
      </div>
    );

  const thrVals = hasThr ? points.map((p) => p.min).filter((v): v is number => v != null) : [];
  const refVals = refs.flatMap((r) => r.values).filter((v): v is number => v != null);
  const all = [...vals, ...thrVals, ...refVals];
  const lo = unit === "%" ? Math.max(0, Math.min(...all) - 2) : 0;
  const hi = unit === "%" ? Math.max(...all) + 2 : Math.max(...all) * 1.08;
  const { ticks, domain } = niceTicks(lo, hi);
  // y axis as wide as its longest label ("125 mil" must not wrap or clip)
  const yWidth = Math.max(36, Math.max(...ticks.map((t) => fmt(t, unit, true).length)) * 8.5 + 16);
  const showBand = band && points.some((p) => p.year === band.from) && points.some((p) => p.year === band.to);

  const config: ChartConfig = {
    value: { label, color: "var(--series-1)" },
    min: { label: thresholdLabel ?? "mínimo", color: "var(--foreground)" },
    ...Object.fromEntries(refs.map((r, k) => [`ref${k}`, { label: r.label, color: r.color }])),
  };
  const lastPt = [...points].reverse().find((p) => p.value != null)!;
  const belowYears = points.filter((p) => p.value != null && p.min != null && p.value < p.min).map((p) => p.year);
  const flaggedShown = points.filter((p) => p.value != null && flagged.includes(p.year)).map((p) => p.year);
  const showLegend = hasThr || refs.length > 0 || flaggedShown.length > 0;

  return (
    <div ref={box}>
      <p className="sr-only">
        {label} por ano{thresholdLabel ? `, com linha de referência em ${thresholdLabel}` : ""}. Em {lastPt.year}: {fmt(lastPt.value!, unit)}.
        {belowYears.length > 0 && ` Abaixo do mínimo em ${belowYears.join(", ")}.`}
        {flaggedShown.length > 0 && ` Valor fora do padrão do município em ${flaggedShown.join(", ")} (marcado no gráfico).`}
        {showBand && ` Faixa destacada: ${band.from}–${band.to} (${band.label}).`}
      </p>
      <ChartContainer
        config={config}
        className={cn(CHART_CLASS, "h-[220px] [&_*:focus:not(:focus-visible)]:outline-none")}
        style={{ height }}
        aria-hidden
      >
        <ComposedChart data={data} accessibilityLayer={false} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          {showBand && (
            <ReferenceArea
              x1={band.from}
              x2={band.to}
              fill="var(--muted-foreground)"
              fillOpacity={0.1}
              stroke="none"
              ifOverflow="hidden"
              label={{ value: band.label, position: "insideTop", fontSize: 11, fill: "var(--muted-foreground)" }}
            />
          )}
          <XAxis dataKey="year" {...AXIS} ticks={yearTicks(points.map((p) => p.year), width - yWidth - 28)} interval={0} padding={{ left: 8, right: 8 }} tick={(p) => <YearTick {...p} />} />
          <YAxis {...AXIS} width={yWidth} domain={domain} ticks={ticks} tickFormatter={(v: number) => fmt(v, unit, true)} allowDataOverflow />
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            itemSorter={(item) => (item.dataKey === "value" ? 0 : item.dataKey === "min" ? 2 : 1)}
            content={
              <ChartTooltipContent
                indicator="line"
                className="min-w-44"
                labelFormatter={(_, p) => <span className="tabular-nums">{p?.[0]?.payload?.year}</span>}
                formatter={(value, name, item) => {
                  const key = String(item.dataKey);
                  const v = typeof value === "number" ? fmt(value, unit) : "sem dados";
                  if (key === "value")
                    return (
                      <div className="grid w-full gap-1">
                        <TooltipRow color="var(--series-1)" name={label} value={v} strong />
                        {item.payload?.below && <div className="text-critical-ink">abaixo do mínimo ({fmt(item.payload.min, unit)})</div>}
                        {item.payload?.flag && <div className="text-warning-ink">fora do padrão do município — confirme na fonte</div>}
                      </div>
                    );
                  if (key === "min") return <TooltipRow color="var(--foreground)" name={thresholdLabel ?? "mínimo"} value={v} dashed />;
                  const r = refs[Number(key.slice(3))];
                  return <TooltipRow color={r?.color ?? String(item.color)} name={r?.label ?? name} value={v} dashed />;
                }}
              />
            }
          />
          {hasThr && (
            <Line
              dataKey="min"
              type="step"
              stroke="var(--foreground)"
              strokeOpacity={0.6}
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          {refs.map((r, k) => (
            <Line
              key={r.label}
              dataKey={`ref${k}`}
              type="linear"
              stroke={r.color}
              strokeWidth={1.5}
              strokeDasharray="2 3"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          <Area
            dataKey="value"
            type="linear"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill={`url(#${gid})`}
            baseValue={domain[0]}
            connectNulls={false}
            dot={(p: { cx?: number; cy?: number; index?: number; payload?: { below?: boolean; flag?: boolean } }) =>
              p.payload?.flag && p.cx != null && p.cy != null ? (
                <g key={p.index}>
                  <circle cx={p.cx} cy={p.cy} r={5} fill="var(--background)" stroke="var(--warning)" strokeWidth={2} />
                  {p.payload.below && <circle cx={p.cx} cy={p.cy} r={2} fill="var(--critical)" />}
                </g>
              ) : p.payload?.below && p.cx != null && p.cy != null ? (
                <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill="var(--critical)" stroke="var(--background)" strokeWidth={1.5} />
              ) : (
                <g key={p.index} />
              )
            }
            activeDot={{ ...ACTIVE_DOT, fill: "var(--series-1)" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded-full bg-series-1" />
            {label}
          </li>
          {hasThr && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block w-3 border-t border-dashed border-foreground/60" />
              {thresholdLabel ?? "mínimo"}
            </li>
          )}
          {flaggedShown.length > 0 && (
            <li className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden>
                <circle cx="6" cy="6" r="4" fill="var(--background)" stroke="var(--warning)" strokeWidth="2" />
              </svg>
              fora do padrão ({flaggedShown.join(", ")})
            </li>
          )}
          {refs.map((r) => (
            <li key={r.label} className="flex items-center gap-1.5">
              <svg width="12" height="4" aria-hidden>
                <line x1="0" x2="12" y1="2" y2="2" stroke={r.color} strokeWidth="1.5" strokeDasharray="2 3" />
              </svg>
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
