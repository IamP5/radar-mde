"use client";

import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Check, ChevronDown, Download, Info, Link2, PlusCircle, RotateCcw, Search, X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { StatusBadge, type StatusKind } from "@/components/kit/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useYear } from "@/components/YearPicker";
import { BINS, binColor } from "@/lib/bins";
import { ROW_CSV_COLUMNS, csvFilename, downloadCsv, rowCsvRecord, toCsv } from "@/lib/csv";
import { MDE_MIN, PANDEMIC_YEARS, POP_BANDS, brlShort, funMin, int, normKey, pct, popBand, share } from "@/lib/format";
import { REGIONS, UFS, cityPath, getRegion, getRegionBySlug, getUf, type RegionKey } from "@/lib/geo";
import { ATIP_LABEL, aggregate, atipOf, deltaPp, existedIn, loadAllRows, shortfallLabel, timesBelow, type Row } from "@/lib/rows";
import { cn } from "@/lib/utils";

type Situation = "all" | "below" | "edge" | "ok" | "nd" | "missing" | "fun";
type Sit = Exclude<Situation, "all" | "fun"> | "na";
type SortKey = "name" | "pop" | "mde" | "delta" | "sit" | "fun" | "aluno" | "short" | "times";
type Sort = { key: SortKey; dir: 1 | -1 };
type Item = { r: Row; key: string; region: RegionKey | undefined; regionSlug: string; band: string; times: number };
type Data = { years: number[]; items: Item[] };

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
  na: { kind: "nd", label: "Não existia" },
};
const SIT_ORDER: Record<Sit, number> = { below: 0, nd: 1, edge: 2, ok: 3, missing: 4, na: 5 };

function situationOf(r: Row, yi: number, year: number): Sit {
  const v = r.mde[yi];
  if (v == null) return !existedIn(r, year) ? "na" : r.nd[yi] ? "nd" : "missing";
  if (v < MDE_MIN) return "below";
  return v < MDE_MIN + 1 ? "edge" : "ok";
}

function sortValue(it: Item, k: SortKey, yi: number, year: number): number | string | null {
  const r = it.r;
  switch (k) {
    case "name": return it.key;
    case "pop": return r.pop;
    case "mde": return r.mde[yi];
    case "delta": return deltaPp(r, yi);
    case "sit": return SIT_ORDER[situationOf(r, yi, year)];
    case "fun": return r.fun[yi];
    case "aluno": return r.aluno[yi];
    case "short": return r.short[yi];
    case "times": return it.times;
  }
}

/* ---------- URL state (shareable views: JOR-03, GOV-06, FUN-07) ---------- */

