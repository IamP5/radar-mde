"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Download, PlusCircle, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { StatusBadge, type StatusKind } from "@/components/kit/status";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useYear } from "@/components/YearPicker";
import { BINS, binColor } from "@/lib/bins";
import { MDE_MIN, POP_BANDS, brlShort, funMin, int, norm, pct, popBand, share } from "@/lib/format";
import { REGIONS, UFS, cityPath, getRegion, getRegionBySlug, getUf, type RegionKey } from "@/lib/geo";
import { aggregate, loadAllRows, timesBelow, type Row, shortfallLabel } from "@/lib/rows";
import { cn } from "@/lib/utils";

type Situation = "all" | "below" | "edge" | "ok" | "nd" | "missing" | "fun";
type Sit = Exclude<Situation, "all" | "fun">;
type SortKey = "name" | "pop" | "mde" | "sit" | "fun" | "aluno" | "short" | "times";
type Item = { r: Row; key: string; region: RegionKey | undefined; regionSlug: string; band: string; times: number };
type Data = { years: number[]; items: Item[] };

const PAGE = 100;
const MORE = 200;
const ALL = "*";
const collator = new Intl.Collator("pt-BR");
const UFS_BY_NAME = [...UFS].sort((a, b) => collator.compare(a.name, b.name));

const SITUATIONS: { key: Situation; label: string }[] = [
  { key: "below", label: "Abaixo de 25%" },
  { key: "edge", label: "No limite (25–26%)" },
  { key: "ok", label: "26% ou mais" },
  { key: "nd", label: "Não declarou" },
  { key: "missing", label: "Sem dados" },
  { key: "fun", label: "Fundeb abaixo do mínimo" },
];

const SIT_BADGE: Record<Sit, { kind: StatusKind; label: string }> = {
  below: { kind: "below", label: "Abaixo" },
  edge: { kind: "edge", label: "No limite" },
  ok: { kind: "ok", label: "Cumpriu" },
  nd: { kind: "nd", label: "Não declarou" },
  missing: { kind: "nd", label: "Sem dados" },
};
const SIT_ORDER: Record<Sit, number> = { below: 0, nd: 1, edge: 2, ok: 3, missing: 4 };

function situationOf(r: Row, yi: number): Sit {
  const v = r.mde[yi];
  if (v == null) return r.nd[yi] ? "nd" : "missing";
  if (v < MDE_MIN) return "below";
  return v < MDE_MIN + 1 ? "edge" : "ok";
}

const CSV_SITUATION: Record<Sit, string> = {
  below: "abaixo do mínimo",
  edge: "no limite",
  ok: "cumpriu",
  nd: "não declarou",
  missing: "sem dados",
};

function sortValue(it: Item, k: SortKey, yi: number): number | string | null {
  const r = it.r;
  switch (k) {
    case "name": return it.key;
    case "pop": return r.pop;
    case "mde": return r.mde[yi];
    case "sit": return SIT_ORDER[situationOf(r, yi)];
    case "fun": return r.fun[yi];
    case "aluno": return r.aluno[yi];
    case "short": return r.short[yi];
    case "times": return it.times;
  }
}

const csvCell = (v: string | number | null) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(rows: Row[], years: number[]) {
  const head = ["ibge", "municipio", "uf", "regiao_intermediaria", "populacao", "ano", "mde_pct", "fundeb_pessoal_pct", "por_aluno_rs", "faltou_rs", "situacao"];
  const lines = [head.join(",")];
  for (const r of rows) {
    years.forEach((y, i) => {
      const short = r.short[i];
      lines.push(
        [r.id, r.name, r.uf, r.inter, r.pop, y, r.mde[i], r.fun[i], r.aluno[i], short == null ? "" : Math.round(short), CSV_SITUATION[situationOf(r, i)]]
          .map(csvCell)
          .join(","),
      );
    });
  }
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "radar-mde-explorar.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Keeps Região/UF in the query string so filtered views can be shared. */
function syncUrl(regiao: string, uf: string) {
  const u = new URL(window.location.href);
  if (regiao) u.searchParams.set("regiao", regiao);
  else u.searchParams.delete("regiao");
  if (uf) u.searchParams.set("uf", uf);
  else u.searchParams.delete("uf");
  window.history.replaceState(window.history.state, "", u);
}

const fmtPop = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : int(v));

