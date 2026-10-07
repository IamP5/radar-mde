/**
 * Server-only access to the national dataset produced by scripts/build_data.py.
 * The city file is ~12 MB, so it is read from disk once per process instead of being bundled.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import meta from "@/data/meta.json";
import { MDE_MIN, shortfall } from "./format";
import { REGIONS, UFS, getRegion, type RegionKey, type Scope, scopeUfs } from "./geo";
import { ATIP_BITS, aggregate, type CityYear, type Deficit, type RegionSummary, type Row, type Stats, type UfSummary } from "./rows";

export * from "./format";
export type { AtipCode, CityYear, Deficit, RegionSummary, Row, Stats, UfSummary } from "./rows";
export { ATIP_LABEL, DATA_VERSION, atipOf, deltaPp, existedIn, isAtip } from "./rows";

/** Years with (near) complete national coverage. */
export const YEARS: number[] = meta.years;
export const UPDATED: string = meta.updated;

/** Dataset metadata for footers, /dados and /sobre (see qa/fixes/CONTRACT.md §5). */
export const META = {
  /** data version: build date + content hash */
  version: meta.version,
  /** ISO date of the build */
  updated: meta.updated,
  /** ISO date the raw SIOPE files were downloaded */
  extracted: meta.extracted,
  /** population is a single estimate (this year) applied to every year */
  popYear: meta.popYear,
  popSource: meta.popSource,
  license: meta.license,
  licenseUrl: meta.licenseUrl,
  /** municipalities that existed in each year */
  nByYear: meta.nByYear as Record<string, number>,
  /** municipalities with an MDE % in each year */
  coverage: meta.coverage as Record<string, number>,
  /** IBGE code → installation year, for municipalities created after 2008 */
  installed: meta.installed as Record<string, number>,
};

/** "07/10/2026" from an ISO date. */
export const dateBR = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");

export type City = {
  id: number;
  name: string;
  slug: string;
  uf: string;
  pop: number;
  inter: string | null;
  imediata: string | null;
  capital: boolean;
  /** IBGE installation year, only for municipalities created after 2008; no records before it */
  since?: number;
  years: Partial<Record<string, CityYear>>;
};

export type StateGov = { uf: string; code: number; name: string; region: RegionKey; years: Partial<Record<string, CityYear>> };

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "data", f), "utf8"));

let _cities: City[] | null = null;
export function allCities(): City[] {
  return (_cities ??= read<City[]>("cities.json"));
}

let _states: Map<string, StateGov> | null = null;
export function stateGov(uf: string): StateGov | undefined {
  _states ??= new Map(read<StateGov[]>("states.json").map((s) => [s.uf, s]));
  return _states.get(uf);
}

