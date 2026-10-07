import { YEARS, allCities, rowOf } from "@/lib/data";
import { packRows, type RowsFile } from "@/lib/rows";
import { compressedJson } from "../compressed";

/** Every municipality as compact rows (see lib/rows.ts), fetched once by maps, explorer and watchlist. */
export function GET(req: Request) {
  return compressedJson(req, "municipios", (): RowsFile => ({ years: YEARS, rows: packRows(allCities().map(rowOf)) }));
}
