/**
 * One CSV schema for every export (/dados/csv/* and the Explorer), see qa/fixes/CONTRACT.md §6.
 * Client-safe: no server imports (City is a type-only import).
 */
import type { City, StateGov } from "./data";
import { MDE_MIN, PANDEMIC_YEARS, fundebLeftMax } from "./format";
import { getRegion, getUf } from "./geo";
import { atipOf, deltaPp, type CityYear, type Row } from "./rows";

export type CsvValue = string | number | null | undefined;
export type CsvRecord = Record<string, CsvValue>;

/** Every column, in order, with its dictionary entry (shown on /dados). */
export const CSV_COLUMNS: { key: string; label: string }[] = [
  { key: "ibge", label: "Código IBGE (7 dígitos no município; 2 dígitos no arquivo de estados)" },
  { key: "municipio", label: "Nome do município (no arquivo de estados: nome do estado)" },
  { key: "uf", label: "Sigla da UF" },
  { key: "regiao", label: "Região do país" },
  { key: "regiao_intermediaria", label: "Região geográfica intermediária (IBGE)" },
  { key: "regiao_imediata", label: "Região geográfica imediata (IBGE)" },
  { key: "capital", label: "1 = capital do estado (ou Brasília); 0 = não" },
  { key: "populacao", label: "População: uma única estimativa (ver ano em /sobre), repetida em todos os anos" },
  { key: "ano", label: "Exercício (ano do orçamento)" },
  { key: "envio", label: "declarou | nao_declarou: se o ente enviou a declaração ao SIOPE no ano" },
  { key: "situacao_mde", label: "cumpriu (26% ou mais) | limite (25% a 26%) | abaixo (menos de 25%) | nao_declarou | sem_dado" },
  { key: "mde_pct", label: "% da receita de impostos aplicado em MDE, declarado ao SIOPE (indicador 1.1)" },
  { key: "delta_mde_pp", label: "Diferença do % em MDE em relação ao ano anterior, em pontos percentuais (vazio sem os dois anos)" },
  { key: "mde_aplicado_rs", label: "R$ aplicados em MDE, valores nominais. Declarado (indicador 8.2) desde 2020; estimado (receita × %) quando aplicado_estimado = 1" },
  { key: "aplicado_estimado", label: "1 = mde_aplicado_rs foi estimado pelo Radar (receita × %), não declarado; 0 = declarado" },
  { key: "receita_impostos_rs", label: "Receita de impostos e transferências que serve de base para os 25%, R$ nominais" },
  { key: "base_origem", label: "Como a receita foi obtida: siope_8.1 (mínimo de 25% ÷ 0,25) | siope_8.2 (aplicado ÷ %) | receitas_siope (soma das receitas declaradas) | siconfi" },
  { key: "faltou_rs", label: "R$ nominais que faltaram para chegar a 25% (0 = cumpriu; vazio = não estimável: sem declaração ou sem receita)" },
  { key: "fundeb_pessoal_pct", label: "% do Fundeb pago aos profissionais da educação (indicador 1.2)" },
  { key: "fundeb_minimo_pct", label: "Mínimo legal do Fundeb para profissionais: 60% até 2020, 70% desde 2021" },
  { key: "fundeb_nao_usado_pct", label: "% do Fundeb deixado para o ano seguinte (indicador 1.4)" },
  { key: "fundeb_nao_usado_max_pct", label: "Máximo permitido de Fundeb não usado: 5% até 2020, 10% desde 2021" },
  { key: "por_aluno_rs", label: "R$ nominais por aluno (indicador 4.9; o número de alunos é o declarado pelo ente ao SIOPE)" },
  { key: "educacao_pct_despesa_total", label: "% da despesa total do ente que foi para a educação (indicador 2.8)" },
  { key: "saude_pct", label: "% aplicado em saúde (SICONFI; só alguns municípios de SP)" },
  { key: "mde_pct_siconfi", label: "% em MDE segundo o Tesouro (SICONFI), quando difere do SIOPE em 1 p.p. ou mais (só SP)" },
  { key: "pandemia_ec119", label: "1 = 2020 ou 2021: a EC 119/2022 dispensa punição se a diferença for compensada até 2023" },
  { key: "atipico", label: "Valores atípicos, possível erro de declaração: mde (% fora de 18–45) | aluno (por aluno fora do padrão do ente) | base (receita destoa dos anos vizinhos), separados por |" },
  { key: "fonte", label: "siope | siconfi: sistema de onde veio o %" },
];