type Facets = {
  regiao: Map<string, number>;
  uf: Map<string, number>;
  porte: Map<string, number>;
  sit: Map<string, number>;
  reinc: number;
  filtered: Item[];
};

const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** National table of every municipality: filter, slice, re-aggregate and export. */
export default function Explorer({ years, initialYear }: { years: number[]; initialYear: number }) {
  const [year, setYear] = useYear(years, initialYear);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [q, setQ] = useState("");
  const [regiao, setRegiao] = useState("");
  const [uf, setUf] = useState("");
  const [porte, setPorte] = useState("");
  const [sit, setSit] = useState<Situation>("all");
  const [reinc, setReinc] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "mde", dir: 1 });
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let live = true;
    loadAllRows()
      .then((f) => {
        if (!live) return;
        const items = f.rows.map((r) => {
          const region = getUf(r.uf)?.region;
          return { r, key: norm(r.name), region, regionSlug: region ? getRegion(region).slug : "", band: popBand(r.pop).key, times: timesBelow(r) };
        });
        setData({ years: f.years, items });
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [attempt]);

  // Região/UF from the URL: read after mount so the page HTML stays static
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const reg = getRegionBySlug(p.get("regiao") ?? "");
    const u = getUf(p.get("uf") ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is only readable after hydration
    if (reg) setRegiao(reg.slug);
    if (u && (!reg || reg.ufs.includes(u.uf))) setUf(u.uf);
  }, []);

  const region = getRegionBySlug(regiao);
  const ufOptions = region ? UFS_BY_NAME.filter((u) => u.region === region.key) : UFS_BY_NAME;
  const yi = data ? data.years.indexOf(year) : -1;
  const fMin = funMin(year);

  // One pass: the filtered set plus, for each filter, counts under all the *other* filters
  const facets = useMemo<Facets>(() => {
    const f: Facets = { regiao: new Map(), uf: new Map(), porte: new Map(), sit: new Map(), reinc: 0, filtered: [] };
    if (!data || yi < 0) return f;
    const needle = norm(q.trim());
    const band = POP_BANDS.find((b) => b.key === porte);
    for (const it of data.items) {
      const r = it.r;
      if (needle && !it.key.includes(needle)) continue;
      const pReg = !region || it.region === region.key;
      const pUf = !uf || r.uf === uf;
      const pPorte = !band || band.test(r.pop);
      const pReinc = !reinc || it.times >= 2;
      const s = situationOf(r, yi);
      const fv = r.fun[yi];
      const isFun = fv != null && fv < fMin;
      const pSit = sit === "all" || (sit === "fun" ? isFun : s === sit);
      if (pUf && pPorte && pReinc && pSit) inc(f.regiao, it.regionSlug);
      if (pReg && pPorte && pReinc && pSit) inc(f.uf, r.uf);
      if (pReg && pUf && pReinc && pSit) inc(f.porte, it.band);
      if (pReg && pUf && pPorte && pReinc) {
        inc(f.sit, s);
        if (isFun) inc(f.sit, "fun");
      }
      if (pReg && pUf && pPorte && pSit && it.times >= 2) f.reinc++;
      if (pReg && pUf && pPorte && pReinc && pSit) f.filtered.push(it);
    }
    return f;
  }, [data, yi, fMin, q, region, uf, porte, sit, reinc]);
  const filtered = facets.filtered;

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, key, yi), vb = sortValue(b, key, yi);
      // nulls last regardless of direction
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const d = typeof va === "string" ? collator.compare(va, vb as string) : va - (vb as number);
      return (d || collator.compare(a.key, b.key)) * dir;
    });
  }, [filtered, sort, yi]);

  const rows = useMemo(() => filtered.map((it) => it.r), [filtered]);
  const stats = useMemo(() => (yi >= 0 ? aggregate(rows, yi, year) : null), [rows, yi, year]);

  const reset = () => setLimit(PAGE);
  const changeRegiao = (slug: string) => {
    const reg = getRegionBySlug(slug);
    const nextUf = reg && uf && !reg.ufs.includes(uf) ? "" : uf;
    setRegiao(slug);
    setUf(nextUf);
    syncUrl(slug, nextUf);
    reset();
  };
  const changeUf = (sigla: string) => {
    setUf(sigla);
    syncUrl(regiao, sigla);
    reset();
  };
  const clear = () => {
    setQ("");
    setPorte("");
    setSit("all");
    setReinc(false);
    setRegiao("");
    setUf("");
    syncUrl("", "");
    reset();
  };

  const sitLabel = (s: Situation) => (s === "fun" ? `Fundeb pessoal < ${fMin}%` : SITUATIONS.find((x) => x.key === s)?.label ?? "");
  const chips: { key: string; label: ReactNode; remove: () => void }[] = [];
  if (q.trim()) chips.push({ key: "q", label: <>Nome contém “{q.trim()}”</>, remove: () => { setQ(""); reset(); } });
  if (region) chips.push({ key: "regiao", label: <>Região: {region.name}</>, remove: () => changeRegiao("") });
  if (uf) chips.push({ key: "uf", label: <>UF: <span className="font-mono">{uf}</span></>, remove: () => changeUf("") });
  if (porte) chips.push({ key: "porte", label: <>População: {POP_BANDS.find((b) => b.key === porte)?.label}</>, remove: () => { setPorte(""); reset(); } });
  if (sit !== "all") chips.push({ key: "sit", label: <>{sitLabel(sit)} em {year}</>, remove: () => { setSit("all"); reset(); } });
  if (reinc) chips.push({ key: "reinc", label: "Reincidentes", remove: () => { setReinc(false); reset(); } });

  const toggleSort = (key: SortKey) => {
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" || key === "mde" || key === "sit" ? 1 : -1 }));
    reset();
  };

  const th = (key: SortKey, label: ReactNode, title?: string, left = false) => {
    const on = sort.key === key;
    const Icon = on ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        scope="col"
        className={cn(stickyHead, left ? "text-left" : "text-right")}
        aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          title={title}
          onClick={() => toggleSort(key)}
          className={cn(
            "group/sort -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-accent hover:text-foreground",
            !left && "flex-row-reverse",
            on && "text-foreground",
          )}
        >
          {label}
          <Icon className={cn("size-3.5 shrink-0", on ? "text-foreground" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60")} />
        </button>
      </TableHead>
    );
  };

  const total = data?.items.length ?? 0;
  const label = stats ? shortfallLabel(stats) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-full bg-background sm:w-64 dark:bg-input/30">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Buscar município pelo nome"
            value={q}
            onChange={(e) => { setQ(e.target.value); reset(); }}
            placeholder="Filtrar por nome…"
            className="[&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Limpar busca" onClick={() => { setQ(""); reset(); }}>
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        <Select value={String(year)} onValueChange={(v) => v != null && setYear(Number(v))}>
          <SelectTrigger aria-label="Exercício" className="h-8 rounded-md bg-background text-[13px]">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Exercício</span>
            <span className="font-medium tnum">{year}</span>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="max-h-72 w-auto min-w-36">
            {[...years].reverse().map((y) => (
              <SelectItem key={y} value={String(y)} className="tnum">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FilterSelect
          label="Região"
          value={regiao}
          onChange={changeRegiao}
          ready={!!data}
          options={REGIONS.map((r) => ({ value: r.slug, label: r.name, count: facets.regiao.get(r.slug) ?? 0 }))}
        />
        <FilterSelect
          label="UF"
          value={uf}
          onChange={changeUf}
          ready={!!data}
          display={(v) => <span className="font-mono">{v}</span>}
          options={ufOptions.map((u) => ({
            value: u.uf,
            label: (
              <>
                <span className="w-6 font-mono text-[12px] text-muted-foreground">{u.uf}</span>
                {u.name}
              </>
            ),
            count: facets.uf.get(u.uf) ?? 0,
          }))}
        />
        <FilterSelect
          label="População"
          value={porte}
          onChange={(v) => { setPorte(v); reset(); }}
          ready={!!data}
          options={POP_BANDS.map((b) => ({ value: b.key, label: b.label, count: facets.porte.get(b.key) ?? 0 }))}
        />
        <FilterSelect
          label={`Situação em ${year}`}
          value={sit === "all" ? "" : sit}
          onChange={(v) => { setSit((v || "all") as Situation); reset(); }}
          ready={!!data}
          display={() => sitLabel(sit)}
          options={SITUATIONS.map((s) => ({ value: s.key, label: sitLabel(s.key), count: facets.sit.get(s.key) ?? 0, sep: s.key === "fun" }))}
        />
        <button
          type="button"
          aria-pressed={reinc}
          onClick={() => { setReinc((v) => !v); reset(); }}
          title="Abaixo de 25% em dois anos ou mais"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors duration-150",
            reinc ? "border-solid bg-background text-foreground hover:bg-accent dark:bg-input/30" : "border-dashed text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {reinc ? <X className="size-3.5" /> : <PlusCircle className="size-3.5" />}
          Reincidentes
          {data && <span className="text-xs text-muted-foreground tnum">{int(facets.reinc)}</span>}
        </button>

        <Button
          variant="outline"
          className="ml-auto h-8 rounded-md"
          onClick={() => data && downloadCsv(rows, data.years)}
          disabled={!data || !rows.length}
          title={`Todos os anos (${years[0]}–${years[years.length - 1]}) dos municípios filtrados`}
        >
          <Download data-icon="inline-start" />
          Exportar CSV
        </Button>
      </div>

      {/* Result count + active filters */}
      <div className="flex min-h-7 flex-wrap items-center gap-2 text-[13px]" aria-live="polite">
        <span className="text-muted-foreground">
          {data ? (
            <>
              <span className="font-medium text-foreground tnum">{int(filtered.length)}</span> de <span className="tnum">{int(total)}</span> municípios
            </>
          ) : (
            "Carregando municípios…"
          )}
        </span>
        {chips.length > 0 && <span aria-hidden className="h-4 w-px bg-border" />}
        {chips.map((c) => (
          <span key={c.key} className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border bg-background pr-0.5 pl-2.5 text-xs dark:bg-input/30">
            <span className="truncate">{c.label}</span>
            <button
              type="button"
              onClick={c.remove}
              aria-label="Remover filtro"
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {chips.length > 0 && (
          <Button variant="ghost" size="xs" onClick={clear} className="text-muted-foreground">
            <RotateCcw data-icon="inline-start" />
            Limpar
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats && label && data ? (
          <>
            <Stat label="Municípios" value={int(stats.n)} sub={stats.n === total ? "todos do país" : `${share(stats.n, total)} do país`} />
            <Stat
              label={`Abaixo de 25% em ${year}`}
              value={int(stats.below)}
              tone={stats.below ? "bad" : "neutral"}
              sub={`${share(stats.below, stats.reported)} dos que declararam`}
            />
            <Stat label="Faltou para 25%" value={label.value} tone={stats.shortfall ? "bad" : "neutral"} sub={label.note ?? "soma do que faltou aplicar"} className="col-span-2 sm:col-span-1" />
            <Stat label="MDE mediana" value={pct(stats.median, 1)} sub={`${int(stats.reported)} declararam`} />
            <Stat
              label="População"
              value={fmtPop(stats.pop)}
              sub={stats.popBelow ? `${fmtPop(stats.popBelow)} em municípios abaixo` : "nenhum habitante em município abaixo"}
            />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={cn("h-[118px] rounded-xl border bg-card p-4", i === 2 && "col-span-2 sm:col-span-1")}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))
        )}
      </div>

      {/* Table */}
      <Panel
        divided
        title="Municípios"
        description={<>Indicadores de {year}. Clique no cabeçalho para ordenar; a série mostra {years[0]}–{years[years.length - 1]}.</>}
        action={<BinLegend />}
        footer={
          data && !error && sorted.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="tnum">
                Mostrando {int(Math.min(limit, sorted.length))} de {int(sorted.length)}
              </span>
              {sorted.length > limit && (
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + MORE)}>
                  Mostrar mais {int(Math.min(MORE, sorted.length - limit))}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground" role="alert">
            <p>Não foi possível carregar os dados dos municípios.</p>
            <Button variant="outline" size="sm" onClick={() => { setError(false); setAttempt((a) => a + 1); }}>
              <RotateCcw data-icon="inline-start" />
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="scroll-thin relative max-h-[min(72vh,760px)] overflow-auto">
            <table className="w-full min-w-[960px] caption-bottom text-sm">
              <caption className="sr-only">Municípios filtrados, indicadores de {year}</caption>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  {th("name", "Município", undefined, true)}
                  {th("pop", "População")}
                  {th("mde", <>MDE <span className="tnum">{year}</span></>, "% da receita de impostos aplicado em manutenção e desenvolvimento do ensino (mínimo 25%)")}
                  {th("sit", "Situação", "Ordena por gravidade: abaixo, não declarou, no limite, cumpriu", true)}
                  {th("fun", "Fundeb pessoal", `% do Fundeb pago aos profissionais da educação (mínimo ${fMin}% em ${year})`)}
                  {th("aluno", "R$ por aluno")}
                  {th("short", "Faltou", "Quanto faltou aplicar para chegar a 25%")}
                  {th("times", "Anos < 25%", `Anos abaixo de 25% entre ${years[0]} e ${years[years.length - 1]}`)}
                  <TableHead scope="col" className={cn(stickyHead, "pr-4 text-left")}>
                    <span className="tnum">{years[0]}–{years[years.length - 1]}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tnum">
                {!data
                  ? Array.from({ length: 10 }, (_, i) => (
                      <TableRow key={i} aria-hidden className="hover:bg-transparent">
                        {Array.from({ length: 9 }, (_, j) => (
                          <TableCell key={j} className={cn("py-3", j === 0 ? "pl-4" : "")}>
                            <Skeleton className={cn("h-3.5", j === 0 ? "w-36" : j === 8 ? "w-40" : j === 3 ? "w-16" : "ml-auto w-14")} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : sorted.slice(0, limit).map(({ r, times }) => (
                      <ExplorerRow key={r.id} r={r} times={times} yi={yi} year={year} years={data.years} />
                    ))}
                {data && !sorted.length && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="py-14 text-center whitespace-normal">
                      <div className="text-sm font-medium">Nenhum município com esses filtros</div>
                      <div className="mt-1 text-[13px] text-muted-foreground">Remova algum filtro ou tente outro ano.</div>
                      <Button variant="outline" size="sm" className="mt-3" onClick={clear}>
                        Limpar filtros
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
            {!data && <span className="sr-only" role="status">Carregando municípios…</span>}
          </div>
        )}
      </Panel>
    </div>
  );
}

const stickyHead =
  "sticky top-0 z-10 h-10 bg-card px-3 text-[13px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)] first:pl-4";

/** Dashed "filter chip" (Vercel / shadcn data-table style) backed by a Base UI Select, with per-option counts. */
function FilterSelect({
  label, value, onChange, options, display, ready,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: ReactNode; count: number; sep?: boolean }[];
  display?: (v: string) => ReactNode;
  ready: boolean;
}) {
  const active = value !== "";
  const current = options.find((o) => o.value === value);
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v == null || v === ALL ? "" : String(v))}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-8 max-w-full gap-1.5 rounded-md px-2.5 text-[13px] [&>svg:last-child]:hidden",
          active ? "bg-background text-foreground hover:bg-accent" : "border-dashed bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-transparent",
        )}
      >
        <PlusCircle className={cn("size-3.5", active && "rotate-45")} />
        {label}
        {active && (
          <>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
            <span className="max-w-40 truncate rounded-sm bg-muted px-1.5 py-px text-xs font-medium">{display ? display(value) : current?.label}</span>
          </>
        )}
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="max-h-80 w-auto min-w-60">
        <SelectItem value={ALL} className="text-muted-foreground">Todos</SelectItem>
        <SelectSeparator />
        {options.map((o) => (
          <FilterOption key={o.value} o={o} ready={ready} />
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterOption({ o, ready }: { o: { value: string; label: ReactNode; count: number; sep?: boolean }; ready: boolean }) {
  return (
    <>
      {o.sep && <SelectSeparator />}
      <SelectItem value={o.value} className={cn(ready && !o.count && "text-muted-foreground")}>
        <span className="flex items-center gap-1.5">{o.label}</span>
        {ready && <span className="ml-auto pl-4 text-xs text-muted-foreground tnum">{int(o.count)}</span>}
      </SelectItem>
    </>
  );
}

function BinLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda da série">
      {BINS.map((b) => (
        <span key={b.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: b.color }} />
          <span className="tnum">{b.label}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-[2px] border border-critical" style={{ background: HATCH }} />
        não declarou
      </span>
    </div>
  );
}

const HATCH = "repeating-linear-gradient(135deg, var(--critical) 0 1px, transparent 1px 3px)";

function ExplorerRow({ r, times, yi, year, years }: { r: Row; times: number; yi: number; year: number; years: number[] }) {
  const v = r.mde[yi];
  const f = r.fun[yi];
  const a = r.aluno[yi];
  const short = r.short[yi];
  const s = SIT_BADGE[situationOf(r, yi)];
  const below = v != null && v < MDE_MIN;
  return (
    <TableRow className="hover:bg-accent/60">
      <TableCell className="max-w-[280px] py-2 pr-3 pl-4">
        <Link href={cityPath(r.uf, r.slug)} className="block truncate font-medium hover:text-brand-ink hover:underline hover:underline-offset-2">
          {r.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-sm border px-1 font-mono text-[11px] leading-4">{r.uf}</span>
          <span className="truncate">{r.inter}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 text-right">{int(r.pop)}</TableCell>
      <TableCell className={cn("px-3 text-right", below && "font-medium text-critical")}>
        {pct(v)}
        {below && <span className="sr-only"> (abaixo do mínimo)</span>}
      </TableCell>
      <TableCell className="px-3">
        <StatusBadge kind={s.kind}>{s.label}</StatusBadge>
      </TableCell>
      <TableCell className={cn("px-3 text-right", f != null && f < funMin(year) && "text-critical")}>{pct(f)}</TableCell>
      <TableCell className="px-3 text-right">{a ? `R$ ${Math.round(a).toLocaleString("pt-BR")}` : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className={cn("px-3 text-right", short ? "font-medium text-critical" : "text-muted-foreground")}>
        {short == null ? <span title="Abaixo de 25%, mas sem receita declarada para estimar o valor">s/ base</span> : short > 0 ? brlShort(short) : "—"}
      </TableCell>
      <TableCell className={cn("px-3 text-right", !times && "text-muted-foreground")}>{times}</TableCell>
      <TableCell className="px-3 pr-4">
        <HeatStrip r={r} years={years} yi={yi} />
      </TableCell>
    </TableRow>
  );
}

/** One cell per year coloured on the MDE scale; hatched when nothing was declared; the selected year is ringed. */
function HeatStrip({ r, years, yi }: { r: Row; years: number[]; yi: number }) {
  const below = years.filter((_, i) => r.mde[i] != null && r.mde[i]! < MDE_MIN);
  return (
    <div className="flex items-center gap-[2px]" role="img" aria-label={below.length ? `Abaixo de 25% em ${below.join(", ")}` : "Nenhum ano abaixo de 25%"}>
      {years.map((y, i) => {
        const v = r.mde[i];
        const nd = r.nd[i];
        return (
          <span
            key={y}
            title={`${y}: ${nd ? "não declarou" : v == null ? "sem dados" : pct(v)}`}
            className={cn(
              "block h-5 w-[7px] shrink-0 rounded-[2px]",
              i === yi && "ring-1 ring-foreground ring-offset-1 ring-offset-card",
              nd && "border border-critical/70",
            )}
            style={{ background: nd ? HATCH : binColor(v) }}
          />
        );
      })}
    </div>
  );
}
