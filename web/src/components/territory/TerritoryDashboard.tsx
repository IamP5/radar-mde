"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Histogram from "@/components/Histogram";
import MultiLine, { type Series } from "@/components/MultiLine";
import { PageBody } from "@/components/kit/page-header";
import { Panel } from "@/components/kit/panel";
import { Segmented } from "@/components/kit/segmented";
import { Stat, type Tone } from "@/components/kit/stat";
import { StatusDot } from "@/components/kit/status";
import { Skeleton } from "@/components/ui/skeleton";
import YearPicker, { useYear, withYear } from "@/components/YearPicker";
import { cn } from "@/lib/utils";
import { PANDEMIC_YEARS, brlShort, funMin, int, pct, share } from "@/lib/format";
import { UFS, cityPath, getRegion, regionPath, ufPath, type RegionKey } from "@/lib/geo";
import { alignRows, belowShare, loadAllRows, shortfallKnown, shortfallLabel, type Deficit, type RegionSummary, type Row, type Stats, type UfSummary } from "@/lib/rows";
import TerritoryMap from "./TerritoryMap";
import UfMultiples from "./UfMultiples";
import UfTable from "./UfTable";

type Props = {
  region?: RegionKey;
  years: number[];
  initialYear: number;
  stats: Stats[];
  /** Brasil, when this is a region */
  parent?: Stats[];
  ufs: UfSummary[];
  regions?: RegionSummary[];
  deficits: Deficit[];
};

const REGION_COLOR: Record<RegionKey, string> = {
  N: "var(--series-3)",
  NE: "var(--series-2)",
  CO: "var(--series-4)",
  SE: "var(--series-1)",
  S: "var(--series-5)",
};

type TrendKey = "share" | "short" | "median";
const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const TRENDS: { key: TrendKey; label: string; short: string; tiny: string; of: (s: Stats) => number | null; fmt: (v: number) => string; show: (v: number) => string }[] = [
  { key: "share", label: "% de municípios abaixo de 25%", short: "% abaixo de 25%", tiny: "% abaixo", of: belowShare, fmt: pct1, show: pct1 },
  { key: "short", label: "R$ que faltou para 25%", short: "R$ que faltou", tiny: "R$ faltou", of: shortfallKnown, fmt: (v) => brlShort(v).replace("R$ ", ""), show: brlShort },
  { key: "median", label: "MDE mediana (%)", short: "MDE mediana", tiny: "Mediana", of: (s) => s.median, fmt: pct1, show: pct1 },
];

/** Tiny area sparkline for KPI cards; the selected year is marked. */
function Spark({ values, index, color }: { values: (number | null)[]; index: number; color: string }) {
  const id = `spark-${useId().replace(/:/g, "")}`;
  const W = 200;
  const H = 40;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 10);
  let line = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) return void (pen = false);
    line += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  const first = values.findIndex((v) => v != null);
  let last = values.length - 1;
  while (last > 0 && values[last] == null) last--;
  const area = `${line}L${x(last).toFixed(1)},${H}L${x(first).toFixed(1)},${H}Z`;
  const cur = values[index];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.2} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <line x1={x(index)} x2={x(index)} y1={0} y2={H} stroke="var(--axis)" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      {cur != null && <line x1={x(index)} x2={x(index)} y1={y(cur)} y2={y(cur)} stroke={color} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Delta pill content: arrow + magnitude, tone by whether "up" is good or bad for this metric. */
function delta(d: number | null, fmt: (abs: number) => string, upIs: "bad" | "good", vs: number | undefined): { node?: ReactNode; tone: Tone } {
  if (d == null || vs == null || !Number.isFinite(d)) return { tone: "neutral" };
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  const tone: Tone = d === 0 ? "neutral" : (d > 0) === (upIs === "bad") ? "bad" : "good";
  return {
    tone,
    node: (
      <span title={`vs ${vs}`} className="inline-flex items-center gap-0.5">
        <Icon aria-hidden className="size-3" />
        {d === 0 ? `igual a ${vs}` : fmt(Math.abs(d))}
        <span className="sr-only"> {d > 0 ? "a mais" : "a menos"} que em {vs}</span>
      </span>
    ),
  };
}

const relChange = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || b === 0 ? null : ((a - b) / b) * 100);