const YEAR_KEYS = CSV_COLUMNS.slice(CSV_COLUMNS.findIndex((c) => c.key === "ano")).map((c) => c.key);
/** Columns of the municipality files (/dados/csv/brasil, /<uf>, /regiao-<slug>). */
export const CITY_CSV_COLUMNS = CSV_COLUMNS.map((c) => c.key);
/** Columns of /dados/csv/estados (state governments). */
export const STATE_CSV_COLUMNS = ["ibge", "municipio", "uf", "regiao", ...YEAR_KEYS];
/** Columns available from client rows (Explorer export): same names and vocabulary, a subset of CITY_CSV_COLUMNS. */
export const ROW_CSV_COLUMNS = [
  "ibge", "municipio", "uf", "regiao", "regiao_intermediaria", "capital", "populacao", "ano", "envio", "situacao_mde",
  "mde_pct", "delta_mde_pp", "faltou_rs", "fundeb_pessoal_pct", "fundeb_minimo_pct", "por_aluno_rs", "pandemia_ec119", "atipico",
];

const BASE_ORIGEM = { "8.2": "siope_8.2", receita: "receitas_siope", siconfi: "siconfi" } as const;

function situacao(r: { s?: string; mde?: number | null } | undefined) {
  if (r?.s === "nd") return "nao_declarou";
  if (r?.mde == null) return "sem_dado";
  return r.mde < MDE_MIN ? "abaixo" : r.mde < MDE_MIN + 1 ? "limite" : "cumpriu";
}
const envio = (r: { s?: string } | undefined) => (r?.s === "nd" ? "nao_declarou" : r ? "declarou" : "");
const funMinOf = (y: number) => (y >= 2021 ? 70 : 60);

