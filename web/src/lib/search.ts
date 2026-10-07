/**
 * Client search over territories (Brasil, regiões, UFs) and the 5.570 municipalities.
 * Pure functions, no React: used by the ⌘K palette. Accent-, case- and punctuation-insensitive (normKey).
 *
 * Ranking scale shared by every kind of result, so an exact state name beats a city that merely starts with it:
 *   0 exact · 1 prefix · 2 word-prefix · 3 substring · 4 all words present · 5+ typo-tolerant ("você quis dizer")
 * Ties: territories first, then by population.
 */
import { norm, normKey } from "./format";
import { REGIONS, UFS, cityPath, getRegion, getUf, regionPath, ufPath, type RegionKey } from "./geo";

export type SearchCity = { name: string; uf: string; slug: string; pop: number; key: string; compact: string };

export type Kind = "region" | "uf" | "city" | "link";

export type Option = {
  /** lowercase, unique: also the cmdk item value */
  id: string;
  kind: Kind;
  href: string;
  label: string;
  sub: string;
  uf?: string;
  pop?: number;
  hl?: [number, number];
};

/** Lowercase, accent-free, punctuation → space; length-preserving for NFC input so indices map back to the name. */
const keyOf = (s: string) => norm(s.normalize("NFC")).replace(/[^a-z0-9]/g, " ");

export function toSearchCity(c: { name: string; uf: string; slug: string; pop: number }): SearchCity {
  const key = keyOf(c.name);
  return { name: c.name, uf: c.uf, slug: c.slug, pop: c.pop, key, compact: key.replace(/ /g, "") };
}

export const queryTokens = (q: string) => normKey(q).split(" ").filter(Boolean);

/* ---------- territories ---------- */

export const BRASIL: Option = { id: "br", kind: "region", href: "/", label: "Brasil", sub: "País · 27 UFs" };

export const regionOption = (r: (typeof REGIONS)[number]): Option => ({
  id: `r:${r.key.toLowerCase()}`,
  kind: "region",
  href: regionPath(r.key),
  label: `Região ${r.name}`,
  sub: `${r.ufs.length} estados`,
});

export const ufOption = (u: (typeof UFS)[number]): Option => ({
  id: `u:${u.uf.toLowerCase()}`,
  kind: "uf",
  href: ufPath(u.uf),
  label: u.name,
  sub: `Estado · Região ${getRegion(u.region).name}`,
  uf: u.uf,
});

const CAPITAIS: Option = {
  id: "l:capitais",
  kind: "link",
  href: "/explorar?capital=1",
  label: "Capitais",
  sub: "As 27 capitais na tabela do Explorar",
};

type Territory = { opt: Option; keys: string[]; sigla?: string };

const TERRITORIES: Territory[] = [
  { opt: BRASIL, keys: ["brasil", "pais"] },
  ...REGIONS.map((r) => ({ opt: regionOption(r), keys: [normKey(r.name), `regiao ${normKey(r.name)}`] })),
  ...UFS.map((u) => ({ opt: ufOption(u), keys: [normKey(u.name), `estado ${normKey(u.name)}`], sigla: u.uf.toLowerCase() })),
];

const collator = new Intl.Collator("pt-BR");
export const ALL_UFS = [...UFS].sort((a, b) => collator.compare(a.name, b.name)).map(ufOption);
export const ALL_REGIONS = [BRASIL, ...REGIONS.map(regionOption)];

/* ---------- query readings ---------- */

type Filter = { uf?: string; region?: RegionKey };
type Reading = { text: string; filter: Filter; raw: boolean };

const PLACE_NAMES = [
  ...UFS.map((u) => ({ key: normKey(u.name).split(" "), filter: { uf: u.uf } as Filter })),
  ...REGIONS.map((r) => ({ key: normKey(r.name).split(" "), filter: { region: r.key } as Filter })),
].sort((a, b) => b.key.length - a.key.length); // longest first: "rio grande do sul" before "sul"

const isSigla = (t: string) => t.length === 2 && !!getUf(t);
const startsWithSeq = (tokens: string[], seq: string[], at: number) => seq.every((t, i) => tokens[at + i] === t);

