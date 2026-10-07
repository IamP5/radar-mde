"use client";

import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown, Info, Search, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import Choropleth, { Legend } from "./Choropleth";
import Histogram from "./Histogram";
import MultiLine from "./MultiLine";
import YearBars from "./YearBars";
import YearPicker, { useYear, withYear } from "./YearPicker";
import { Panel } from "@/components/kit/panel";
import { Segmented } from "@/components/kit/segmented";
import { Stat } from "@/components/kit/stat";
import { StatusBadge, type StatusKind } from "@/components/kit/status";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BINS, METRICS, binColor, colorOf, funBins, isBelowBin, quintileBins, type Bin, type MetricKey } from "@/lib/bins";
import { MDE_MIN, PANDEMIC_YEARS, POP_BANDS, brlShort, funMin, int, isAtypical, normKey, pct, share } from "@/lib/format";
import { cityPath, getRegion, getUf, ofUf, type RegionKey } from "@/lib/geo";
import { belowShare, isAtip, shortfallLabel, timesBelow, type Deficit, type Row, type Stats } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { fromColumns, type Columns } from "./territory/pack";
import { ShortfallInfo } from "./territory/InfoTip";

type Props = {
  uf: string;
  years: number[];
  initialYear: number;
  /** municipalities, column-keyed to keep the inlined RSC payload small (see territory/pack.ts) */
  rows: Columns<Row>;
  stats: Stats[];
  regionStats: Stats[];
  brStats: Stats[];
  /** state government's own MDE % and Fundeb % per year */
  gov: { mde: (number | null)[]; fun: (number | null)[] };
  deficits: Deficit[];
};

type SortKey = "name" | "pop" | "mde" | "fun" | "short" | "reinc" | "aluno";
type StatusFilter = "all" | "below" | "edge" | "ok" | "nd" | "nodata" | "fun" | "div";
type ReincFilter = "all" | "2" | "2x" | "3" | "5";
const STATUSES: StatusFilter[] = ["all", "below", "edge", "ok", "nd", "nodata", "fun", "div"];
const REINCS: Record<ReincFilter, string> = {
  all: "Qualquer histórico",
  "2": "2+ anos abaixo de 25%",
  "2x": "2+ anos fora de 2020–21",
  "3": "3+ anos abaixo de 25%",
  "5": "5+ anos abaixo de 25%",
};
const SORTS: SortKey[] = ["name", "pop", "mde", "fun", "short", "reinc", "aluno"];
const belowKeys = (b: Bin) => /^(b1|b2|f1|f2)$/.test(b.key);
/** "…, 2021, 2022, 2023, 2025": the most recent years, ellipsis in front when older ones are omitted. */
const lastYears = (ys: number[]) => `${ys.length > 4 ? "…, " : ""}${ys.slice(-4).join(", ")}`;
/** Years below 25%, optionally ignoring the pandemic years covered by EC 119/2022. */
const yearsBelowOf = (r: Row, skipPandemic: boolean, years: number[]) =>
  r.mde.reduce<number>((n, v, i) => n + (v != null && v < MDE_MIN && !(skipPandemic && PANDEMIC_YEARS.has(years[i])) ? 1 : 0), 0);

const PAGE = 50;
const fmtBrl = (v: number) => (v > 0 ? brlShort(v) : "—");
const pct1 = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

function rowStatus(r: Row, yi: number, year: number): { kind: StatusKind; label: string } {
  const v = r.mde[yi];
  if (r.since != null && year < r.since) return { kind: "nd", label: "Não existia" };
  if (r.nd[yi]) return { kind: "below", label: "Não declarou" };
  if (v == null) return { kind: "nd", label: "Sem dados" };
  if (v < MDE_MIN) return { kind: "below", label: "Abaixo" };
  if (v < MDE_MIN + 1) return { kind: "edge", label: "No limite" };
  return { kind: "ok", label: "Cumpre" };
}