/** R$ short of 25%: 0 when met, empty when unknown (nothing declared, or below 25% without a tax base). */
function faltou(mde: number | null | undefined, base: number | null | undefined): CsvValue {
  if (mde == null) return null;
  if (mde >= MDE_MIN) return 0;
  return base == null ? null : Math.round(((MDE_MIN - mde) / 100) * base);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Year-level columns of one record. `prev` is the previous year's record (for delta_mde_pp). */
function yearCols(y: number, r: CityYear | undefined, prev: CityYear | undefined): CsvRecord {
  return {
    ano: y,
    envio: envio(r),
    situacao_mde: situacao(r),
    mde_pct: r?.mde,
    delta_mde_pp: r?.mde != null && prev?.mde != null ? round2(r.mde - prev.mde) : null,
    mde_aplicado_rs: r?.mdeV,
    aplicado_estimado: r?.mdeV != null ? (r.mdeVEst ? 1 : 0) : null,
    receita_impostos_rs: r?.base,
    base_origem: r?.base != null ? (r.baseSrc ? BASE_ORIGEM[r.baseSrc] : "siope_8.1") : null,
    faltou_rs: faltou(r?.mde, r?.base),
    fundeb_pessoal_pct: r?.fun,
    fundeb_minimo_pct: r?.fun != null ? (r.funMin ?? funMinOf(y)) : null,
    fundeb_nao_usado_pct: r?.funLeft,
    fundeb_nao_usado_max_pct: r?.funLeft != null ? fundebLeftMax(y) : null,
    por_aluno_rs: r?.perAluno,
    educacao_pct_despesa_total: r?.eduShare,
    saude_pct: r?.sau,
    mde_pct_siconfi: r?.alt,
    pandemia_ec119: PANDEMIC_YEARS.has(y) ? 1 : 0,
    atipico: r?.atip?.join("|") ?? null,
    fonte: r?.src,
  };
}

const regionName = (uf: string) => getRegion(getUf(uf)!.region).name;

/** Full records of one municipality, one per year with data (years before installation are absent). */
export function cityCsvRecords(c: City, years: number[]): CsvRecord[] {
  const id: CsvRecord = {
    ibge: c.id, municipio: c.name, uf: c.uf, regiao: regionName(c.uf), regiao_intermediaria: c.inter,
    regiao_imediata: c.imediata, capital: c.capital ? 1 : 0, populacao: c.pop,
  };
  return years.flatMap((y) => {
    const r = c.years[y];
    return r ? [{ ...id, ...yearCols(y, r, c.years[y - 1]) }] : [];
  });
}

/** Records of one state government (SIOPE "Estadual" declarations). */
export function stateCsvRecords(s: StateGov, years: number[]): CsvRecord[] {
  const id: CsvRecord = { ibge: s.code, municipio: s.name, uf: s.uf, regiao: regionName(s.uf) };
  return years.flatMap((y) => {
    const r = s.years[y];
    return r ? [{ ...id, ...yearCols(y, r, s.years[y - 1]) }] : [];
  });
}

/** Explorer record for one client row and year index (columns: ROW_CSV_COLUMNS). Empty years before installation. */
export function rowCsvRecord(r: Row, yi: number, years: number[]): CsvRecord {
  const y = years[yi];
  const mde = r.mde[yi];
  const nd = r.nd[yi];
  const rec = nd ? { s: "nd" } : mde != null ? { s: "ok", mde } : undefined;
  return {
    ibge: r.id, municipio: r.name, uf: r.uf, regiao: regionName(r.uf), regiao_intermediaria: r.inter,
    capital: r.capital ? 1 : 0, populacao: r.pop, ano: y,
    envio: envio(rec), situacao_mde: situacao(rec), mde_pct: mde, delta_mde_pp: deltaPp(r, yi),
    faltou_rs: mde == null ? null : r.short[yi],
    fundeb_pessoal_pct: r.fun[yi], fundeb_minimo_pct: r.fun[yi] != null ? funMinOf(y) : null,
    por_aluno_rs: r.aluno[yi], pandemia_ec119: PANDEMIC_YEARS.has(y) ? 1 : 0,
    atipico: atipOf(r, yi).join("|") || null,
  };
}

/**
 * Serialise records. UTF-8 BOM always (Excel detects the encoding). `excel: true` = "Excel Brasil":
 * `;` separator and decimal comma, which pt-BR Excel opens directly in columns.
 */
export function toCsv(columns: string[], records: CsvRecord[], opts: { excel?: boolean } = {}): string {
  const sep = opts.excel ? ";" : ",";
  const needsQuote = opts.excel ? /[";\n\r]/ : /[",\n\r]/;
  const cell = (v: CsvValue) => {
    if (v == null || v === "") return "";
    const s = typeof v === "number" ? (opts.excel ? String(v).replace(".", ",") : String(v)) : v;
    return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(sep), ...records.map((r) => columns.map((k) => cell(r[k])).join(sep))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** "radar-mde_SP_2021_abaixo25.csv" from the active filters (falsy parts are skipped). */
export function csvFilename(parts: (string | number | null | undefined | false)[], excel?: boolean) {
  const clean = parts
    .filter((p): p is string | number => p != null && p !== false && p !== "")
    .map((p) => String(p).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
  return `${["radar-mde", ...clean, ...(excel ? ["excel"] : [])].join("_")}.csv`;
}

/** Link to a prebuilt file: id = "brasil" | "<uf>" | "regiao-<slug>" | "estados". */
export const csvHref = (id: string, excel?: boolean) => `/dados/csv/${id.toLowerCase()}${excel ? "-excel" : ""}`;

/** Client: save a CSV string as a file. */
export function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
