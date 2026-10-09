/**
 * Pair of scripts/build_data.py INDICATORS (id, siope, kind). Keep the two lists the same.
 * Client-safe: no server-only import and no etapas.json.
 */
import { pct, brl } from "./format";
import { toReal } from "./rows";

export const STAGE_FIELDS = [
  { id: "cre", siope: "4.14", kind: "money", csv: "por_aluno_creche_rs", label: "Creche", dict: "Investimento educacional por aluno da educação infantil - creche (indicador 4.14 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "pre", siope: "4.15", kind: "money", csv: "por_aluno_pre_rs", label: "Pré-escola", dict: "Investimento educacional por aluno da educação infantil - pré-escola (indicador 4.15 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "ei", siope: "4.1", kind: "money", csv: "por_aluno_ei_rs", label: "Educação infantil", dict: "Investimento educacional por aluno da educação infantil (indicador 4.1 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "ef", siope: "4.2", kind: "money", csv: "por_aluno_ef_rs", label: "Fundamental", dict: "Investimento educacional por aluno do ensino fundamental (indicador 4.2 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "eja", siope: "4.5", kind: "money", csv: "por_aluno_eja_rs", label: "EJA", dict: "Investimento educacional por aluno da educação de jovens e adultos (indicador 4.5 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "ee", siope: "4.6", kind: "money", csv: "por_aluno_ee_rs", label: "Educação especial", dict: "Investimento educacional por aluno da educação especial (indicador 4.6 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "shEi", siope: "2.4", kind: "percent", csv: "educacao_infantil_pct", label: "Educação infantil", dict: "Percentual das despesas com educação infantil em relação à despesa total com educação (indicador 2.4 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "shEf", siope: "2.5", kind: "percent", csv: "ensino_fundamental_pct", label: "Ensino fundamental", dict: "Percentual das despesas com ensino fundamental em relação à despesa total com educação (indicador 2.5 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "fuEi", siope: "2.1", kind: "percent", csv: "fundeb_infantil_pct", label: "Fundeb na educação infantil", dict: "Percentual dos recursos do FUNDEB aplicados na educação infantil (indicador 2.1 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "fuEf", siope: "2.2", kind: "percent", csv: "fundeb_fundamental_pct", label: "Fundeb no fundamental", dict: "Percentual dos recursos do FUNDEB aplicados no ensino fundamental (indicador 2.2 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "mer", siope: "2.9", kind: "percent", csv: "alimentacao_escolar_pct", label: "Merenda", dict: "Percentual das despesas com alimentação escolar em relação à despesa total com educação (indicador 2.9 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "mat", siope: "2.10", kind: "money", csv: "por_aluno_mat_rs", label: "Material didático", dict: "Investimento com material didático por aluno da educação básica (indicador 2.10 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
  { id: "prof", siope: "4.10", kind: "money", csv: "por_aluno_prof_rs", label: "Professores", dict: "Despesa com professores por aluno da educação básica (indicador 4.10 do SIOPE). O 0 é tratado como ausente, então a célula fica vazia." },
] as const;

export type StageField = (typeof STAGE_FIELDS)[number];
export type StageId = StageField["id"];
export type StageKind = StageField["kind"];

export const STAGE_MONEY = STAGE_FIELDS.filter((f): f is Extract<StageField, { kind: "money" }> => f.kind === "money");
export const STAGE_PERCENT = STAGE_FIELDS.filter((f): f is Extract<StageField, { kind: "percent" }> => f.kind === "percent");

export const STAGE_BY_ID = Object.fromEntries(STAGE_FIELDS.map((f) => [f.id, f])) as { [K in StageId]: Extract<StageField, { id: K }> };

/** Per-student stage series on the city page (not the spending shares). */
export const STAGE_PER_STUDENT = ["cre", "pre", "ei", "ef", "eja", "ee"] as const satisfies readonly StageId[];
/** Chart series. More than three, so the chart also dashes them. */
export const STAGE_CHART = ["cre", "pre", "ef", "eja", "ee"] as const satisfies readonly StageId[];
/** Compact figures under the per-student stats. */
export const STAGE_QUIET = ["fuEi", "fuEf", "mer", "mat", "prof"] as const satisfies readonly StageId[];
/** Dashboard medians: four per-student stages and the two spending shares. */
export const STAGE_DASHBOARD = ["cre", "pre", "ef", "eja", "shEi", "shEf"] as const satisfies readonly StageId[];

export type StageCell = Partial<Record<StageId, number>> & { atip?: StageId[]; impl?: StageId[] };
export type StageYearMap = Record<string, StageCell>;

export type MedianYear = Partial<Record<StageId, number>> & Partial<Record<`${StageId}N`, number>>;
export type MedianMap = Record<string, MedianYear>;

export const stageRealKey = (csv: string) => csv.replace(/_rs$/, "_rs_real");

export function medianN(cell: MedianYear | undefined, id: StageId): number {
  return cell?.[`${id}N`] ?? 0;
}

/** Nominal reais, or IPCA-corrected when `real`. Null stays null. Zero is not rewritten. */
export function stageMoney(v: number | null, year: number, real: boolean): number | null {
  if (v == null) return null;
  return real ? toReal(v, year) : v;
}

/**
 * EI and EF shares of education spending. Null when either share is absent or the two sum past 100.
 * `other` is the residual and may be 0. That 0 is computed here, not stored.
 */
export function shareStack(shEi: number | null, shEf: number | null): { ei: number; ef: number; other: number } | null {
  if (shEi == null || shEf == null) return null;
  const other = Math.round((100 - shEi - shEf) * 100) / 100;
  if (other < 0) return null;
  return { ei: shEi, ef: shEf, other };
}

export function stageText(id: StageId, v: number | null, year: number, real: boolean): string {
  if (v == null) return "sem dado";
  if (STAGE_BY_ID[id].kind === "percent") return pct(v);
  const n = stageMoney(v, year, real);
  return n == null ? "sem dado" : brl(n);
}