export default function UfDashboard({ uf, years, initialYear, rows: packed, stats, regionStats, brStats, gov, deficits }: Props) {
  const rows = useMemo(() => fromColumns(packed), [packed]);
  const [yearNow, setYear] = useYear(years, initialYear);
  // the picker answers at once; the dashboard (charts, map, tables) follows as a low-priority render (INP)
  const year = useDeferredValue(yearNow);
  const [q, setQ] = useState("");
  const [inter, setInter] = useState("all");
  const [band, setBand] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rec, setRec] = useState<ReincFilter>("all");
  const [metric, setMetric] = useState<MetricKey>("mde");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "mde", dir: 1 });

  // GOV-06: table filters and sort live in the URL (read after mount, so the HTML stays static)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const has = (k: string) => p.get(k) ?? "";
    /* eslint-disable react-hooks/set-state-in-effect -- URL is only readable after hydration */
    if (has("q")) setQ(has("q").slice(0, 80));
    if (has("regint") && rows.some((r) => r.inter === has("regint"))) setInter(has("regint"));
    if (POP_BANDS.some((b) => b.key === has("porte"))) setBand(has("porte"));
    if (STATUSES.includes(has("situacao") as StatusFilter)) setStatus(has("situacao") as StatusFilter);
    if (has("reinc") in REINCS) setRec(has("reinc") as ReincFilter);
    const [k, d] = has("ordem").split("-");
    if (SORTS.includes(k as SortKey)) setSort({ key: k as SortKey, dir: d === "desc" ? -1 : 1 });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [rows]);
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- write the URL only after it has been read
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!hydrated) return;
    const u = new URL(window.location.href);
    const set = (k: string, v: string, def: string) => (v === def ? u.searchParams.delete(k) : u.searchParams.set(k, v));
    set("q", q.trim(), "");
    set("regint", inter, "all");
    set("porte", band, "all");
    set("situacao", status, "all");
    set("reinc", rec, "all");
    set("ordem", `${sort.key}-${sort.dir === 1 ? "asc" : "desc"}`, "mde-asc");
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, "", u);
  }, [hydrated, q, inter, band, status, rec, sort]);
  const [limit, setLimit] = useState(PAGE);
  const yi = years.indexOf(year);
  const info = getUf(uf)!;
  const region = getRegion(info.region as RegionKey);
  const s = stats[yi];
  const prev = yi > 0 ? stats[yi - 1] : null;
  const hasAlt = rows.some((r) => r.alt);

  const inters = useMemo(() => [...new Set(rows.map((r) => r.inter))].sort((a, b) => a.localeCompare(b, "pt-BR")), [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const reinc = useMemo(() => new Map(rows.map((r) => [r.id, timesBelow(r)])), [rows]);
  const reincX = useMemo(() => new Map(rows.map((r) => [r.id, yearsBelowOf(r, true, years)])), [rows, years]);

  const perYear = useMemo(() => stats.map((st, i) => ({ year: years[i], below: st.below, reported: st.reported, nd: st.nd })), [stats, years]);

  const bins = useMemo(
    () => (metric === "mde" ? BINS : metric === "fun" ? funBins(year) : quintileBins(rows.map((r) => r.aluno[yi]).filter((v): v is number => v != null))),
    [metric, year, rows, yi],
  );
  const fill = useCallback((id: number) => colorOf(bins, byId.get(id)?.[metric][yi]), [bins, byId, metric, yi]);
  const hatched = useCallback((id: number) => metric === "mde" && !!byId.get(id)?.nd[yi], [metric, byId, yi]);
  const outlined = useCallback((id: number) => metric !== "aluno" && isBelowBin(bins, byId.get(id)?.[metric][yi]), [bins, byId, metric, yi]);
  const href = useCallback((id: number) => {
    const r = byId.get(id);
    return r ? withYear(cityPath(r.uf, r.slug), year, initialYear) : null;
  }, [byId, year, initialYear]);
  const m = METRICS.find((x) => x.key === metric)!;

  const filtered = useMemo(() => {
    const nq = normKey(q);
    const b = POP_BANDS.find((x) => x.key === band);
    const out = rows.filter((r) => {
      if (nq && !normKey(r.name).includes(nq)) return false;
      if (rec !== "all") {
        const n = rec === "2x" ? reincX.get(r.id) ?? 0 : reinc.get(r.id) ?? 0;
        if (n < (rec === "2x" ? 2 : Number(rec))) return false;
      }
      if (inter !== "all" && r.inter !== inter) return false;
      if (b && !b.test(r.pop)) return false;
      const v = r.mde[yi];
      switch (status) {
        case "below": return v != null && v < MDE_MIN;
        case "edge": return v != null && v >= MDE_MIN && v < MDE_MIN + 1;
        case "ok": return v != null && v >= MDE_MIN + 1;
        case "nd": return r.nd[yi];
        case "nodata": return v == null && !r.nd[yi];
        case "fun": return r.fun[yi] != null && r.fun[yi]! < funMin(year);
        case "div": return r.alt?.[yi] != null;
      }
      return true;
    });
    const val = (r: Row): number | string | null => {
      switch (sort.key) {
        case "name": return normKey(r.name);
        case "pop": return r.pop;
        case "mde": return r.mde[yi];
        case "fun": return r.fun[yi];
        case "short": return r.short[yi];
        case "reinc": return reinc.get(r.id) ?? 0;
        case "aluno": return r.aluno[yi];
      }
    };
    return out.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls last regardless of direction
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, q, inter, band, status, rec, sort, yi, year, reinc, reincX]);

  const filtering = q !== "" || inter !== "all" || band !== "all" || status !== "all" || rec !== "all";
  const reset = () => { setQ(""); setInter("all"); setBand("all"); setStatus("all"); setRec("all"); setLimit(PAGE); };

  const th = (key: SortKey, label: string, right = false, className?: string) => {
    const on = sort.key === key;
    const Icon = on ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <TableHead
        scope="col"
        className={cn("sticky top-0 z-10 h-10 bg-card px-3 text-[13px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]", right && "text-right", className)}
        aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          className={cn("-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 whitespace-nowrap transition-colors duration-150 hover:bg-accent hover:text-foreground", right && "flex-row-reverse", on && "text-foreground")}
          onClick={() => setSort((x) => ({ key, dir: x.key === key ? (x.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}
        >
          <span>{label}</span>
          <Icon aria-hidden className={cn("size-3", !on && "opacity-40")} />
        </button>
      </TableHead>
    );
  };

  const dBelow = prev ? s.below - prev.below : null;
  const govV = gov.mde[yi];
  const dist = rows.map((r) => r.mde[yi]).filter((v): v is number => v != null);
  const biggest = rows.reduce((a, b) => (b.pop > a.pop ? b : a), rows[0]);

  return (
    <>
      <div data-subbar className="sticky top-(--header-h) z-30 border-b bg-(--header-bg) backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <YearPicker years={years} year={yearNow} onChange={setYear} />
          <div className="hidden items-center gap-3 text-[13px] text-muted-foreground tnum md:flex">
            <span>
              <span className={cn("font-medium", s.below ? "text-critical-ink" : "text-foreground")}>{int(s.below)}</span> de {int(s.reported)} abaixo de 25%
              {s.nd > 0 && <> · {int(s.nd)} não declararam</>}
            </span>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <Link href={withYear(`/regiao/${region.slug}`, year, initialYear)} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              Região {region.name} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8">
        <div className="space-y-3">
          <p className="max-w-4xl text-[15px] leading-7 text-pretty text-muted-foreground">
            Em <strong className="font-medium text-foreground">{year}</strong>,{" "}
            {s.below === 0 ? (
              <>
                <strong className="font-medium text-foreground">nenhum</strong> dos {int(s.reported)} municípios {ofUf(uf)} que declararam aplicou menos de
                25% em educação
              </>
            ) : (
              <>
                <strong className="font-medium text-critical">
                  {int(s.below)} de {int(s.reported)} municípios
                </strong>{" "}
                {ofUf(uf)} que declararam ({share(s.below, s.reported)}) {s.below === 1 ? "aplicou" : "aplicaram"} menos de 25% em educação
              </>
            )}
            {s.shortfall > 0 ? (
              <>
                ; faltaram {s.belowNoBase ? "ao menos " : "cerca de "}
                <strong className="font-medium text-foreground">{brlShort(s.shortfall)}</strong> para atingir o mínimo (estimativa)
              </>
            ) : ""}
            .{" "}
            {s.nd > 0 && (
              <>
                <strong className="font-medium text-critical">
                  {int(s.nd)} {s.nd === 1 ? "município não declarou" : "municípios não declararam"}
                </strong>{" "}
                os dados do ano.{" "}
              </>
            )}
            Na região {region.name}, {pct1(belowShare(regionStats[yi]))} ficaram abaixo; no Brasil, {pct1(belowShare(brStats[yi]))}.
            {govV != null && (
              <>
                {" "}O governo estadual aplicou <strong className={cn("font-medium", govV < MDE_MIN ? "text-critical" : "text-foreground")}>{pct(govV)}</strong> na própria rede.
              </>
            )}
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            Exibindo {year}: {int(s.below)} de {int(s.reported)} municípios abaixo de 25%{s.nd ? `, ${int(s.nd)} não declararam` : ""}; mediana {pct(s.median)}.
          </p>
          {PANDEMIC_YEARS.has(year) && (
            <Callout>
              <strong className="font-medium text-foreground">Atenção:</strong> pela EC 119/2022, quem ficou abaixo de 25% em 2020–2021 (pandemia) não é
              punido se compensar a diferença até 2023.
            </Callout>
          )}
        </div>

        <section aria-label={`Indicadores de ${year}`} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Abaixo dos 25%"
            value={int(s.below)}
            sub={
              <>
                de {int(s.reported)} com dados
                {s.nd > 0 && <span className="block font-medium text-critical-ink">+ {int(s.nd)} não declararam</span>}
              </>
            }
            tone={s.below ? "bad" : "neutral"}
            delta={dBelow != null ? (dBelow === 0 ? `= ${years[yi - 1]}` : `${dBelow > 0 ? "+" : "−"}${Math.abs(dBelow)} vs ${years[yi - 1]}`) : undefined}
            // fewer below is only "good" when it isn't because more municipalities stopped declaring (GOV-11)
            deltaTone={dBelow == null || dBelow === 0 ? "neutral" : dBelow > 0 ? "bad" : prev && s.nd > prev.nd ? "neutral" : "good"}
            context={`${region.name}: ${pct1(belowShare(regionStats[yi]))} · Brasil: ${pct1(belowShare(brStats[yi]))}`}
          />
          <Stat
            label={
              <span className="inline-flex items-center gap-1">
                Faltou aplicar (estimativa)
                <ShortfallInfo />
              </span>
            }
            value={shortfallLabel(s).value}
            sub={
              <>
                {shortfallLabel(s).note ?? `em ${year}, valores declarados e nominais`}
                {s.shortfallAtip > 0 && <span className="block">dos quais {brlShort(s.shortfallAtip)} de valores atípicos</span>}
              </>
            }
            tone={s.shortfall ? "bad" : "neutral"}
          />
          <Stat label="Mediana aplicada" value={pct(s.median)} sub={`metade entre ${pct(s.p25, 1)} e ${pct(s.p75, 1)}`} context={`Brasil: ${pct(brStats[yi].median)}`} />
          <Stat
            label="Mediana por aluno"
            value={s.alunoMedian ? `R$ ${int(Math.round(s.alunoMedian))}` : "—"}
            sub="por ano, valor nominal"
            context={brStats[yi].alunoMedian ? `Brasil: R$ ${int(Math.round(brStats[yi].alunoMedian!))}` : undefined}
          />
          <Stat
            className="col-span-2 lg:col-span-1"
            label="Governo do estado"
            value={pct(govV)}
            sub={govV == null ? "sem dado do governo estadual neste ano" : "aplicado em MDE na rede estadual"}
            tone={govV != null && govV < MDE_MIN ? "bad" : "neutral"}
            context={gov.fun[yi] != null ? `Fundeb em salários: ${pct(gov.fun[yi], 1)}` : undefined}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <Panel
            className="lg:col-span-3"
            title={`Mapa de ${year}`}
            description="Toque ou passe o mouse para ver o valor; toque de novo ou clique para abrir o município."
            action={
              <Segmented
                ariaLabel="Indicador do mapa"
                value={metric}
                onChange={setMetric}
                options={METRICS.map((x) => ({ value: x.key, label: x.key === "mde" ? "MDE" : x.key === "fun" ? "Fundeb" : "Por aluno", title: x.label }))}
              />
            }
          >
            <Choropleth
              src={uf}
              layer="mun"
              fill={fill}
              hatched={hatched}
              outlined={outlined}
              describedBy="municipios-tabela"
              href={href}
              ariaLabel={`Mapa dos municípios ${ofUf(uf)}: ${m.label}, ${year}`}
              height={520}
              tooltip={(id) => {
                const r = byId.get(id);
                if (!r) return <div className="text-muted-foreground">Sem dados</div>;
                const v = r[metric][yi];
                return (
                  <>
                    <div className="text-base font-semibold tnum">
                      {metric === "mde" && r.nd[yi] ? <span className="text-critical">Não declarou</span> : v == null ? (r.since != null && year < r.since ? "Não existia" : "Sem dados") : m.fmt(v)}
                    </div>
                    {metric !== "fun" && (isAtip(r, yi, metric === "aluno" ? "aluno" : "mde") || (metric === "mde" && isAtypical(v))) && <div className="text-xs text-warning-ink">Valor atípico: possível erro de preenchimento</div>}
                    <div className="text-muted-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground tnum">{int(r.pop)} hab. · {r.inter}</div>
                  </>
                );
              }}
            />
            <Legend title={m.label} bins={bins} nd={metric === "mde"} outlined={metric === "aluno" ? undefined : belowKeys} />
            <p className="mt-3 text-xs text-muted-foreground">
              {metric !== "aluno" && "Contorno escuro: abaixo do mínimo legal. "}
              Os mesmos números em tabela:{" "}
              <a href="#municipios" className="font-medium text-brand-ink underline-offset-2 hover:underline">
                todos os municípios
              </a>
            </p>
          </Panel>
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <Panel title="Municípios abaixo dos 25%, por ano" description="Toque ou clique numa barra para mudar o exercício.">
              <YearBars data={perYear} selected={year} onSelect={setYear} />
            </Panel>
            <Panel title={`Distribuição em ${year}`} description="Quantos municípios aplicaram cada percentual em MDE.">
              <Histogram values={dist} width={420} height={210} ariaLabel={`Distribuição do percentual aplicado em MDE ${ofUf(uf)}, ${year}`} />
            </Panel>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title={`${info.name} frente à região e ao país`}
            description="% dos municípios que declararam e ficaram abaixo de 25%. Toque ou clique num ano para atualizar o painel."
          >
            <MultiLine
              years={years}
              selected={year}
              onSelect={setYear}
              fmt={(v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              ariaLabel={`Percentual de municípios abaixo de 25%: ${info.name}, região ${region.name} e Brasil`}
              series={[
                { key: uf, label: info.name, color: "var(--series-1)", values: stats.map(belowShare) },
                { key: region.key, label: region.name, color: "var(--series-2)", values: regionStats.map(belowShare) },
                { key: "BR", label: "Brasil", color: "var(--ink)", values: brStats.map(belowShare), emphasis: true },
              ]}
            />
          </Panel>
          <Panel
            title={`Maiores déficits acumulados até ${years[years.length - 1]}`}
            description={`Estimativa de ${years[0]} a ${years[years.length - 1]}, descontado o que foi aplicado a mais depois (valores nominais). Não muda com o ano escolhido.`}
            divided
          >
            <ol className="scroll-thin fade-b max-h-[22rem] overflow-y-auto p-1.5 pb-6 text-sm">
              {deficits.map((d, i) => (
                <li key={d.id}>
                  <Link href={withYear(cityPath(d.uf, d.slug), year, initialYear)} className="flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-150 hover:bg-accent/60">
                    <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tnum">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{d.name}</span>
                      <span className="block truncate text-xs text-muted-foreground" title={d.below.join(", ")}>
                        {d.below.length} {d.below.length === 1 ? "ano" : "anos"} abaixo: {lastYears(d.below)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-critical tnum">{brlShort(d.carry)}</span>
                  </Link>
                </li>
              ))}
              {deficits.length === 0 && <li className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">Nenhum município com déficit acumulado.</li>}
            </ol>
          </Panel>
        </section>

        <Panel
          id="municipios"
          title="Todos os municípios"
          description={`Valores de ${year}. Ordene pelo cabeçalho; abra o município pelo nome. Filtros e ordem ficam no endereço da página, para compartilhar.`}
          divided
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Search className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                value={q}
                onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
                placeholder={`Buscar, ex.: ${biggest.name}`}
                aria-label="Buscar município"
              />
              {q && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label="Limpar busca" onClick={() => setQ("")}>
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <FilterSelect
              label="Região intermediária (IBGE)"
              value={inter}
              onChange={(v) => { setInter(v); setLimit(PAGE); }}
              items={{ all: "Todas as regiões", ...Object.fromEntries(inters.map((r) => [r, r])) }}
              className="w-full sm:w-auto sm:max-w-60"
            />
            <FilterSelect
              label="População"
              value={band}
              onChange={(v) => { setBand(v); setLimit(PAGE); }}
              items={{ all: "Qualquer população", ...Object.fromEntries(POP_BANDS.map((b) => [b.key, b.label])) }}
            />
            <FilterSelect
              label={`Situação em ${year}`}
              value={status}
              onChange={(v) => { setStatus(v as StatusFilter); setLimit(PAGE); }}
              items={{
                all: "Qualquer situação",
                below: "Abaixo de 25%",
                edge: "No limite (25–26%)",
                ok: "26% ou mais",
                fun: "Fundeb abaixo do mínimo",
                nd: "Não declarou",
                nodata: "Sem dados",
                ...(hasAlt ? { div: "SIOPE ≠ Tesouro" } : {}),
              }}
            />
            <FilterSelect
              label="Reincidência (anos abaixo de 25%, 2008–2025)"
              value={rec}
              onChange={(v) => { setRec(v as ReincFilter); setLimit(PAGE); }}
              items={REINCS}
            />
            {filtering && (
              <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
                <X /> Limpar
              </Button>
            )}
            <div className="ml-auto text-[13px] text-muted-foreground tnum" role="status" aria-live="polite">
              {filtered.length === rows.length ? `${int(rows.length)} municípios` : `${int(filtered.length)} de ${int(rows.length)}`}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="text-sm font-medium">Nenhum município encontrado</div>
              <p className="mt-1 text-[13px] text-muted-foreground">Ajuste a busca ou os filtros.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={reset}>Limpar filtros</Button>
            </div>
          ) : (
            <div id="municipios-tabela" className="scroll-thin relative max-h-[42rem] overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <caption className="sr-only">Municípios {ofUf(uf)} em {year}</caption>
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    {th("name", "Município", false, "left-0 z-20 min-w-36 pl-4 sm:min-w-44 sm:pl-5")}
                    {th("pop", "População", true, "hidden sm:table-cell")}
                    {th("mde", `MDE ${year}`, true)}
                    <TableHead scope="col" className="sticky top-0 z-10 h-10 bg-card px-3 text-[13px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                      Situação
                    </TableHead>
                    {th("fun", "Fundeb pessoal", true)}
                    {th("aluno", "R$ por aluno", true)}
                    {th("short", "Faltou", true)}
                    {th("reinc", rec === "2x" ? "Anos < 25% (fora 2020–21)" : "Anos < 25%", true, "pr-4 sm:pr-5")}
                  </TableRow>
                </TableHeader>
                <TableBody className="tnum">
                  {filtered.slice(0, limit).map((r) => {
                    const v = r.mde[yi];
                    const alt = r.alt?.[yi];
                    const st = rowStatus(r, yi, year);
                    const funLow = r.fun[yi] != null && r.fun[yi]! < funMin(year);
                    return (
                      <TableRow key={r.id} className="group hover:bg-accent/60">
                        <TableCell className="sticky left-0 z-[1] max-w-56 bg-card py-2 pr-3 pl-4 transition-colors group-hover:bg-[color-mix(in_oklab,var(--accent)_60%,var(--card))] sm:pl-5">
                          <Link href={withYear(cityPath(r.uf, r.slug), year, initialYear)} className="block truncate font-medium hover:underline">
                            {r.name}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">{r.inter}</div>
                        </TableCell>
                        <TableCell className="hidden px-3 text-right text-muted-foreground sm:table-cell">{int(r.pop)}</TableCell>
                        <TableCell className="px-3 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {(isAtip(r, yi) || isAtypical(v)) && (
                              <Hint label="Valor atípico: possível erro de preenchimento, confira na fonte">
                                <TriangleAlert className="size-3.5 text-warning" />
                              </Hint>
                            )}
                            {alt != null && (
                              <Hint label={`O relatório ao Tesouro informa ${pct(alt)}`}>
                                <span className="font-mono text-xs text-muted-foreground">≠</span>
                              </Hint>
                            )}
                            <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: r.nd[yi] ? "var(--critical)" : binColor(v) }} />
                            <span className={cn("font-medium", v != null && v < MDE_MIN && "text-critical")}>{r.nd[yi] ? "—" : pct(v)}</span>
                          </span>
                        </TableCell>
                        <TableCell className="px-3">
                          <StatusBadge kind={st.kind} dot={st.kind !== "nd"}>{st.label}</StatusBadge>
                        </TableCell>
                        <TableCell className={cn("px-3 text-right", funLow && "text-critical")}>{pct(r.fun[yi])}</TableCell>
                        <TableCell className="px-3 text-right">{r.aluno[yi] ? `R$ ${int(r.aluno[yi]!)}` : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className={cn("px-3 text-right", r.short[yi] ? "font-medium text-critical" : "text-muted-foreground")}>
                          {r.short[yi] == null ? (
                            <Hint label="Abaixo de 25%, mas sem receita declarada para estimar o valor">
                              <span className="text-muted-foreground">s/ base</span>
                            </Hint>
                          ) : fmtBrl(r.short[yi]!)}
                        </TableCell>
                        <TableCell className="pr-4 pl-3 text-right sm:pr-5">
                          {(rec === "2x" ? reincX : reinc).get(r.id) || <span className="text-muted-foreground">0</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
          )}
          {filtered.length > PAGE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
              <span className="tnum">
                Mostrando {int(Math.min(limit, filtered.length))} de {int(filtered.length)}
              </span>
              <div className="flex gap-2">
                {limit > PAGE && (
                  <Button variant="ghost" size="sm" onClick={() => setLimit(PAGE)}>Mostrar menos</Button>
                )}
                {filtered.length > limit && (
                  <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 100)}>
                    Mostrar mais {int(Math.min(100, filtered.length - limit))}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function FilterSelect({
  label, value, onChange, items, className,
}: { label: string; value: string; onChange: (v: string) => void; items: Record<string, string>; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string | null) ?? "all")} items={items}>
      <SelectTrigger aria-label={label} title={label} className={cn("min-w-0 max-w-full", value !== "all" && "border-foreground/30 text-foreground", className)}>
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="w-auto max-w-[min(22rem,calc(100vw-2rem))]">
        {Object.entries(items).map(([k, l]) => (
          <SelectItem key={k} value={k}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} aria-label={label} className="inline-flex cursor-help items-center" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-4xl gap-2.5 rounded-lg border bg-muted/50 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
