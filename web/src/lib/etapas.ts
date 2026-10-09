import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  STAGE_FIELDS, type MedianMap, type StageId, type StageYearMap,
} from "./etapas-fields";

export type { MedianMap, MedianYear, StageCell, StageId, StageYearMap } from "./etapas-fields";
export { medianN, shareStack, stageMoney, stageText } from "./etapas-fields";

type EtapasFile = {
  fields: { id: string; siope: string; kind: string; years: number[] }[];
  cities: Record<string, StageYearMap>;
  gov: Record<string, StageYearMap>;
  medians: { br: MedianMap; uf: Record<string, MedianMap>; reg: Record<string, MedianMap> };
};

let cached: EtapasFile | null = null;

function file(): EtapasFile {
  if (cached) return cached;
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "data", "etapas.json"), "utf8"));
  if (!raw || typeof raw !== "object") throw new Error("etapas.json");
  const o = raw as EtapasFile;
  if (!Array.isArray(o.fields) || !o.cities || !o.gov || !o.medians?.br || !o.medians.uf || !o.medians.reg) {
    throw new Error("etapas.json");
  }
  const got = o.fields.map((f) => `${f.id}:${f.siope}:${f.kind}`).join(",");
  const expect = STAGE_FIELDS.map((f) => `${f.id}:${f.siope}:${f.kind}`).join(",");
  if (got !== expect) throw new Error("etapas.json fields diverged from etapas-fields.ts");
  cached = o;
  return o;
}

/** Year map for one municipality. Brasília is stored on the city id (the DF declaration). */
export function cityStages(id: number): StageYearMap {
  return file().cities[String(id)] ?? {};
}

export function govStages(uf: string): StageYearMap {
  return file().gov[uf.toUpperCase()] ?? {};
}

export function stageMedians(scope: { level: "br" } | { level: "uf"; uf: string } | { level: "reg"; reg: string }): MedianMap {
  const m = file().medians;
  if (scope.level === "br") return m.br;
  if (scope.level === "uf") return m.uf[scope.uf.toUpperCase()] ?? {};
  return m.reg[scope.reg] ?? {};
}

export function stageFieldYears(id: StageId): number[] {
  return file().fields.find((f) => f.id === id)?.years ?? [];
}

export type ExplorerStages = {
  years: number[];
  rows: Record<string, { cre: (number | null)[]; ef: (number | null)[]; eja: (number | null)[] }>;
};

/** Creche, fundamental and EJA aligned to one year list, for the explorer table. */
export function explorerStages(): ExplorerStages {
  const f = file();
  const want = new Set(["cre", "ef", "eja"]);
  const yearSet = new Set<number>();
  for (const field of f.fields) if (want.has(field.id)) for (const y of field.years) yearSet.add(y);
  const years = [...yearSet].sort((a, b) => a - b);
  const rows: ExplorerStages["rows"] = {};
  for (const [id, byYear] of Object.entries(f.cities)) {
    const cre = years.map((y) => byYear[String(y)]?.cre ?? null);
    const ef = years.map((y) => byYear[String(y)]?.ef ?? null);
    const eja = years.map((y) => byYear[String(y)]?.eja ?? null);
    if (cre.some((v) => v != null) || ef.some((v) => v != null) || eja.some((v) => v != null)) rows[id] = { cre, ef, eja };
  }
  return { years, rows };
}
