/** Colour scales for maps and tables. Colours are CSS tokens (globals.css) so dark mode gets its own steps. */
import { MDE_MIN, funMin, pct } from "./format";

export type Bin = { key: string; label: string; color: string; test: (v: number) => boolean };

export const NO_DATA_COLOR = "var(--bin-nd)";

/** Diverging scale centred on the 25% constitutional minimum (red = below, blue = above). */
export const BINS: Bin[] = [
  { key: "b1", label: "< 22%", color: "var(--bin-1)", test: (v) => v < 22 },
  { key: "b2", label: "22–25%", color: "var(--bin-2)", test: (v) => v >= 22 && v < MDE_MIN },
  { key: "b3", label: "25–26%", color: "var(--bin-3)", test: (v) => v >= MDE_MIN && v < 26 },
  { key: "b4", label: "26–30%", color: "var(--bin-4)", test: (v) => v >= 26 && v < 30 },
  { key: "b5", label: "≥ 30%", color: "var(--bin-5)", test: (v) => v >= 30 },
];

export function binColor(v: number | null | undefined) {
  if (v == null) return NO_DATA_COLOR;
  return (BINS.find((b) => b.test(v)) ?? BINS[4]).color;
}

/** Fundeb share paid to professionals: diverging around that year's legal minimum. */
export function funBins(year: number): Bin[] {
  const m = funMin(year);
  return [
    { key: "f1", label: `< ${m - 10}%`, color: "var(--bin-1)", test: (v) => v < m - 10 },
    { key: "f2", label: `${m - 10}–${m}%`, color: "var(--bin-2)", test: (v) => v >= m - 10 && v < m },
    { key: "f3", label: `${m}–${m + 5}%`, color: "var(--bin-3)", test: (v) => v >= m && v < m + 5 },
    { key: "f4", label: `${m + 5}–${m + 20}%`, color: "var(--bin-4)", test: (v) => v >= m + 5 && v < m + 20 },
    { key: "f5", label: `≥ ${m + 20}%`, color: "var(--bin-5)", test: (v) => v >= m + 20 },
  ];
}

const SEQ = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];

const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v)));

/** Nominal R$ per student grows every year, so the classes are that year's quintiles (sequential blue). */
export function quintileBins(values: number[]): Bin[] {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (s.length < 5) return [{ key: "q", label: "valores", color: SEQ[2], test: () => true }];
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => s[Math.floor(q * s.length)]);
  const lo = [-Infinity, ...cuts];
  const hi = [...cuts, Infinity];
  return SEQ.map((color, i) => ({
    key: `q${i}`,
    color,
    label: i === 0 ? `< R$ ${fmtK(hi[0])}` : i === 4 ? `≥ R$ ${fmtK(lo[4])}` : `R$ ${fmtK(lo[i])}–${fmtK(hi[i])}`,
    test: (v: number) => v >= lo[i] && v < hi[i],
  }));
}

/** Share (0–100) of a territory's municipalities below the minimum: sequential red, 0% stays neutral. */
export const SHARE_BINS: Bin[] = [
  { key: "s0", label: "0%", color: "var(--bin-3)", test: (v) => v === 0 },
  { key: "s1", label: "até 2%", color: "var(--red-1)", test: (v) => v > 0 && v < 2 },
  { key: "s2", label: "2–5%", color: "var(--red-2)", test: (v) => v >= 2 && v < 5 },
  { key: "s3", label: "5–10%", color: "var(--red-3)", test: (v) => v >= 5 && v < 10 },
  { key: "s4", label: "10–25%", color: "var(--red-4)", test: (v) => v >= 10 && v < 25 },
  { key: "s5", label: "≥ 25%", color: "var(--red-5)", test: (v) => v >= 25 },
];

export const colorOf = (bins: Bin[], v: number | null | undefined) =>
  v == null ? NO_DATA_COLOR : (bins.find((b) => b.test(v)) ?? bins[bins.length - 1]).color;

/** Bins whose dark fill needs light text on top (heat-strip cells). */
export const isDark = (color: string) => /bin-1|bin-5|red-4|red-5|seq-4|seq-5/.test(color);

export type MetricKey = "mde" | "fun" | "aluno";
export const METRICS: { key: MetricKey; label: string; short: string; fmt: (v: number) => string }[] = [
  { key: "mde", label: "% da receita de impostos aplicado em MDE", short: "MDE (%)", fmt: (v) => pct(v) },
  { key: "fun", label: "% do Fundeb pago aos profissionais da educação", short: "Fundeb pessoal (%)", fmt: (v) => pct(v) },
  { key: "aluno", label: "Investimento por aluno (R$/ano, nominal)", short: "R$ por aluno", fmt: (v) => `R$ ${Math.round(v).toLocaleString("pt-BR")}` },
];
