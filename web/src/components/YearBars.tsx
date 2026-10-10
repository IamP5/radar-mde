"use client";

import { useRef } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { AXIS, CHART_CLASS, GRID, YearTick, niceTicks, yearKeys, yearTicks } from "./chart-parts";
import { useWidth } from "./useWidth";

type D = { year: number; below: number; reported: number; nd: number };

const config = { below: { label: "Abaixo de 25%", color: "var(--bin-1)" } } satisfies ChartConfig;

/** Municipalities below 25% per year; the selected year in full color, click/arrow keys to change it. */
export default function YearBars({ data, selected, onSelect }: { data: D[]; selected: number; onSelect: (y: number) => void }) {
  const { ticks, domain } = niceTicks(0, Math.max(1, ...data.map((d) => d.below)));
  const peak = data.reduce((a, b) => (b.below > a.below ? b : a), data[0]);
  const years = data.map((d) => d.year);
  const sel = data.find((d) => d.year === selected);
  const int = (v: number) => v.toLocaleString("pt-BR");
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 420, 0, 4000);
  // value labels only on the selected and the peak year
  const rows = data.map((d) => ({ ...d, lbl: d.year === selected || d.year === peak.year ? int(d.below) : null }));

  return (
    <div
      ref={box}
      role="group"
      tabIndex={0}
      aria-label="Número de municípios abaixo de 25% por ano. Setas esquerda e direita mudam o ano."
      onKeyDown={yearKeys(years, selected, onSelect)}
      className="rounded-md"
    >
      <p className="sr-only">
        {data.map((d) => `${d.year}: ${d.below} de ${d.reported}`).join("; ")}.
        {sel && ` Ano selecionado: ${sel.year}.`}
      </p>
      <ChartContainer config={config} className={cn(CHART_CLASS, "h-[240px] cursor-pointer")} aria-hidden>
        <BarChart
          data={rows}
          accessibilityLayer={false}
          barCategoryGap={2}
          margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
          onClick={(s) => s.activeLabel != null && onSelect(Number(s.activeLabel))}
        >
          <CartesianGrid {...GRID} />
          <XAxis dataKey="year" {...AXIS} ticks={yearTicks(years, width - 36, 30)} interval={0} tick={(p) => <YearTick {...p} selected={selected} short />} />
          <YAxis {...AXIS} width={36} domain={domain} ticks={ticks} allowDecimals={false} tickFormatter={(v: number) => int(v)} />
          <ChartTooltip
            cursor={{ fill: "var(--surface-muted)" }}
            content={
              <ChartTooltipContent
                indicator="line"
                hideLabel
                className="min-w-48"
                formatter={(_, __, item) => {
                  const d = item.payload as D;
                  return (
                    <div className="grid gap-0.5">
                      <div className="text-sm font-medium text-foreground tabular-nums">{int(d.below)} abaixo de 25%</div>
                      <div className="text-muted-foreground tabular-nums">
                        {d.year} · {int(d.reported)} com dados · {int(d.nd)} não declararam
                      </div>
                    </div>
                  );
                }}
              />
            }
          />
          <Bar dataKey="below" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.year} fill="var(--color-below)" fillOpacity={d.year === selected ? 1 : 0.3} />
            ))}
            <LabelList
              dataKey="lbl"
              position="top"
              offset={6}
              fontSize={12}
              fill="var(--foreground)"
              className="tabular-nums"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
