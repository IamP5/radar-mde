/**
 * Compact per-municipality rows (one array slot per published year) and the aggregate statistics computed
 * over any set of them. Client-safe: dashboards filter rows in the browser and re-aggregate on the fly.
 */
import { MDE_MIN, brlShort, funMin } from "./format";

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
};

export type Stats = {
  /** municipalities in scope */
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
  let below = 0, edge = 0, nd = 0, shortfall = 0, belowNoBase = 0, popBelow = 0, pop = 0, funBelow = 0;
  for (const r of rows) {
    pop += r.pop;
    const v = r.mde[yi];
    if (v != null) {
      vals.push(v);
      if (v < MDE_MIN) {
        below++;
        popBelow += r.pop;
        const sh = r.short[yi];
        if (sh == null) belowNoBase++;
        else shortfall += sh;
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
    n: rows.length,
    reported: vals.length,
    below,
    edge,
    nd,
    missing: rows.length - vals.length - nd,
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

// ---- transport: rows as positional arrays, ~40% smaller than keyed objects
type Packed = [number, string, string, string, number, string, (number | null)[], (number | null)[], (number | null)[], (number | null)[], number];

export function packRows(rows: Row[]): Packed[] {
  return rows.map((r) => [
    r.id, r.name, r.slug, r.uf, r.pop, r.inter, r.mde, r.fun, r.short, r.aluno,
    r.nd.reduce((m, b, i) => (b ? m | (1 << i) : m), 0),
  ]);
}

export function unpackRows(p: Packed[], nYears: number): Row[] {
  return p.map(([id, name, slug, uf, pop, inter, mde, fun, short, aluno, nd]) => ({
    id, name, slug, uf, pop, inter, mde, fun, short, aluno,
    nd: Array.from({ length: nYears }, (_, i) => (nd & (1 << i)) !== 0),
  }));
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
  }));
}

let rowsPromise: Promise<{ years: number[]; rows: Row[] }> | null = null;
/** Client: fetch every municipality once per session (shared by maps, explorer, search and watchlist). */
export function loadAllRows() {
  rowsPromise ??= fetch("/data/municipios.json")
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
export type Deficit = { id: number; name: string; uf: string; slug: string; pop: number; below: number[]; carry: number };
