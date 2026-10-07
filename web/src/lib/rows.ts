/**
 * Compact per-municipality rows (one array slot per published year) and the aggregate statistics computed
 * over any set of them. Client-safe: dashboards filter rows in the browser and re-aggregate on the fly.
 */
import version from "@/data/version.json";
import { MDE_MIN, brlShort, funMin, type YearRecord } from "./format";

/** Data version (build date + content hash), also used to version the /data/*.json URLs. */
export const DATA_VERSION: string = version.v;

// ---- IPCA (IBGE SIDRA 1737): factor that turns R$ of a year into R$ of IPCA_BASE (annual average index)
/** Year whose reais the corrected values are expressed in (latest published year). */
export const IPCA_BASE: number = version.ipca.base;
const IPCA_FACTOR: Record<string, number> = version.ipca.factor;
export const ipcaFactor = (year: number): number | null => IPCA_FACTOR[year] ?? null;
/** R$ of `year` → R$ of IPCA_BASE (null when the value or the factor is missing). */
export function toReal(v: number | null | undefined, year: number): number | null {
  const f = ipcaFactor(year);
  return v == null || f == null ? null : v * f;
}
export const IPCA_LABEL = `R$ de ${IPCA_BASE}, corrigidos pelo IPCA`;

/** UFs with any health (% saúde, SICONFI) value; hide Saúde columns elsewhere. */
export const HEALTH_UFS: string[] = version.healthUfs;
export const ufHasHealth = (uf: string) => HEALTH_UFS.includes(uf.toUpperCase());

/**
 * Atypical-value flags set by scripts/build_data.py (values are kept, never dropped). They mark values outside the
 * municipality's own pattern, not low application as such:
 * mde = < 5% or > 60%, or a one-year outlier (≥ 10 p.p. from the ±2 neighbouring years and < 15% or > 40%);
 * aluno = per-student far from the municipality's own level, or a one-year jump of more than 2,5×;
 * base = revenue base 2,5× above/below the neighbouring years.
 * `atipImpl` / bit 8 = physically implausible (MDE < 5% or > 60%, per-student > 8× the national median).
 */
export type AtipCode = "mde" | "aluno" | "base";
export const ATIP_BITS: Record<AtipCode, number> = { mde: 1, aluno: 2, base: 4 };
/** Row.atip bit set when a flag of the year is physically implausible. */
export const ATIP_IMPL_BIT = 8;
/** Neutral wording (Decision JOR-17): never suggest a filing error unless implausible. */
export const ATIP_LABEL: Record<AtipCode, string> = {
  mde: "Percentual em MDE fora do padrão do próprio município — confirme na fonte",
  aluno: "Valor por aluno fora do padrão do próprio município (depende das matrículas declaradas) — confirme na fonte",
  base: "Receita de impostos muito diferente dos anos vizinhos — o valor em R$ que faltou pode não ser confiável; confirme na fonte",
};
export const ATIP_IMPL_LABEL = "Valor fisicamente improvável — possível erro de declaração";
/** One sentence for a set of flags. */
export function atipNote(codes: AtipCode[], impl?: boolean): string {
  if (!codes.length) return "";
  if (impl) return ATIP_IMPL_LABEL;
  return codes.length === 1 ? ATIP_LABEL[codes[0]] : "Valores fora do padrão do próprio município — confirme na fonte";
}

/** One year of a municipality or state government as stored in cities.json / states.json. */
export type CityYear = YearRecord & {
  /** atypical-value flags (see AtipCode) */
  atip?: AtipCode[];
  /** 1 when a flag is physically implausible (possible filing error) */
  atipImpl?: 1;
  /** 1 when mdeV (R$ applied) is the Radar's estimate base × % instead of a declared value (SIOPE 8.2 exists from 2020) */
  mdeVEst?: 1;
  /** how `base` was obtained; omitted = SIOPE indicator 8.1 (÷ 25%) */
  baseSrc?: "8.2" | "receita" | "siconfi";
};

/** False for years before the municipality was installed (`since`, IBGE): show "não existia", never "não declarou". */
export const existedIn = (c: { since?: number }, year: number) => c.since == null || year >= c.since;

export type Row = {
  id: number;
  name: string;
  slug: string;
  uf: string;
  pop: number;
  /** IBGE região geográfica intermediária */
  inter: string;
  mde: (number | null)[];
  fun: (number | null)[];
  nd: boolean[];
  /** R$ short of 25% (0 when met); null when below 25% but the tax base is unknown */
  short: (number | null)[];
  aluno: (number | null)[];
  /** Treasury MDE % when it disagrees with SIOPE (São Paulo only); omitted elsewhere */
  alt?: (number | null)[];
  /** state capital (or Brasília) */
  capital?: true;
  /** IBGE installation year, only for municipalities created after 2008 (no data before it) */
  since?: number;
  /** per-year bitmask of atypical flags (ATIP_BITS); omitted when the municipality has none */
  atip?: number[];
};

