/** Indicators, colour layers and scope helpers shared by the map stage and the panels. Client-safe. */
import { BINS, SHARE_BINS, funBins, quintileBins, type Bin } from "@/lib/bins";
import { MDE_MIN, funMin, int, pct } from "@/lib/format";
import { UFS } from "@/lib/geo";
import { IPCA_BASE, belowShare, toReal, type Row, type Stats, type UfSummary } from "@/lib/rows";

export type Ind = "mde" | "fun" | "aluno" | "rec";
export type Level = "mun" | "uf";
export type UfVar = "share" | "median" | "gov";
export type Scope = { uf: string | null; city: number | null };

export const INDS: { key: Ind; label: string; long: string; unit: string }[] = [
  { key: "mde", label: "% em educação", long: "% da receita de impostos aplicada em educação (MDE); mínimo constitucional de 25%", unit: "% em educação" },
  { key: "fun", label: "Fundeb", long: "% do Fundeb pago aos profissionais da educação; mínimo legal de 60% (70% desde 2021)", unit: "Fundeb em pessoal" },
  { key: "aluno", label: "R$ por aluno", long: "Investimento em educação por aluno, por ano, corrigido pelo IPCA", unit: "R$ por aluno" },
  { key: "rec", label: "Anos abaixo", long: "Em quantos anos o município ficou abaixo de 25%, de 2008 até o ano escolhido", unit: "Anos abaixo de 25%" },
];
export const UF_VARS: { key: UfVar; label: string; long: string }[] = [
  { key: "share", label: "% abaixo de 25%", long: "% dos municípios abaixo de 25%" },
  { key: "median", label: "Mediana", long: "MDE mediana dos municípios" },
  { key: "gov", label: "Governo estadual", long: "MDE do governo estadual" },
];

const REC_BINS: Bin[] = [
  { key: "r0", label: "Nunca", color: "var(--rec-0)", test: (v) => v === 0 },
  { key: "r1", label: "1 ano", color: "var(--red-1)", test: (v) => v === 1 },
  { key: "r2", label: "2 anos", color: "var(--red-2)", test: (v) => v === 2 },
  { key: "r3", label: "3–4 anos", color: "var(--red-4)", test: (v) => v >= 3 && v <= 4 },
  { key: "r4", label: "5 anos ou mais", color: "var(--red-5)", test: (v) => v >= 5 },
];

export const ufCode = (uf: string) => UFS.find((u) => u.uf === uf)!.code;
export const ufSigla = (code: number) => UFS.find((u) => u.code === code)!.uf;

export type Layer = {
  level: Level;
  ind: Ind;
  title: string;
  bins: Bin[];
  /** value of a municipality id (level "mun") or UF code (level "uf") */
  valueOf: (id: number) => number | null;
  binOf: (id: number) => Bin | null;
  fmt: (v: number) => string;
  /** municipalities that declared nothing (shown hatched-dim) */
  notDeclared: (id: number) => boolean;
};

export type LayerInput = {
  ind: Ind;
  level: Level;
  ufVar: UfVar;
  year: number;
  yi: number;
  rows: Row[] | null;
  byId: Map<number, Row> | null;
  ufs: UfSummary[];
  years: number[];
  /** leave the pandemic years out of "Anos abaixo" */
  skipPandemic?: boolean;
};

const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

/**
 * 2020–21: EC 119/2022 exempts municipalities that missed 25% in those pandemic years and compensated by 2023.
 * The map shades them on charts and lets "Anos abaixo" leave them out.
 */
export const PANDEMIC = [2020, 2021];
export const pandemicIdx = (years: number[]) => new Set(PANDEMIC.map((y) => years.indexOf(y)).filter((i) => i >= 0));

/**
 * Years below 25% from the first published year up to (and including) index `yi`: the recurrence map accumulates
 * as the timeline plays. Indices in `skip` (the pandemic years, when the toggle is off) are not counted.
 */
export const timesBelowUntil = (r: Row, yi: number, skip?: Set<number>) => {
  let n = 0;
  for (let i = 0; i <= yi && i < r.mde.length; i++) if (!skip?.has(i) && r.mde[i] != null && r.mde[i]! < MDE_MIN) n++;
  return n;
};

/** R$ per student in R$ of IPCA_BASE, so playback shows real growth instead of inflation. */
export const alunoReal = (v: number | null | undefined, year: number) => toReal(v, year);
export const ALUNO_UNIT = `R$ de ${IPCA_BASE} (IPCA)`;

/** State medians of MDE sit in a narrow 24–32% band: their own classes, so the map isn't one colour. */
const MEDIAN_BINS: Bin[] = [
  { key: "m1", label: "< 25%", color: "var(--bin-2)", test: (v) => v < MDE_MIN },
  { key: "m2", label: "25–26%", color: "var(--bin-3)", test: (v) => v >= MDE_MIN && v < 26 },
  { key: "m3", label: "26–27%", color: "var(--seq-2)", test: (v) => v >= 26 && v < 27 },
  { key: "m4", label: "27–28%", color: "var(--bin-4)", test: (v) => v >= 27 && v < 28 },
  { key: "m5", label: "≥ 28%", color: "var(--bin-5)", test: (v) => v >= 28 },
];

