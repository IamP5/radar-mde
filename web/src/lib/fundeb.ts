/**
 * Server-only read of web/src/data/fundeb.json (FNDE VAAT / VAAR). Not part of cities.json.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CsvRecord } from "./csv";
import { allCities } from "./data";
import { FUNDEB_CSV_COLUMNS, type FundebCell, type FundebCityView, type FundebMapPayload, type FundebPublication } from "./fundeb-types";

type FundebFile = {
  years: number[];
  floor: Record<string, number>;
  publications: Record<string, FundebPublication>;
  cities: Record<string, Record<string, FundebCell>>;
};

let cached: FundebFile | null = null;

export function fundebFile(): FundebFile {
  return (cached ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "data", "fundeb.json"), "utf8")));
}

export function fundebCityView(id: number): FundebCityView {
  const doc = fundebFile();
  return { years: doc.years, floor: doc.floor, publications: doc.publications, rows: doc.cities[String(id)] ?? {} };
}

export function fundebMap(places: { id: number; name: string; uf: string; slug: string }[]): FundebMapPayload {
  const doc = fundebFile();
  const scope = new Set(places.map((p) => p.id));
  const byYear: FundebMapPayload["byYear"] = {};
  const mark: Record<string, string> = {};
  for (const year of doc.years) {
    const key = String(year);
    let nReceive = 0;
    let nKnown = 0;
    let total = 0;
    for (const id of scope) {
      const cell = doc.cities[String(id)]?.[key];
      if (!cell) continue;
      nKnown += 1;
      if (cell.comp > 0) {
        nReceive += 1;
        total += cell.comp;
      }
    }
    const bits = places.map((p) => {
      const cell = doc.cities[String(p.id)]?.[key];
      if (!cell) return "0";
      return cell.comp > 0 ? "2" : "1";
    });
    const pub = doc.publications[key];
    byYear[key] = {
      floor: doc.floor[key],
      nReceive,
      nKnown,
      total,
      portaria: pub.portaria,
      page: pub.page,
      label: pub.label,
    };
    mark[key] = bits.join("");
  }
  return {
    years: doc.years,
    byYear,
    id: places.map((p) => p.id),
    name: places.map((p) => p.name),
    uf: places.map((p) => p.uf),
    slug: places.map((p) => p.slug),
    mark,
  };
}

export function fundebCsvRecords(): CsvRecord[] {
  const doc = fundebFile();
  const names = new Map(allCities().map((c) => [c.id, c]));
  const records: CsvRecord[] = [];
  for (const [code, years] of Object.entries(doc.cities)) {
    const id = Number(code);
    const who = names.get(id);
    for (const year of doc.years) {
      const cell = years[String(year)];
      if (!cell) continue;
      const pub = doc.publications[String(year)];
      records.push({
        ibge: id,
        municipio: who?.name ?? "",
        uf: who?.uf ?? "",
        ano: year,
        vaat_rs: cell.vaat,
        vaat_com_complementacao_rs: cell.vaatCom,
        complementacao_vaat_rs: cell.comp,
        vaat_min_rs: doc.floor[String(year)],
        iei_pct: cell.iei,
        vaar: cell.vaar,
        publicacao: pub.label,
        portaria: pub.portaria,
      });
    }
  }
  records.sort((a, b) => Number(a.ano) - Number(b.ano) || String(a.uf).localeCompare(String(b.uf)) || String(a.municipio).localeCompare(String(b.municipio), "pt-BR"));
  return records;
}

export { FUNDEB_CSV_COLUMNS };