/** Flags of one row/year. */
export function atipOf(r: Row, yi: number): AtipCode[] {
  const m = r.atip?.[yi] ?? 0;
  return m ? (Object.keys(ATIP_BITS) as AtipCode[]).filter((k) => m & ATIP_BITS[k]) : [];
}
/** Whether a row/year carries a given flag (or any flag when `code` is omitted). */
export const isAtip = (r: Row, yi: number, code?: AtipCode) => ((r.atip?.[yi] ?? 0) & (code ? ATIP_BITS[code] : 7)) !== 0;
/** Whether the year's flag is physically implausible (only then say "possível erro de declaração"). */
export const isImplausible = (r: Row, yi: number) => ((r.atip?.[yi] ?? 0) & ATIP_IMPL_BIT) !== 0;
/** MDE change vs the previous published year, in p.p. (null when either year is missing). */
export function deltaPp(r: Row, yi: number): number | null {
  const a = r.mde[yi], b = yi > 0 ? r.mde[yi - 1] : null;
  return a == null || b == null ? null : Math.round((a - b) * 100) / 100;
}

export type Stats = {
  /** municipalities in scope that existed in the year */
  n: number;
  reported: number;
  below: number;
  edge: number;
  nd: number;
  missing: number;
  /** R$ that would have been needed to reach 25% (sum over municipalities below with a known tax base) */
  shortfall: number;
  /** municipalities below 25% whose shortfall can't be estimated (no tax base declared) */
  belowNoBase: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  funReported: number;
  funBelow: number;
  funMedian: number | null;
  alunoMedian: number | null;
  /** population living in municipalities below the minimum */
  popBelow: number;
  pop: number;
  /** municipalities below 25% whose record is flagged atypical (MDE % or revenue base) */
  belowAtip: number;
  /** part of `shortfall` (R$) coming from those atypical records */
  shortfallAtip: number;
};

function quant(sorted: number[], q: number) {
  const n = sorted.length;
  if (!n) return null;
  if (q === 0.5) return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return sorted[Math.min(n - 1, Math.floor(q * n))];
}

export function aggregate(rows: Row[], yi: number, year: number): Stats {
  const vals: number[] = [];
  const funs: number[] = [];
  const alunos: number[] = [];
  let below = 0, edge = 0, nd = 0, shortfall = 0, belowNoBase = 0, popBelow = 0, pop = 0, funBelow = 0, n = 0;
  let belowAtip = 0, shortfallAtip = 0;
  for (const r of rows) {
    if (r.since != null && year < r.since) continue; // did not exist yet
    n++;
    pop += r.pop;
    const v = r.mde[yi];
    if (v != null) {
      vals.push(v);
      if (v < MDE_MIN) {
        below++;
        popBelow += r.pop;
        const sh = r.short[yi];
        const atip = (r.atip?.[yi] ?? 0) & (ATIP_BITS.mde | ATIP_BITS.base);
        if (atip) belowAtip++;
        if (sh == null) belowNoBase++;
        else {
          shortfall += sh;
          if (atip) shortfallAtip += sh;
        }
      } else if (v < MDE_MIN + 1) edge++;
    } else if (r.nd[yi]) nd++;
    const f = r.fun[yi];
    if (f != null) {
      funs.push(f);
      if (f < funMin(year)) funBelow++;
    }
    const a = r.aluno[yi];
    if (a != null) alunos.push(a);
  }
  vals.sort((a, b) => a - b);
  funs.sort((a, b) => a - b);
  alunos.sort((a, b) => a - b);
  return {
    n,
    reported: vals.length,
    below,
    edge,
    nd,
    missing: n - vals.length - nd,
    shortfall,
    belowNoBase,
    median: quant(vals, 0.5),
    p25: quant(vals, 0.25),
    p75: quant(vals, 0.75),
    funReported: funs.length,
    funBelow,
    funMedian: quant(funs, 0.5),
    alunoMedian: quant(alunos, 0.5),
    popBelow,
    pop,
    belowAtip,
    shortfallAtip,
  };
}

/** "R$ 12 mi", or a note when some (or all) of the municipalities below 25% have no known tax base. */
export function shortfallLabel(s: Stats): { value: string; note: string | null } {
  if (!s.below) return { value: "R$ 0", note: null };
  if (s.belowNoBase === s.below) return { value: "não estimado", note: "sem receita declarada para calcular" };
  const v = brlShort(s.shortfall);
  return s.belowNoBase
    ? { value: `${v}+`, note: `${s.belowNoBase} de ${s.below} sem receita declarada para estimar` }
    : { value: v, note: null };
}
/** The trend of R$ shortfall is only meaningful when most of the municipalities below have a base. */
export const shortfallKnown = (s: Stats) => (s.belowNoBase <= s.below * 0.25 ? s.shortfall : null);

/** Share of reporting municipalities below the minimum, 0–100 (null when nobody reported). */
export const belowShare = (s: Stats) => (s.reported ? (s.below / s.reported) * 100 : null);

/** Times a municipality stayed below 25% across all published years. */
export const timesBelow = (r: Row) => r.mde.reduce<number>((n, v) => n + (v != null && v < MDE_MIN ? 1 : 0), 0);