/** Common abbreviations in Brazilian place names. */
const ABBREV: Record<string, string> = {
  sto: "santo", sta: "santa", s: "sao", sr: "senhor", sra: "senhora", n: "nossa", ns: "nossa", nsa: "nossa", nss: "nossa",
  pres: "presidente", pdte: "presidente", gov: "governador", mal: "marechal", cel: "coronel", dr: "doutor",
  sen: "senador", dep: "deputado", eng: "engenheiro", prof: "professor", gal: "general", gen: "general", mte: "monte",
  pto: "porto", fco: "francisco",
};

function expand(tokens: string[]): string[] {
  return tokens.map((t, i) => {
    const e = ABBREV[t];
    if (!e) return t;
    // "n"/"ns" only mean "nossa" before "senhora"/"sra"; a single "s" only expands before another word
    if (e === "nossa") return tokens[i + 1] === "sra" || tokens[i + 1] === "senhora" ? e : t;
    if (t === "s") return i < tokens.length - 1 ? e : t;
    return e;
  });
}

/** Interpretations of the query: as typed, plus with a UF/region pulled out ("santo andre sp", "bom jesus goias"). */
function readings(tokens: string[]): Reading[] {
  const out: Reading[] = [{ text: tokens.join(" "), filter: {}, raw: true }];
  const i = tokens.findIndex(isSigla);
  if (i >= 0 && tokens.length > 1) {
    out.push({ text: tokens.filter((_, j) => j !== i).join(" "), filter: { uf: tokens[i].toUpperCase() }, raw: false });
  }
  for (const p of PLACE_NAMES) {
    const n = p.key.length;
    if (tokens.length <= n) continue;
    let rest: string[] | null = null;
    if (startsWithSeq(tokens, p.key, tokens.length - n)) rest = tokens.slice(0, -n);
    else if (startsWithSeq(tokens, p.key, 0)) rest = tokens.slice(n);
    if (!rest) continue;
    // "sao paulo sp" must not read as "sp" inside São Paulo state (FUN-11)
    if (rest.length === 1 && isSigla(rest[0])) break;
    out.push({ text: rest.join(" "), filter: p.filter, raw: false });
    break;
  }
  return out;
}

/** 0 exact, 1 prefix, 2 word-prefix, 3 substring, 4 every word starts a word; -1 no match. */
function rankName(c: { key: string; compact: string }, q: string): number {
  if (!q) return 2;
  const { key } = c;
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if (` ${key}`.includes(` ${q}`)) return 2;
  if (q.length >= 3 && key.includes(q)) return 3;
  const qc = q.replace(/ /g, "");
  if (qc.length >= 4 && c.compact.startsWith(qc)) return 1; // "dagua" ≈ "d agua", "embuguacu"
  const words = q.split(" ");
  if (words.length > 1 && words.every((w) => ` ${key}`.includes(` ${w}`))) return 4;
  if (qc.length >= 4 && c.compact.includes(qc)) return 3;
  return -1;
}

const passes = (c: SearchCity, f: Filter) =>
  (!f.uf || c.uf === f.uf) && (!f.region || getUf(c.uf)?.region === f.region);

/* ---------- typo tolerance ---------- */

/** Optimal-string-alignment distance, bailing out above `max`. */
function dist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

const tolerance = (w: string) => (w.length <= 3 ? 0 : w.length <= 6 ? 1 : 2);

/** Sum of per-word edit distances when every query word is close to some word of the name; -1 otherwise. */
function fuzzyScore(key: string, words: string[]): number {
  const names = key.split(" ").filter(Boolean);
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const tol = tolerance(w);
    const last = i === words.length - 1;
    let best = tol + 1;
    for (const nw of names) {
      if (nw === w || (last && nw.startsWith(w))) { best = 0; break; }
      if (!tol) continue;
      best = Math.min(best, dist(w, nw, tol));
      // the word being typed may be an unfinished, misspelled prefix
      if (last && nw.length > w.length) best = Math.min(best, dist(w, nw.slice(0, w.length), tol));
    }
    if (best > tol) return -1;
    total += best;
  }
  return total;
}

/* ---------- search ---------- */

export type SearchResult = {
  /** best first; territories and municipalities interleaved by rank */
  items: Option[];
  /** total matches before the limit */
  total: number;
  /** municipality matches (before the limit) */
  cityTotal: number;
  /** results come from the typo-tolerant pass */
  fuzzy: boolean;
};

type Hit = { o: Option | null; c?: SearchCity; q?: string; rank: number; order: number; pop: number };