/** Share (0–100) of a UF's municipalities that were below 25% in 3+ years up to `yi`, from the municipal rows. */
export function recurrenceShare(rows: Row[] | null, yi: number, skip?: Set<number>): Map<number, number> {
  const m = new Map<number, { n: number; k: number }>();
  for (const r of rows ?? []) {
    const c = ufCode(r.uf);
    const e = m.get(c) ?? { n: 0, k: 0 };
    e.n++;
    if (timesBelowUntil(r, yi, skip) >= 3) e.k++;
    m.set(c, e);
  }
  return new Map([...m].map(([c, e]) => [c, (e.k / e.n) * 100]));
}

export function makeLayer(i: LayerInput): Layer {
  const { ind, level, yi, year, years } = i;
  const meta = INDS.find((x) => x.key === ind)!;
  const skip = ind === "rec" && i.skipPandemic ? pandemicIdx(years) : undefined;
  const last = years.length - 1;
  if (level === "mun") {
    const val = (r: Row | undefined) =>
      !r ? null : ind === "rec" ? (r.mde.some((v, k) => k <= yi && v != null) ? timesBelowUntil(r, yi, skip) : null) : ind === "aluno" ? alunoReal(r.aluno[yi], year) : r[ind][yi];
    // R$ per student: fixed classes (quintiles of the latest year, in real R$) so the colours move as the money does
    const bins =
      ind === "mde" ? BINS : ind === "fun" ? funBins(year) : ind === "rec" ? REC_BINS : quintileBins((i.rows ?? []).map((r) => alunoReal(r.aluno[last], years[last])).filter((v): v is number => v != null));
    const valueOf = (id: number) => val(i.byId?.get(id));
    const title = ind === "aluno" ? `R$ por aluno, em ${ALUNO_UNIT}` : ind === "rec" && skip ? `${meta.long}, sem contar 2020–21` : meta.long;
    return {
      level, ind, title, bins, valueOf,
      binOf: (id) => {
        const v = valueOf(id);
        return v == null ? null : (bins.find((b) => b.test(v)) ?? bins[bins.length - 1]);
      },
      fmt: ind === "aluno" ? money : ind === "rec" ? (v) => `${v} ${v === 1 ? "ano" : "anos"}` : (v) => pct(v),
      notDeclared: (id) => ind !== "rec" && !!i.byId?.get(id)?.nd[yi],
    };
  }
  // states
  const rec = ind === "rec" ? recurrenceShare(i.rows, yi, skip) : null;
  const byCode = new Map(i.ufs.map((u) => [ufCode(u.uf), u]));
  const val = (u: UfSummary | undefined): number | null => {
    if (!u) return null;
    const s = u.stats[yi];
    if (ind === "mde") return i.ufVar === "share" ? belowShare(s) : i.ufVar === "median" ? s.median : u.gov[yi];
    if (ind === "fun") return s.funReported ? (s.funBelow / s.funReported) * 100 : null;
    if (ind === "aluno") return alunoReal(s.alunoMedian, year);
    return null;
  };
  const valueOf = (id: number) => (rec ? (rec.get(id) ?? null) : val(byCode.get(id)));
  const shareLike = (ind === "mde" && i.ufVar === "share") || ind === "fun" || ind === "rec";
  const bins = shareLike
    ? SHARE_BINS
    : ind === "mde"
      ? i.ufVar === "median" ? MEDIAN_BINS : BINS
      : quintileBins(i.ufs.map((u) => alunoReal(u.stats[last].alunoMedian, years[last])).filter((v): v is number => v != null));
  const title =
    ind === "mde" ? UF_VARS.find((x) => x.key === i.ufVar)!.long : ind === "fun" ? "% dos municípios abaixo do mínimo do Fundeb" : ind === "aluno" ? `Mediana de R$ por aluno dos municípios, em ${ALUNO_UNIT}` : `% dos municípios abaixo de 25% em 3 ou mais anos${skip ? " (sem 2020–21)" : ""}`;
  return {
    level, ind, title, bins, valueOf,
    binOf: (id) => {
      const v = valueOf(id);
      return v == null ? null : (bins.find((b) => b.test(v)) ?? bins[bins.length - 1]);
    },
    fmt: shareLike ? (v) => pct(v, v < 10 && v > 0 ? 1 : 0) : ind === "aluno" ? money : (v) => pct(v),
    notDeclared: () => false,
  };
}

/** Municipality counts per legend class (plus "sem dados") over the rows in scope. */
export function legendCounts(layer: Layer, ids: number[]): { counts: number[]; nd: number } {
  const counts = layer.bins.map(() => 0);
  let nd = 0;
  for (const id of ids) {
    const b = layer.binOf(id);
    if (!b) nd++;
    else counts[layer.bins.indexOf(b)]++;
  }
  return { counts, nd };
}

/** Rows "in trouble" for the pulse markers: below 25% (MDE) or below the Fundeb minimum. */
export function isBad(ind: Ind, r: Row, yi: number, year: number): boolean {
  if (ind === "mde") {
    const v = r.mde[yi];
    return v != null && v < MDE_MIN;
  }
  if (ind === "fun") {
    const v = r.fun[yi];
    return v != null && v < funMin(year);
  }
  return false;
}

export const ufName = (uf: string) => UFS.find((u) => u.uf === uf)?.name ?? uf;

/** "Em 2025, 23 municípios…" headline fragments. */
export const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`;

export function seriesOf(stats: Stats[]) {
  return stats.map((s) => belowShare(s));
}