const SIT_PARAM: Record<Exclude<Situation, "all">, string> = {
  below: "abaixo", edge: "limite", ok: "cumpriu", nd: "nao-declarou", missing: "sem-dados", fun: "fundeb",
};
const SORT_PARAM: Record<SortKey, string> = {
  name: "nome", pop: "populacao", mde: "mde", delta: "variacao", sit: "situacao", fun: "fundeb", aluno: "aluno", short: "faltou", times: "anos",
};
const DEFAULT_SORT: Sort = { key: "mde", dir: 1 };
const defaultDir = (key: SortKey): 1 | -1 => (key === "name" || key === "mde" || key === "sit" || key === "delta" ? 1 : -1);
const invert = <K extends string, V extends string>(m: Record<K, V>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
const SIT_FROM = invert(SIT_PARAM);
const SORT_FROM = invert(SORT_PARAM);

type View = { q: string; regiao: string; uf: string; porte: string; sit: Situation; reinc: boolean; capital: boolean; sort: Sort };

function readView(search: string): Partial<View> {
  const p = new URLSearchParams(search);
  const v: Partial<View> = {};
  const reg = getRegionBySlug(p.get("regiao") ?? "");
  if (reg) v.regiao = reg.slug;
  const u = getUf(p.get("uf") ?? "");
  if (u && (!reg || reg.ufs.includes(u.uf))) v.uf = u.uf;
  const q = p.get("q")?.trim();
  if (q) v.q = q.slice(0, 80);
  const porte = p.get("porte");
  if (porte && POP_BANDS.some((b) => b.key === porte)) v.porte = porte;
  const sit = SIT_FROM[p.get("situacao") ?? ""];
  if (sit) v.sit = sit;
  if (p.get("reinc") === "1") v.reinc = true;
  if (p.get("capital") === "1") v.capital = true;
  const o = p.get("ordem") ?? "";
  const key = SORT_FROM[o.replace(/^-/, "")];
  if (key) v.sort = { key, dir: o.startsWith("-") ? -1 : 1 };
  return v;
}

/** Writes the view to the query string (replaceState; `ano` is handled by useYear). */
function writeView(v: View) {
  const u = new URL(window.location.href);
  const set = (k: string, val: string | null) => (val ? u.searchParams.set(k, val) : u.searchParams.delete(k));
  set("q", v.q.trim() || null);
  set("regiao", v.regiao || null);
  set("uf", v.uf || null);
  set("porte", v.porte || null);
  set("situacao", v.sit === "all" ? null : SIT_PARAM[v.sit]);
  set("reinc", v.reinc ? "1" : null);
  set("capital", v.capital ? "1" : null);
  const isDefault = v.sort.key === DEFAULT_SORT.key && v.sort.dir === DEFAULT_SORT.dir;
  set("ordem", isDefault ? null : `${v.sort.dir === -1 ? "-" : ""}${SORT_PARAM[v.sort.key]}`);
  if (u.href !== window.location.href) window.history.replaceState(window.history.state, "", u);
}

const fmtPop = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : int(v));
const fmtDelta = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

type Facets = {
  regiao: Map<string, number>;
  uf: Map<string, number>;
  porte: Map<string, number>;
  sit: Map<string, number>;
  reinc: number;
  capital: number;
  filtered: Item[];
};

const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/* ---------- virtualised rows (PERF-02) ---------- */

