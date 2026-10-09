/**
 * Year-dependent wording for the city page, shared by the server (metadata, OG image) and the client islands
 * (header, share text) so every surface says the same thing about the selected year.
 */
import type { StatusKind } from "@/components/kit/status";
import { MDE_MIN, PANDEMIC_YEARS, listYears, pct } from "@/lib/format";
import type { PeriodBalance } from "@/lib/rows";

/** Status of one year: data → ok/edge/below; nd = nothing declared; none = no record; na = municipality didn't exist yet. */
export type St = "ok" | "edge" | "below" | "nd" | "none" | "na";
export type Rank = { pos: number; of: number; less: number };
export type YearPoint = {
  y: number;
  st: St;
  mde: number | null;
  fun: number | null;
  funMin: number;
  aluno: number | null;
  mdeV: number | null;
  mdeVEst: boolean;
  src: "siope" | "siconfi" | null;
  atip: ("mde" | "aluno" | "base")[];
  /** at least one flag is physically implausible (only then "possível erro de declaração") */
  impl: boolean;
  medUf: number | null;
  medBr: number | null;
  rUf: Rank | null;
  rBr: Rank | null;
  /** estimated uncompensated deficit at the end of this year (R$, nominal) */
  carry: number;
  /** same balance in R$ of the IPCA base year (each year's shortfall deflated first) */
  carryReal: number;
};
export type CityYearData = {
  id: number;
  name: string;
  uf: string;
  slug: string;
  ufName: string;
  /** "de São Paulo", "da Bahia" */
  ofUf: string;
  /** "em São Paulo", "na Bahia" */
  inUf: string;
  single: boolean;
  since: number | null;
  /** over/under-application against 25% summed over the whole period (R$) */
  balance: PeriodBalance;
  years: number[];
  initial: number;
  points: YearPoint[];
  /** years after the last declared one with nothing sent */
  stopped: number[];
  firstBase: number | null;
  /** years below 25% whose % or revenue base is out of pattern: the R$ deficit estimate rests on them */
  shaky: number[];
  peers: { name: string; slug: string; v: (number | null)[] }[];
  /** the state's municipalities (same order as citiesOf) and their MDE % in the initial year; -1 = não declarou */
  map: { ids: number[]; initial: (number | null)[] };
};

export const pts = (v: number) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Previous year (before the selected one) with an MDE value. */
export function prevPoint(d: CityYearData, y: number) {
  return [...d.points].reverse().find((p) => p.y < y && p.mde != null);
}

/**
 * Year to compare the selected one with: the previous year with a value, skipping years whose MDE is out of the
 * municipality's own pattern (a jump "from" a probable filing error would be misleading). `skipped` = the
 * out-of-pattern previous year, when one was skipped. No comparison when the selected year itself is out of pattern.
 */
export function comparison(d: CityYearData, p: YearPoint) {
  if (p.mde == null || p.atip.includes("mde")) return null;
  const prev = prevPoint(d, p.y);
  if (!prev) return null;
  if (!prev.atip.includes("mde")) return { base: prev, skipped: null };
  const base = [...d.points].reverse().find((x) => x.y < prev.y && x.mde != null && !x.atip.includes("mde"));
  return base ? { base, skipped: prev } : null;
}

const pontos = (dv: number) => `${pts(dv)} ${Math.abs(dv) < 1.95 ? "ponto" : "pontos"}`;

/** "Subiu 14,5 pontos em relação a 2024 (10,47%)." — hedged when the previous year is out of pattern. */
export function deltaSentence(d: CityYearData, p: YearPoint): string | null {
  const cmp = comparison(d, p);
  if (!cmp) return null;
  const { base, skipped } = cmp;
  const dv = p.mde! - base.mde!;
  if (skipped) {
    const rel = Math.abs(dv) < 0.05 ? "ficou igual" : `ficou ${pontos(dv)} ${dv > 0 ? "acima" : "abaixo"}`;
    return `O valor declarado em ${skipped.y} (${pct(skipped.mde)}) foge do padrão do município; em relação a ${base.y} (${pct(base.mde)}), ${rel}.`;
  }
  if (Math.abs(dv) < 0.05) return `Ficou igual a ${base.y} (${pct(base.mde)}).`;
  return `${dv > 0 ? "Subiu" : "Caiu"} ${pontos(dv)} em relação a ${base.y} (${pct(base.mde)}).`;
}

export const STATUS_KIND: Record<St, StatusKind> = { ok: "ok", edge: "edge", below: "below", nd: "below", none: "nd", na: "nd" };

/**
 * Badges and one-paragraph verdict for the selected year. When the page opens on the last declared year but the
 * municipality stopped declaring afterwards, the non-declaration leads (never a green "Cumpre" first).
 */
export function summary(d: CityYearData, p: YearPoint): { badges: { kind: StatusKind; text: string }[]; verdict: string } {
  const y = p.y;
  const stopped = y === d.initial && d.stopped.length > 0 && p.mde != null;
  const level =
    p.st === "below" ? `abaixo do mínimo de ${MDE_MIN}%` : p.st === "edge" ? "cumpriu, mas no limite" : `acima do mínimo de ${MDE_MIN}%`;
  const extra = [
    p.atip.includes("mde")
      ? p.impl
        ? "O valor é implausível: possível erro de declaração — confirme na fonte."
        : "O valor foge do padrão do próprio município — confirme na fonte."
      : null,
    p.st === "below" && PANDEMIC_YEARS.has(y) ? "Em 2020 e 2021, a EC 119/2022 dispensa a punição se a diferença for compensada até 2023." : null,
  ].filter(Boolean);

  if (p.st === "na")
    return {
      badges: [{ kind: "nd", text: `Não existia em ${y}` }],
      verdict: `${d.name} ainda não existia em ${y}: o município foi instalado em ${d.since}.`,
    };
  if (p.st === "nd")
    return {
      badges: [{ kind: "below", text: `Não declarou ${y}` }],
      verdict: `Não declarou ao governo federal os dados de educação de ${y}, por isso não dá para saber quanto aplicou.${d.since === y ? ` O município foi instalado em ${y}.` : ""}`,
    };
  if (p.st === "none" || p.mde == null)
    return { badges: [{ kind: "nd", text: `Sem dados em ${y}` }], verdict: `Não há dados de ${y} para ${d.name}.` };

  const delta = deltaSentence(d, p);
  if (stopped)
    return {
      badges: [
        { kind: "below", text: `Não declarou ${listYears(d.stopped)}` },
        { kind: "nd", text: `Último dado: ${y}` },
      ],
      verdict: [`Não enviou ao governo federal os dados de ${listYears(d.stopped)}.`, `No último ano informado (${y}), aplicou ${pct(p.mde)} da receita de impostos em educação — ${level}.`, ...extra].join(" "),
    };
  const badge =
    p.st === "below" ? `Abaixo de ${MDE_MIN}% em ${y}` : p.st === "edge" ? `No limite em ${y}` : `Cumpre ${MDE_MIN}% em ${y}`;
  return {
    badges: [{ kind: STATUS_KIND[p.st], text: badge }, ...(p.atip.includes("mde") ? [{ kind: "edge" as const, text: "Fora do padrão" }] : [])],
    verdict: [`Em ${y}, aplicou ${pct(p.mde)} da receita de impostos em educação — ${level}.`, delta, ...extra].filter(Boolean).join(" "),
  };
}
