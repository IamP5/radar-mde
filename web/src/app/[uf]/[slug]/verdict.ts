/**
 * Year-dependent wording for the city page, shared by the server (metadata, OG image) and the client islands
 * (header, share text) so every surface says the same thing about the selected year.
 */
import type { StatusKind } from "@/components/kit/status";
import { MDE_MIN, PANDEMIC_YEARS, pct } from "@/lib/format";

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
  medUf: number | null;
  medBr: number | null;
  rUf: Rank | null;
  rBr: Rank | null;
  /** estimated uncompensated deficit at the end of this year (R$, nominal) */
  carry: number;
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
  years: number[];
  initial: number;
  points: YearPoint[];
  /** years after the last declared one with nothing sent */
  stopped: number[];
  firstBase: number | null;
  peers: { name: string; slug: string; v: (number | null)[] }[];
  /** the state's municipalities (same order as citiesOf) and their MDE % in the initial year; -1 = não declarou */
  map: { ids: number[]; initial: (number | null)[] };
};

/** "2019", "2019 e 2021", "2016, 2019 e 2020 a 2025". */
export function listYears(ys: number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < ys.length; ) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    if (j - i >= 2) runs.push(`${ys[i]} a ${ys[j]}`);
    else for (let k = i; k <= j; k++) runs.push(String(ys[k]));
    i = j + 1;
  }
  return runs.length <= 1 ? (runs[0] ?? "") : `${runs.slice(0, -1).join(", ")} e ${runs[runs.length - 1]}`;
}

export const pts = (v: number) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Previous year (before the selected one) with an MDE value. */
export function prevPoint(d: CityYearData, y: number) {
  return [...d.points].reverse().find((p) => p.y < y && p.mde != null);
}

/** "Subiu 14,5 pontos em relação a 2024." */
export function deltaSentence(d: CityYearData, p: YearPoint): string | null {
  const prev = prevPoint(d, p.y);
  if (p.mde == null || !prev) return null;
  const dv = p.mde - prev.mde!;
  if (Math.abs(dv) < 0.05) return `Ficou igual a ${prev.y} (${pct(prev.mde)}).`;
  return `${dv > 0 ? "Subiu" : "Caiu"} ${pts(dv)} ${Math.abs(dv) < 1.95 ? "ponto" : "pontos"} em relação a ${prev.y} (${pct(prev.mde)}).`;
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
    p.atip.includes("mde") ? "O valor é atípico e pode ser erro de declaração." : null,
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
    badges: [{ kind: STATUS_KIND[p.st], text: badge }, ...(p.atip.includes("mde") ? [{ kind: "edge" as const, text: "Valor atípico" }] : [])],
    verdict: [`Em ${y}, aplicou ${pct(p.mde)} da receita de impostos em educação — ${level}.`, delta, ...extra].filter(Boolean).join(" "),
  };
}