let _byUf: Map<string, City[]> | null = null;
export function citiesOf(uf: string): City[] {
  if (!_byUf) {
    _byUf = new Map(UFS.map((u) => [u.uf, [] as City[]]));
    for (const c of allCities()) _byUf.get(c.uf)!.push(c);
    for (const list of _byUf.values()) list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  return _byUf.get(uf.toUpperCase()) ?? [];
}

export const citiesIn = (s: Scope) => scopeUfs(s).flatMap(citiesOf);

export function getCity(uf: string, slug: string) {
  return citiesOf(uf).find((c) => c.slug === slug);
}

export function toRow(c: City): Row {
  const row: Row = {
    id: c.id,
    name: c.name,
    slug: c.slug,
    uf: c.uf,
    pop: c.pop,
    inter: c.inter ?? "—",
    mde: YEARS.map((y) => c.years[y]?.mde ?? null),
    fun: YEARS.map((y) => c.years[y]?.fun ?? null),
    nd: YEARS.map((y) => c.years[y]?.s === "nd"),
    short: YEARS.map((y) => {
      const r = c.years[y];
      return r?.mde != null && r.mde < MDE_MIN && r.base == null ? null : Math.round(shortfall(r));
    }),
    aluno: YEARS.map((y) => c.years[y]?.perAluno ?? null),
  };
  if (YEARS.some((y) => c.years[y]?.alt != null)) row.alt = YEARS.map((y) => c.years[y]?.alt ?? null);
  if (c.capital) row.capital = true;
  if (c.since) row.since = c.since;
  const atip = YEARS.map((y) => (c.years[y]?.atip ?? []).reduce((m, k) => m | ATIP_BITS[k], 0));
  if (atip.some(Boolean)) row.atip = atip;
  return row;
}

const rowCache = new Map<number, Row>();
export const rowOf = (c: City) => {
  let r = rowCache.get(c.id);
  if (!r) rowCache.set(c.id, (r = toRow(c)));
  return r;
};
export const rowsIn = (s: Scope) => citiesIn(s).map(rowOf);

/** Per-year aggregate statistics for a scope, memoised (each page asks for several scopes). */
const statsCache = new Map<string, Stats[]>();
export function scopeStats(s: Scope): Stats[] {
  const key = s.level === "br" ? "br" : s.level === "region" ? `r:${s.region}` : `uf:${s.uf}`;
  let v = statsCache.get(key);
  if (!v) {
    const rows = rowsIn(s);
    statsCache.set(key, (v = YEARS.map((y, i) => aggregate(rows, i, y))));
  }
  return v;
}

export const brStats = () => scopeStats({ level: "br" });
export const regionStats = (r: RegionKey) => scopeStats({ level: "region", region: r });
export const ufStats = (uf: string) => scopeStats({ level: "uf", uf });

/** Compact summary per UF (all years) for national/regional tables and maps. */
export function ufSummaries(ufs: string[] = UFS.map((u) => u.uf)): UfSummary[] {
  return ufs.map((uf) => {
    const u = UFS.find((x) => x.uf === uf)!;
    const g = stateGov(uf);
    return { uf, name: u.name, region: u.region, stats: ufStats(uf), gov: YEARS.map((y) => g?.years[y]?.mde ?? null) };
  });
}

export const regionSummaries = (): RegionSummary[] =>
  REGIONS.map((r) => ({ key: r.key, slug: r.slug, name: r.name, ufs: r.ufs, stats: regionStats(r.key) }));

/**
 * Running uncompensated deficit: each year's shortfall adds to the balance and
 * each year's surplus above 25% pays it down (never below zero). Mirrors the
 * compensation reasoning used in Silva (2021) for Santo André.
 */
export function deficitTrail(c: City) {
  let carry = 0;
  return YEARS.map((y) => {
    const r = c.years[y];
    if (r?.mde != null && r.base != null) carry = Math.max(0, carry + ((MDE_MIN - r.mde) / 100) * r.base);
    return { year: y, carry, shortfall: shortfall(r), rec: r };
  });
}

export function latestYear(c: City): number | null {
  for (let i = YEARS.length - 1; i >= 0; i--) if (c.years[YEARS[i]]?.mde != null) return YEARS[i];
  return null;
}

export const yearsBelow = (c: City) => YEARS.filter((y) => (c.years[y]?.mde ?? 99) < MDE_MIN);

/** Latest year with (near) full coverage: the default for dashboards. */
export function defaultYear(): number {
  const st = brStats();
  const max = Math.max(...st.map((s) => s.reported));
  for (let i = YEARS.length - 1; i >= 0; i--) if (st[i].reported >= max * 0.9) return YEARS[i];
  return YEARS[YEARS.length - 1];
}

/** Biggest uncompensated deficits in a scope. */
export function topDeficits(s: Scope, limit = 12): Deficit[] {
  return citiesIn(s)
    .map((c) => ({ c, below: yearsBelow(c), carry: deficitTrail(c).at(-1)!.carry }))
    .filter((x) => x.carry > 0)
    .sort((a, b) => b.carry - a.carry)
    .slice(0, limit)
    .map(({ c, below, carry }) => ({ id: c.id, name: c.name, uf: c.uf, slug: c.slug, pop: c.pop, below, carry }));
}

/** Rank (1 = highest MDE %) of a municipality among those reporting in the same year. */
export function rankIn(c: City, s: Scope, year: number) {
  const v = c.years[year]?.mde;
  if (v == null) return null;
  const vals = citiesIn(s).map((x) => x.years[year]?.mde).filter((x): x is number => x != null);
  return { pos: 1 + vals.filter((x) => x > v).length, of: vals.length };
}

export { getRegion };