function cityOption(c: SearchCity, q?: string): Option {
  const at = q ? c.key.indexOf(q) : -1;
  return {
    id: `c:${c.uf.toLowerCase()}/${c.slug}`,
    kind: "city",
    href: cityPath(c.uf, c.slug),
    label: c.name,
    sub: getRegion(getUf(c.uf)!.region).name,
    uf: c.uf,
    pop: c.pop,
    hl: at >= 0 && q && c.key.length === c.name.length ? [at, at + q.length] : undefined,
  };
}

export function search(cities: SearchCity[] | null, query: string, limit: number): SearchResult {
  const tokens = queryTokens(query);
  if (!tokens.length) return { items: [], total: 0, cityTotal: 0, fuzzy: false };
  const q = tokens.join(" ");

  const hits: Hit[] = [];

  // Territories: same rank scale; exact sigla counts as exact
  for (const t of TERRITORIES) {
    let r = t.sigla === q ? 0 : -1;
    for (const k of t.keys) {
      const kr = rankName({ key: k, compact: k.replace(/ /g, "") }, q);
      if (kr >= 0 && kr <= 2 && (r < 0 || kr < r)) r = kr;
    }
    if (r >= 0) hits.push({ o: t.opt, rank: r, order: 0, pop: 0 });
  }
  if (q.length >= 5 && ("capitais".startsWith(q) || q.startsWith("capita"))) {
    hits.push({ o: CAPITAIS, rank: q === "capitais" || q === "capital" ? 0 : 1, order: 1, pop: 0 });
  }

  let cityTotal = 0;
  let fuzzy = false;
  if (cities) {
    const variants = [tokens];
    const ex = expand(tokens);
    if (ex.join(" ") !== q) variants.push(ex);
    const rs = variants.flatMap(readings).filter((r) => r.text || r.filter.uf || r.filter.region);
    const filtered = rs.filter((r) => !r.raw);
    const raw = rs.filter((r) => r.raw);

    const best = (c: SearchCity, list: Reading[], maxRank = 99) => {
      let b = -1;
      let bq = "";
      for (const r of list) {
        if (!passes(c, r.filter)) continue;
        const rank = rankName(c, r.text);
        if (rank >= 0 && rank <= maxRank && (b < 0 || rank < b)) {
          b = rank;
          bq = r.text;
        }
      }
      return [b, bq] as const;
    };

    // With a UF/region in the query, the as-typed reading only counts for exact/prefix names
    // (so "bom jesus go" doesn't match "Córrego do Bom Jesus", but "Sul Brasil" still matches itself).
    let cityHits: Hit[] = [];
    if (filtered.length) {
      for (const c of cities) {
        const [fr, fq] = best(c, filtered);
        const [rr, rq] = best(c, raw, 1);
        const useRaw = rr >= 0 && (fr < 0 || rr < fr);
        const rank = useRaw ? rr : fr;
        if (rank >= 0) cityHits.push({ o: null, c, q: useRaw ? rq : fq, rank, order: 2, pop: c.pop });
      }
    }
    if (!cityHits.length) {
      cityHits = [];
      for (const c of cities) {
        const [rr, rq] = best(c, raw);
        if (rr >= 0) cityHits.push({ o: null, c, q: rq, rank: rr, order: 2, pop: c.pop });
      }
    }

    // Nothing at all: typo-tolerant pass ("conceicao do almeda", "itapetininaga")
    if (!cityHits.length && !hits.length && q.length >= 4) {
      const fz = rs.filter((r) => r.text.length >= 3);
      for (const c of cities) {
        let s = -1;
        for (const r of fz) {
          if (!passes(c, r.filter)) continue;
          const v = fuzzyScore(c.key, r.text.split(" "));
          if (v >= 0 && (s < 0 || v < s)) s = v;
        }
        if (s >= 0) cityHits.push({ o: null, c, rank: 5 + s, order: 2, pop: c.pop });
      }
      fuzzy = cityHits.length > 0;
    }
    cityTotal = cityHits.length;
    hits.push(...cityHits);
  }

  hits.sort((a, b) => a.rank - b.rank || a.order - b.order || b.pop - a.pop);
  const items = hits.slice(0, limit).map((h) => h.o ?? cityOption(h.c!, h.q));
  return { items, total: hits.length, cityTotal, fuzzy };
}