// ---- transport: rows as positional arrays, ~40% smaller than keyed objects.
// Positions 0–10 are the original format; 11 capital (0/1), 12 since (0 = none), 13 atip (bitmasks or 0) are
// appended and trailing defaults are trimmed, so most rows stay 11 long.
type Packed = [
  number, string, string, string, number, string, (number | null)[], (number | null)[], (number | null)[], (number | null)[], number,
  (0 | 1)?, number?, (number[] | 0)?,
];

export function packRows(rows: Row[]): Packed[] {
  return rows.map((r) => {
    const p: Packed = [
      r.id, r.name, r.slug, r.uf, r.pop, r.inter, r.mde, r.fun, r.short, r.aluno,
      r.nd.reduce((m, b, i) => (b ? m | (1 << i) : m), 0),
    ];
    if (r.capital || r.since || r.atip) p.push(r.capital ? 1 : 0);
    if (r.since || r.atip) p.push(r.since ?? 0);
    if (r.atip) p.push(r.atip);
    return p;
  });
}

export function unpackRows(p: Packed[], nYears: number): Row[] {
  return p.map(([id, name, slug, uf, pop, inter, mde, fun, short, aluno, nd, capital, since, atip]) => {
    const r: Row = {
      id, name, slug, uf, pop, inter, mde, fun, short, aluno,
      nd: Array.from({ length: nYears }, (_, i) => (nd & (1 << i)) !== 0),
    };
    if (capital) r.capital = true;
    if (since) r.since = since;
    if (atip) r.atip = atip;
    return r;
  });
}

export type RowsFile = { years: number[]; rows: Packed[] };

/** Re-index rows to `years` (the page's own list), so a cached file from another build can't shift years. */
export function alignRows(f: { years: number[]; rows: Row[] }, years: number[]): Row[] {
  if (f.years.length === years.length && f.years.every((y, i) => y === years[i])) return f.rows;
  const idx = years.map((y) => f.years.indexOf(y));
  const pick = <T,>(a: T[], empty: T) => idx.map((i) => (i < 0 ? empty : a[i]));
  return f.rows.map((r) => ({
    ...r,
    mde: pick(r.mde, null), fun: pick(r.fun, null), aluno: pick(r.aluno, null),
    short: pick<number | null>(r.short, 0), nd: pick(r.nd, false),
    ...(r.atip ? { atip: pick(r.atip, 0) } : {}),
    ...(r.alt ? { alt: pick(r.alt, null) } : {}),
  }));
}

let rowsPromise: Promise<{ years: number[]; rows: Row[] }> | null = null;
/** Client: fetch every municipality once per session (shared by maps, explorer, search and watchlist). */
export function loadAllRows() {
  rowsPromise ??= fetch(`/data/municipios.json?v=${DATA_VERSION}`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<RowsFile>;
    })
    .then((f) => ({ years: f.years, rows: unpackRows(f.rows, f.years.length) }))
    .catch((e) => {
      rowsPromise = null;
      throw e;
    });
  return rowsPromise;
}

// ---- territory summaries computed on the server and handed to client dashboards
export type UfSummary = { uf: string; name: string; region: "N" | "NE" | "SE" | "S" | "CO"; stats: Stats[]; gov: (number | null)[] };
export type RegionSummary = { key: "N" | "NE" | "SE" | "S" | "CO"; slug: string; name: string; ufs: string[]; stats: Stats[] };
export type Deficit = {
  id: number; name: string; uf: string; slug: string; pop: number; below: number[]; carry: number;
  /** same balance in R$ of IPCA_BASE */
  carryReal: number;
  /** years in `below` whose record is flagged atypical (MDE % or revenue base) */
  atipYears: number[];
};

// ---- finance columns for exports (GOV-09): fetched only when exporting
export type FinanceRow = {
  base: (number | null)[];
  mdeV: (number | null)[];
  /** 1 = mdeV estimated by the Radar */
  est: (0 | 1)[];
  funLeft: (number | null)[];
};
export type Finance = { years: number[]; get: (id: number) => FinanceRow | undefined };
type FinanceFile = { years: number[]; rows: [number, (number | null)[], (number | null)[], number, (number | null)[]][] };

let financePromise: Promise<Finance> | null = null;
/** Client: revenue base, R$ applied and Fundeb left per municipality and year (/data/financas.json). */
export function loadFinance(): Promise<Finance> {
  financePromise ??= fetch(`/data/financas.json?v=${DATA_VERSION}`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<FinanceFile>;
    })
    .then((f) => {
      const m = new Map<number, FinanceRow>();
      for (const [id, base, mdeV, est, funLeft] of f.rows)
        m.set(id, { base, mdeV, funLeft, est: f.years.map((_, i) => ((est >> i) & 1) as 0 | 1) });
      return { years: f.years, get: (id: number) => m.get(id) };
    })
    .catch((e) => {
      financePromise = null;
      throw e;
    });
  return financePromise;
}