export default function TerritoryDashboard({ region, years, initialYear, stats, parent, ufs, regions, deficits }: Props) {
  const [year, setYear] = useYear(years, initialYear);
  const [trend, setTrend] = useState<TrendKey>("share");
  const tabs = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState<Row[] | null>(null);
  const [rowsError, setRowsError] = useState(false);
  const yi = years.indexOf(year);
  const s = stats[yi];
  const prev = yi > 0 ? stats[yi - 1] : null;
  const scopeLabel = region ? `Região ${getRegion(region).name}` : "Brasil";
  const ufCodes = useMemo(() => (region ? UFS.filter((u) => u.region === region).map((u) => u.code) : undefined), [region]);

  useEffect(() => {
    let live = true;
    loadAllRows()
      .then((f) => live && setAll(alignRows(f, years)))
      .catch(() => live && setRowsError(true));
    return () => {
      live = false;
    };
  }, [years]);

  const scoped = useMemo(() => (all && ufCodes ? all.filter((r) => ufCodes.includes(Math.floor(r.id / 100000))) : all), [all, ufCodes]);
  const dist = useMemo(() => (scoped ? scoped.map((r) => r.mde[yi]).filter((v): v is number => v != null) : []), [scoped, yi]);

  // Headline: where the problem concentrates this year
  const worstUf = [...ufs].sort((a, b) => (belowShare(b.stats[yi]) ?? -1) - (belowShare(a.stats[yi]) ?? -1))[0];
  const mostBelowUf = [...ufs].sort((a, b) => b.stats[yi].below - a.stats[yi].below)[0];

  const t = TRENDS.find((x) => x.key === trend)!;
  const series: Series[] = regions
    ? [
        ...regions.map((r) => ({ key: r.key, label: r.name, color: REGION_COLOR[r.key], values: r.stats.map(t.of), href: regionPath(r.key) })),
        { key: "BR", label: "Brasil", color: "var(--ink)", values: stats.map(t.of), emphasis: true },
      ]
    : [
        { key: region!, label: getRegion(region!).name, color: REGION_COLOR[region!], values: stats.map(t.of) },
        ...(parent ? [{ key: "BR", label: "Brasil", color: "var(--ink)", values: parent.map(t.of), emphasis: true }] : []),
      ];
  // R$ shortfall is a sum: comparing a region against Brasil on the same axis is meaningless
  const trendSeries = trend === "short" && !regions ? series.slice(0, 1) : trend === "short" ? series.filter((x) => x.key !== "BR") : series;

  const pv = years[yi - 1];
  const dBelow = delta(prev ? s.below - prev.below : null, int, "bad", pv);
  const dShort = delta(prev ? relChange(shortfallKnown(s), shortfallKnown(prev)) : null, (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`, "bad", pv);
  const dPop = delta(prev ? relChange(s.popBelow, prev.popBelow) : null, (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`, "bad", pv);
  const dMedian = delta(prev && s.median != null && prev.median != null ? Math.round((s.median - prev.median) * 10) / 10 : null, (v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`, "good", pv);
  const dFun = delta(prev ? s.funBelow - prev.funBelow : null, int, "bad", pv);
  const ctx = (f: (x: Stats) => string) => (parent ? `Brasil: ${f(parent[yi])}` : undefined);
  const red = "var(--critical)";
  const ink = "var(--ink-2)";
  const short = shortfallLabel(s);

  const moveTab = (d: number) => {
    const n = TRENDS[(TRENDS.findIndex((x) => x.key === trend) + d + TRENDS.length) % TRENDS.length];
    setTrend(n.key);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLElement>("[aria-selected=true]")?.focus());
  };

  const ufLink = (u: UfSummary) => (
    <Link href={withYear(ufPath(u.uf), year, initialYear)} className="font-medium underline decoration-border decoration-1 underline-offset-[3px] transition-colors hover:decoration-foreground">
      {u.name}
    </Link>
  );

  return (
    <>
      <div className="sticky top-(--header-h) z-30 border-b bg-canvas/80 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <YearPicker years={years} year={year} onChange={setYear} className="min-w-0 flex-1" />
          <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
            <span className="text-[13px] text-muted-foreground">Série</span>
            <Segmented ariaLabel="Indicador da série" value={trend} onChange={setTrend} options={TRENDS.map((x) => ({ value: x.key, label: x.short, title: x.label }))} />
          </div>
        </div>
      </div>

      <PageBody>
        <div className="space-y-3">
          <p className="max-w-4xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8">
            Em <strong className="font-semibold text-foreground tnum">{year}</strong>,{" "}
            <strong className={cn("font-semibold tnum", s.below ? "text-critical" : "text-foreground")}>
              {int(s.below)} {s.below === 1 ? "município" : "municípios"}
            </strong>{" "}
            {region ? `da região ${getRegion(region).name}` : "brasileiros"} ({share(s.below, s.reported)} dos que declararam) aplicaram menos de 25% em educação
            {s.shortfall > 0 && (
              <>
                {" "}— {s.belowNoBase ? "ao menos " : ""}
                <strong className="font-semibold text-foreground tnum">{brlShort(s.shortfall)}</strong> deixaram de ir para o ensino
              </>
            )}
            .
            {s.below > 0 && worstUf && (
              <>
                {" "}A maior proporção está em <span className="text-foreground">{ufLink(worstUf)}</span> ({share(worstUf.stats[yi].below, worstUf.stats[yi].reported)})
                {mostBelowUf.uf !== worstUf.uf && mostBelowUf.stats[yi].below > 0 && (
                  <>
                    ; o maior número, em <span className="text-foreground">{ufLink(mostBelowUf)}</span> ({mostBelowUf.stats[yi].below})
                  </>
                )}
                .
              </>
            )}
          </p>
          {PANDEMIC_YEARS.has(year) && (
            <p className="flex max-w-4xl items-start gap-2.5 rounded-lg border bg-warning-soft px-3 py-2 text-[13px] leading-5 text-warning-ink">
              <StatusDot kind="edge" className="mt-1.5" />
              <span>
                <strong className="font-semibold">Atenção:</strong> pela EC 119/2022, quem ficou abaixo de 25% em 2020–2021 (pandemia) não é punido se compensar a
                diferença até 2023.
              </span>
            </p>
          )}
        </div>

        <section aria-label={`Indicadores de ${year}`} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Abaixo dos 25%"
            value={int(s.below)}
            sub={`de ${int(s.reported)} municípios com dados`}
            tone={s.below ? "bad" : "neutral"}
            delta={dBelow.node}
            deltaTone={dBelow.tone}
            context={ctx((p) => `${share(p.below, p.reported)} abaixo`)}
            spark={<Spark values={stats.map((x) => x.below)} index={yi} color={red} />}
          />
          <Stat
            label="Deixou de ir para a educação"
            value={short.value}
            sub={short.note ?? "soma do que faltou para chegar a 25%"}
            tone={s.shortfall ? "bad" : "neutral"}
            delta={dShort.node}
            deltaTone={dShort.tone}
            spark={<Spark values={stats.map(shortfallKnown)} index={yi} color={red} />}
          />
          <Stat
            label="Moram nesses municípios"
            value={s.popBelow >= 1e6 ? `${(s.popBelow / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : int(s.popBelow)}
            sub={`pessoas (${share(s.popBelow, s.pop)} da população)`}
            delta={dPop.node}
            deltaTone={dPop.tone}
            spark={<Spark values={stats.map((x) => x.popBelow)} index={yi} color={ink} />}
          />
          <Stat
            label="Mediana aplicada em MDE"
            value={pct(s.median)}
            sub={`metade entre ${pct(s.p25, 1)} e ${pct(s.p75, 1)}`}
            delta={dMedian.node}
            deltaTone={dMedian.tone}
            context={ctx((p) => pct(p.median))}
            spark={<Spark values={stats.map((x) => x.median)} index={yi} color={ink} />}
          />
          <Stat
            className="col-span-2 lg:col-span-1"
            label={`Fundeb abaixo de ${funMin(year)}% em salários`}
            value={int(s.funBelow)}
            sub={`de ${int(s.funReported)} municípios`}
            tone={s.funBelow ? "bad" : "neutral"}
            delta={dFun.node}
            deltaTone={dFun.tone}
            context={ctx((p) => `${share(p.funBelow, p.funReported)} abaixo`)}
            spark={<Spark values={stats.map((x) => x.funBelow)} index={yi} color={red} />}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <Panel
            className="lg:col-span-3"
            title={`Mapa · ${scopeLabel}`}
            description={`Passe o mouse para ver os números; clique para descer de nível (${region ? "estado ou município" : "estado → município"}).`}
            action={<span className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{year}</span>}
          >
            <TerritoryMap ufs={ufs} years={years} year={year} rows={all} rowsError={rowsError} defaultMode={region ? "mun" : "uf"} ufCodes={ufCodes} ariaScope={region ? `da região ${getRegion(region).name}` : "do Brasil"} />
          </Panel>
          <Panel
            className="lg:col-span-2"
            title={regions ? "Por região" : "Estados da região"}
            description={`% dos municípios abaixo de 25% em ${year} e a série desde ${years[0]} (mesma escala).`}
          >
            <UfMultiples
              cols={regions ? "sm:grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"}
              years={years}
              year={year}
              items={
                regions
                  ? regions.map((r) => ({ key: r.key, title: r.name, subtitle: r.ufs.join(" · "), href: withYear(regionPath(r.key), year, initialYear), stats: r.stats }))
                  : ufs.map((u) => ({ key: u.uf, title: u.name, subtitle: u.uf, href: withYear(ufPath(u.uf), year, initialYear), stats: u.stats }))
              }
            />
          </Panel>
        </section>

        <Panel
          divided
          title={`Evolução ${years[0]}–${years[years.length - 1]}`}
          description="Clique num ano do gráfico para atualizar o painel. 2020–2021: anos da pandemia (EC 119/2022)."
        >
          <div
            ref={tabs}
            role="tablist"
            aria-label="Indicador da série"
            className="grid grid-cols-3 border-b"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); moveTab(1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); moveTab(-1); }
            }}
          >
            {TRENDS.map((x) => {
              const on = trend === x.key;
              const v = x.of(s);
              return (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  id={`trend-tab-${x.key}`}
                  aria-selected={on}
                  aria-controls="trend-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTrend(x.key)}
                  className={cn(
                    "relative min-w-0 border-r px-2.5 py-3 text-left transition-colors duration-150 last:border-r-0 sm:px-5 sm:py-4",
                    on ? "bg-card" : "bg-muted/40 hover:bg-accent/60",
                    "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors",
                    on ? "after:bg-foreground" : "after:bg-transparent",
                  )}
                >
                  <span className={cn("block truncate text-xs sm:text-[13px]", on ? "text-foreground" : "text-muted-foreground")}>
                    <span className="sm:hidden">{x.tiny}</span>
                    <span className="hidden sm:inline">{x.label}</span>
                  </span>
                  <span className={cn("mt-1 block truncate text-base leading-7 font-semibold tracking-[-0.03em] tnum sm:text-[22px]", !on && "text-muted-foreground")}>
                    {v == null ? "—" : x.show(v)}
                  </span>
                </button>
              );
            })}
          </div>
          <div id="trend-panel" role="tabpanel" aria-labelledby={`trend-tab-${trend}`} className="px-2 pt-4 pb-3 sm:px-4">
            <MultiLine years={years} series={trendSeries} selected={year} onSelect={setYear} fmt={t.fmt} ariaLabel={`${t.label} por ano, ${scopeLabel}`} min={trend === "median" ? 20 : 0} band={{ from: 2020, to: 2021, label: "pandemia" }} />
          </div>
        </Panel>

        {regions && (
          <Panel title="Todos os estados" description="% dos municípios abaixo de 25% em cada ano, mesma escala em todos os quadros. Clique para abrir o estado.">
            <UfMultiples
              years={years}
              year={year}
              items={ufs.map((u) => ({ key: u.uf, title: u.name, subtitle: `${u.uf} · ${getRegion(u.region).name}`, href: withYear(ufPath(u.uf), year, initialYear), stats: u.stats }))}
            />
          </Panel>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel className="lg:col-span-2" title={`Distribuição dos municípios · ${year}`} description="Quantos municípios aplicaram cada percentual da receita de impostos em MDE.">
            {scoped ? (
              <Histogram values={dist} ariaLabel={`Distribuição do percentual aplicado em MDE, ${scopeLabel}, ${year}`} />
            ) : rowsError ? (
              <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed text-[13px] text-muted-foreground" role="status">
                Não foi possível carregar os municípios.
              </div>
            ) : (
              <Skeleton className="h-[220px] w-full rounded-lg" role="status" aria-label="Carregando…" />
            )}
          </Panel>
          <Panel divided title="Maiores déficits acumulados" description={`Saldo estimado que faltou para 25% desde ${years[0]}, descontado o que foi aplicado a mais depois.`}>
            {deficits.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-muted-foreground sm:px-5">Nenhum déficit acumulado.</p>
            ) : (
              <ol className="scroll-thin max-h-[23rem] divide-y overflow-y-auto">
                {deficits.map((d, i) => (
                  <li key={d.id}>
                    <Link href={cityPath(d.uf, d.slug)} className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/60 sm:px-5">
                      <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tnum">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{d.name}</span>
                          <span className="shrink-0 rounded border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{d.uf}</span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground tnum">
                          {d.below.length} {d.below.length === 1 ? "ano" : "anos"} abaixo: {d.below.slice(-4).join(", ")}
                          {d.below.length > 4 ? "…" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-critical tnum">{brlShort(d.carry)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </section>

        <Panel
          divided
          title={`Ranking dos estados · ${year}`}
          description="Clique no cabeçalho para ordenar. “Governo estadual” é o percentual aplicado pelo próprio estado na sua rede."
        >
          <UfTable ufs={ufs} years={years} year={year} showRegion={!region} />
        </Panel>
      </PageBody>
    </>
  );
}