const OVERSCAN = 8;
const ROW_H_GUESS = 57;

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
  const [capital, setCapital] = useState(false);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [urlRead, setUrlRead] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    loadAllRows()
      .then((f) => {
        if (!live) return;
        const items = f.rows.map((r) => {
          const region = getUf(r.uf)?.region;
          return { r, key: normKey(r.name), region, regionSlug: region ? getRegion(region).slug : "", band: popBand(r.pop).key, times: timesBelow(r) };
        });
        setData({ years: f.years, items });
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [attempt]);

  // Filters and sort from the URL: read after mount so the page HTML stays static
  useEffect(() => {
    const v = readView(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- URL is only readable after hydration */
    if (v.q) setQ(v.q);
    if (v.regiao) setRegiao(v.regiao);
    if (v.uf) setUf(v.uf);
    if (v.porte) setPorte(v.porte);
    if (v.sit) setSit(v.sit);
    if (v.reinc) setReinc(true);
    if (v.capital) setCapital(true);
    if (v.sort) setSort(v.sort);
    setUrlRead(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // …and back to the URL (debounced: typing in the name filter shouldn't spam history.replaceState)
  useEffect(() => {
    if (!urlRead) return;
    const t = setTimeout(() => writeView({ q, regiao, uf, porte, sit, reinc, capital, sort }), 250);
    return () => clearTimeout(t);
  }, [urlRead, q, regiao, uf, porte, sit, reinc, capital, sort]);

  const dq = useDeferredValue(q);
  const region = getRegionBySlug(regiao);
  const ufOptions = region ? UFS_BY_NAME.filter((u) => u.region === region.key) : UFS_BY_NAME;
  const yi = data ? data.years.indexOf(year) : -1;
  const fMin = funMin(year);
  const hasCapital = useMemo(() => !!data?.items.some((it) => it.r.capital), [data]);

  // One pass: the filtered set plus, for each filter, counts under all the *other* filters
  const facets = useMemo<Facets>(() => {
    const f: Facets = { regiao: new Map(), uf: new Map(), porte: new Map(), sit: new Map(), reinc: 0, capital: 0, filtered: [] };
    if (!data || yi < 0) return f;
    const needle = normKey(dq);
    const band = POP_BANDS.find((b) => b.key === porte);
    for (const it of data.items) {
      const r = it.r;
      if (needle && !it.key.includes(needle)) continue;
      const pReg = !region || it.region === region.key;
      const pUf = !uf || r.uf === uf;
      const pPorte = !band || band.test(r.pop);
      const pReinc = !reinc || it.times >= 2;
      const pCap = !capital || !!r.capital;
      const s = situationOf(r, yi, year);
      const fv = r.fun[yi];
      const isFun = fv != null && fv < fMin;
      const pSit = sit === "all" || (sit === "fun" ? isFun : s === sit || (sit === "missing" && s === "na"));
      if (pUf && pPorte && pReinc && pSit && pCap) inc(f.regiao, it.regionSlug);
      if (pReg && pPorte && pReinc && pSit && pCap) inc(f.uf, r.uf);
      if (pReg && pUf && pReinc && pSit && pCap) inc(f.porte, it.band);
      if (pReg && pUf && pPorte && pReinc && pCap) {
        inc(f.sit, s === "na" ? "missing" : s);
        if (isFun) inc(f.sit, "fun");
      }
      if (pReg && pUf && pPorte && pSit && pCap && it.times >= 2) f.reinc++;
      if (pReg && pUf && pPorte && pSit && pReinc && r.capital) f.capital++;
      if (pReg && pUf && pPorte && pReinc && pSit && pCap) f.filtered.push(it);
    }
    return f;
  }, [data, yi, year, fMin, dq, region, uf, porte, sit, reinc, capital]);
  const filtered = facets.filtered;

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, key, yi, year), vb = sortValue(b, key, yi, year);
      // nulls last regardless of direction
      if (va == null && vb == null) return collator.compare(a.key, b.key);
      if (va == null) return 1;
      if (vb == null) return -1;
      const d = typeof va === "string" ? collator.compare(va, vb as string) : va - (vb as number);
      return (d || collator.compare(a.key, b.key)) * dir;
    });
  }, [filtered, sort, yi, year]);

  const rows = useMemo(() => filtered.map((it) => it.r), [filtered]);
  const stats = useMemo(() => (yi >= 0 ? aggregate(rows, yi, year) : null), [rows, yi, year]);

  /* virtual window */
  const scroller = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(ROW_H_GUESS);
  const [win, setWin] = useState({ top: 0, height: 760 });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWin({ top: el.scrollTop, height: el.clientHeight }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [error]);
  // Back to the top whenever the result set or its order changes
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [filtered, sort]);
  const measureRef = useCallback((tr: HTMLTableRowElement | null) => {
    if (!tr) return;
    const h = tr.getBoundingClientRect().height;
    if (h > 20) setRowH((old) => (Math.abs(old - h) > 0.5 ? h : old));
  }, []);
  const first = Math.max(0, Math.floor(win.top / rowH) - OVERSCAN);
  const last = Math.min(sorted.length, Math.ceil((win.top + win.height) / rowH) + OVERSCAN);
  const visible = sorted.slice(first, last);

  const changeRegiao = (slug: string) => {
    const reg = getRegionBySlug(slug);
    setRegiao(slug);
    if (reg && uf && !reg.ufs.includes(uf)) setUf("");
  };
  const clear = () => {
    setQ("");
    setPorte("");
    setSit("all");
    setReinc(false);
    setCapital(false);
    setRegiao("");
    setUf("");
  };

  const sitLabel = (s: Situation) => (s === "fun" ? `Fundeb pessoal < ${fMin}%` : SITUATIONS.find((x) => x.key === s)?.label ?? "");
  const chips: { key: string; label: ReactNode; remove: () => void }[] = [];
  if (q.trim()) chips.push({ key: "q", label: <>Nome contém “{q.trim()}”</>, remove: () => setQ("") });
  if (region) chips.push({ key: "regiao", label: <>Região: {region.name}</>, remove: () => changeRegiao("") });
  if (uf) chips.push({ key: "uf", label: <>UF: <span className="font-mono">{uf}</span></>, remove: () => setUf("") });
  if (porte) chips.push({ key: "porte", label: <>População: {POP_BANDS.find((b) => b.key === porte)?.label}</>, remove: () => setPorte("") });
  if (sit !== "all") chips.push({ key: "sit", label: <>{sitLabel(sit)} em {year}</>, remove: () => setSit("all") });
  if (reinc) chips.push({ key: "reinc", label: "Reincidentes", remove: () => setReinc(false) });
  if (capital) chips.push({ key: "capital", label: "Capitais", remove: () => setCapital(false) });

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : defaultDir(key) }));

  const exportCsv = (scope: "year" | "series", excel: boolean) => {
    if (!data || yi < 0) return;
    const ordered = sorted.map((it) => it.r);
    const records =
      scope === "year"
        ? ordered.map((r) => rowCsvRecord(r, yi, data.years))
        : ordered.flatMap((r) => data.years.flatMap((y, i) => (existedIn(r, y) ? [rowCsvRecord(r, i, data.years)] : [])));
    const name = csvFilename(
      [
        region?.slug, uf, scope === "year" ? year : `${data.years[0]}-${data.years[data.years.length - 1]}`,
        sit !== "all" && SIT_PARAM[sit], porte && POP_BANDS.find((b) => b.key === porte)?.label, reinc && "reincidentes",
        capital && "capitais", q.trim() && normKey(q).replace(/ /g, "-"),
      ],
      excel,
    );
    downloadCsv(name, toCsv(ROW_CSV_COLUMNS, records, { excel }));
  };

  const copyLink = async () => {
    writeView({ q, regiao, uf, porte, sit, reinc, capital, sort });
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", window.location.href);
    }
  };

  const th = (key: SortKey, label: ReactNode, title?: string, left = false) => {
    const on = sort.key === key;
    const Icon = on ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        scope="col"
        className={cn(stickyHead, left ? "text-left" : "text-right", key === "name" && "left-0 z-20", key === "pop" && "max-sm:hidden")}
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
          {/* one child, so flex-row-reverse only moves the icon (JOR-14) */}
          <span>{label}</span>
          <Icon className={cn("size-3.5 shrink-0", on ? "text-foreground" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60")} />
        </button>
      </TableHead>
    );
  };

  const total = data?.items.length ?? 0;
  const label = stats ? shortfallLabel(stats) : null;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];

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
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nome…"
            className="[&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Limpar busca" onClick={() => setQ("")}>
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
          onChange={setUf}
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
          onChange={setPorte}
          ready={!!data}
          options={POP_BANDS.map((b) => ({ value: b.key, label: b.label, count: facets.porte.get(b.key) ?? 0 }))}
        />
        <FilterSelect
          label={`Situação em ${year}`}
          value={sit === "all" ? "" : sit}
          onChange={(v) => setSit((v || "all") as Situation)}
          ready={!!data}
          display={() => sitLabel(sit)}
          options={SITUATIONS.map((s) => ({ value: s.key, label: sitLabel(s.key), count: facets.sit.get(s.key) ?? 0, sep: s.key === "fun" }))}
        />
        <ToggleChip on={reinc} onClick={() => setReinc((v) => !v)} title="Abaixo de 25% em dois anos ou mais" count={data ? facets.reinc : null}>
          Reincidentes
        </ToggleChip>
        {(hasCapital || capital) && (
          <ToggleChip on={capital} onClick={() => setCapital((v) => !v)} title="Só as capitais dos estados e Brasília" count={data ? facets.capital : null}>
            Capitais
          </ToggleChip>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="h-8 rounded-md" onClick={copyLink} title="Copia o endereço desta visão, com filtros, ano e ordem">
            {copied ? <Check data-icon="inline-start" className="text-good-ink" /> : <Link2 data-icon="inline-start" />}
            {copied ? "Link copiado" : "Copiar link"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!data || !rows.length}
              render={
                <Button variant="outline" className="h-8 rounded-md">
                  <Download data-icon="inline-start" />
                  Exportar CSV
                  <ChevronDown data-icon="inline-end" className="text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Os {int(rows.length)} municípios filtrados, na ordem da tabela</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportCsv("year", false)}>
                  <Download className="text-muted-foreground" />
                  Só {year} · CSV padrão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv("series", false)}>
                  <Download className="text-muted-foreground" />
                  Série {firstYear}–{lastYear} · CSV padrão
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Excel em português (separador “;” e vírgula decimal)</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportCsv("year", true)}>
                  <Download className="text-muted-foreground" />
                  Só {year} · Excel Brasil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv("series", true)}>
                  <Download className="text-muted-foreground" />
                  Série {firstYear}–{lastYear} · Excel Brasil
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="sr-only" role="status">
            {copied ? "Link copiado para a área de transferência" : ""}
          </span>
        </div>
      </div>

      {/* Result count + active filters */}
      <div className="flex min-h-7 flex-wrap items-center gap-2 text-[13px]" aria-live="polite">
        <span className="text-muted-foreground">
          {error ? (
            "Dados indisponíveis"
          ) : data ? (
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
              className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

      {PANDEMIC_YEARS.has(year) && (
        <p className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-[13px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium text-foreground">{year} foi ano de pandemia.</span> A Emenda Constitucional 119/2022 livrou de punição
            os municípios que ficaram abaixo de 25% em 2020 ou 2021, desde que compensassem a diferença até 2023.
          </span>
        </p>
      )}

      {/* Summary */}
      {error ? null : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats && label && data ? (
            <>
              <Stat
                label="Municípios"
                value={int(stats.n)}
                sub={filtered.length === total ? (stats.n === total ? "todos do país" : `todos os que existiam em ${year}`) : `${share(stats.n, total)} do país`}
              />
              <Stat
                label={`Abaixo de 25% em ${year}`}
                value={int(stats.below)}
                tone={stats.below ? "bad" : "neutral"}
                sub={`${share(stats.below, stats.reported)} dos que declararam`}
              />
              <Stat
                label="Faltou aplicar (estimativa)"
                value={label.value}
                tone={stats.shortfall ? "bad" : "neutral"}
                sub={label.note ?? (stats.shortfallAtip ? `dos quais ${brlShort(stats.shortfallAtip)} em valores atípicos` : `em ${year}, valores declarados e nominais`)}
                className="col-span-2 sm:col-span-1"
              />
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
      )}

      {/* Table */}
      <Panel
        divided
        title="Municípios"
        description={<>Indicadores de {year}. Clique no cabeçalho para ordenar; a série mostra {firstYear}–{lastYear}.</>}
        action={<BinLegend />}
        footer={
          data && !error && sorted.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="tnum">
                {int(sorted.length)} {sorted.length === 1 ? "município" : "municípios"}
                {sorted.length > 12 && " · role a tabela para ver todos"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" /> = valor atípico, possível erro de declaração
              </span>
            </div>
          ) : undefined
        }
      >
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground" role="alert">
            <p>Não foi possível carregar os dados dos municípios. Verifique a conexão.</p>
            <Button variant="outline" size="sm" onClick={() => { setError(false); setAttempt((a) => a + 1); }}>
              <RotateCcw data-icon="inline-start" />
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div ref={scroller} className="scroll-thin relative max-h-[min(72vh,760px)] overflow-auto" tabIndex={-1}>
            <table className="w-full min-w-[1040px] caption-bottom text-sm" aria-rowcount={sorted.length + 1}>
              <caption className="sr-only">Municípios filtrados, indicadores de {year}</caption>
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent" aria-rowindex={1}>
                  {th("name", "Município", undefined, true)}
                  {th("pop", "População")}
                  {th("mde", `MDE em ${year}`, "% da receita de impostos aplicado em manutenção e desenvolvimento do ensino (mínimo 25%)")}
                  {th("delta", `vs ${year - 1}`, `Diferença em pontos percentuais entre ${year} e ${year - 1}`)}
                  {th("sit", "Situação", "Ordena por gravidade: abaixo, não declarou, no limite, cumpriu", true)}
                  {th("fun", "Fundeb pessoal", `% do Fundeb pago aos profissionais da educação (mínimo ${fMin}% em ${year})`)}
                  {th("aluno", "R$ por aluno", "Valores nominais")}
                  {th("short", "Faltou", "Quanto faltou aplicar para chegar a 25% (estimativa, valores nominais)")}
                  {th("times", "Anos < 25%", `Anos abaixo de 25% entre ${firstYear} e ${lastYear}`)}
                  <TableHead scope="col" className={cn(stickyHead, "pr-4 text-left")}>
                    <span className="tnum">{firstYear}–{lastYear}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tnum">
                {!data
                  ? Array.from({ length: 10 }, (_, i) => (
                      <TableRow key={i} aria-hidden className="hover:bg-transparent">
                        {Array.from({ length: 10 }, (_, j) => (
                          <TableCell key={j} className={cn("py-3", j === 0 && "pl-4", j === 1 && "max-sm:hidden")}>
                            <Skeleton className={cn("h-3.5", j === 0 ? "w-36" : j === 9 ? "w-40" : j === 4 ? "w-16" : "ml-auto w-14")} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : (
                    <>
                      {first > 0 && <tr aria-hidden style={{ height: first * rowH }} />}
                      {visible.map(({ r, times }, i) => (
                        <ExplorerRow
                          key={r.id}
                          ref={i === 0 ? measureRef : undefined}
                          index={first + i + 2}
                          r={r}
                          times={times}
                          yi={yi}
                          year={year}
                          years={data.years}
                        />
                      ))}
                      {last < sorted.length && <tr aria-hidden style={{ height: (sorted.length - last) * rowH }} />}
                    </>
                  )}
                {data && !sorted.length && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={10} className="py-14 text-center whitespace-normal">
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
  "sticky top-0 z-10 h-10 bg-card px-2.5 text-[13px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)] first:pl-4";

function ToggleChip({ on, onClick, title, count, children }: { on: boolean; onClick: () => void; title: string; count: number | null; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors duration-150",
        on ? "border-solid bg-background text-foreground hover:bg-accent dark:bg-input/30" : "border-dashed text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {on ? <X className="size-3.5" /> : <PlusCircle className="size-3.5" />}
      {children}
      {count != null && <span className="text-xs text-muted-foreground tnum">{int(count)}</span>}
    </button>
  );
}

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

function ExplorerRow({
  r, times, yi, year, years, index, ref,
}: { r: Row; times: number; yi: number; year: number; years: number[]; index: number; ref?: (tr: HTMLTableRowElement | null) => void }) {
  const v = r.mde[yi];
  const f = r.fun[yi];
  const a = r.aluno[yi];
  const short = r.short[yi];
  const d = deltaPp(r, yi);
  const s = SIT_BADGE[situationOf(r, yi, year)];
  const below = v != null && v < MDE_MIN;
  const atip = atipOf(r, yi);
  const atipMde = atip.includes("mde") || atip.includes("base");
  return (
    <TableRow ref={ref} aria-rowindex={index} className="group h-[57px] hover:bg-accent/60">
      <TableCell className="sticky left-0 z-[1] max-w-[280px] bg-card py-2 pr-3 pl-4 group-hover:bg-[color-mix(in_oklab,var(--card),var(--accent)_60%)] max-sm:max-w-[150px]">
        <Link
          href={cityPath(r.uf, r.slug)}
          prefetch={false}
          className="block truncate font-medium hover:text-brand-ink hover:underline hover:underline-offset-2"
        >
          {r.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-sm border px-1 font-mono text-[11px] leading-4">{r.uf}</span>
          {r.capital && <span className="rounded-sm border px-1 text-[11px] leading-4">capital</span>}
          <span className="truncate">{r.inter}</span>
        </div>
      </TableCell>
      <TableCell className="px-2.5 text-right max-sm:hidden">{int(r.pop)}</TableCell>
      <TableCell className={cn("px-2.5 text-right", below && "font-medium text-critical-ink")}>
        <span className="inline-flex items-center justify-end gap-1">
          {atipMde && (
            <span title={atip.map((c) => ATIP_LABEL[c]).join("\n")} className="inline-flex text-warning-ink">
              <AlertTriangle aria-hidden className="size-3.5" />
              <span className="sr-only">(valor atípico, possível erro de declaração)</span>
            </span>
          )}
          {pct(v)}
        </span>
        {below && <span className="sr-only"> (abaixo do mínimo)</span>}
      </TableCell>
      <TableCell className={cn("px-2.5 text-right", d == null || d === 0 ? "text-muted-foreground" : "text-foreground")}>
        {d == null ? "—" : <span title={`${fmtDelta(d)} p.p. em relação a ${year - 1}`}>{fmtDelta(d)}</span>}
      </TableCell>
      <TableCell className="px-2.5">
        <StatusBadge kind={s.kind}>{s.label}</StatusBadge>
      </TableCell>
      <TableCell className={cn("px-2.5 text-right", f != null && f < funMin(year) && "text-critical-ink")}>{pct(f)}</TableCell>
      <TableCell className="px-2.5 text-right">
        {a ? (
          <span className="inline-flex items-center justify-end gap-1">
            {atip.includes("aluno") && (
              <span title={ATIP_LABEL.aluno} className="inline-flex text-warning-ink">
                <AlertTriangle aria-hidden className="size-3.5" />
                <span className="sr-only">(valor atípico)</span>
              </span>
            )}
            R$ {Math.round(a).toLocaleString("pt-BR")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn("px-2.5 text-right", short ? "font-medium text-critical-ink" : "text-muted-foreground")}>
        {short == null ? <span title="Abaixo de 25%, mas sem receita declarada para estimar o valor">s/ base</span> : short > 0 ? brlShort(short) : "—"}
      </TableCell>
      <TableCell className={cn("px-2.5 text-right", !times && "text-muted-foreground")}>{times}</TableCell>
      <TableCell className="px-2.5 pr-4">
        <HeatStrip r={r} years={years} yi={yi} />
      </TableCell>
    </TableRow>
  );
}

/** One cell per year coloured on the MDE scale; hatched when nothing was declared; the selected year is ringed. */
function HeatStrip({ r, years, yi }: { r: Row; years: number[]; yi: number }) {
  const below = years.filter((_, i) => r.mde[i] != null && r.mde[i]! < MDE_MIN);
  return (
    <div className="flex items-center gap-px" role="img" aria-label={below.length ? `Abaixo de 25% em ${below.join(", ")}` : "Nenhum ano abaixo de 25%"}>
      {years.map((y, i) => {
        const v = r.mde[i];
        const nd = r.nd[i];
        const na = !existedIn(r, y);
        return (
          <span
            key={y}
            title={`${y}: ${na ? "município ainda não existia" : nd ? "não declarou" : v == null ? "sem dados" : pct(v)}`}
            className={cn(
              "block h-5 w-1.5 shrink-0 rounded-[1.5px]",
              i === yi && "ring-1 ring-foreground ring-offset-1 ring-offset-card",
              nd && "border border-critical/70",
              na && "opacity-30",
            )}
            style={{ background: nd ? HATCH : binColor(v) }}
          />
        );
      })}
    </div>
  );
}
