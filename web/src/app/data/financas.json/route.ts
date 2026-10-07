import { YEARS, allCities } from "@/lib/data";
import { compressedJson } from "../compressed";

/**
 * Finance columns per municipality for CSV exports (see lib/rows.ts loadFinance):
 * [ibge, base[], mdeV[], estimated-bitmask, funLeft[]], one slot per published year.
 */
export function GET(req: Request) {
  return compressedJson(req, "financas", () => ({
    years: YEARS,
    rows: allCities().map((c) => [
      c.id,
      YEARS.map((y) => c.years[y]?.base ?? null),
      YEARS.map((y) => c.years[y]?.mdeV ?? null),
      YEARS.reduce((m, y, i) => (c.years[y]?.mdeVEst ? m | (1 << i) : m), 0),
      YEARS.map((y) => c.years[y]?.funLeft ?? null),
    ]),
  }));
}
