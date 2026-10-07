import { YEARS, allCities, rowOf } from "@/lib/data";
import { packRows, type RowsFile } from "@/lib/rows";

/** Every municipality as compact rows (see lib/rows.ts), fetched once by maps, explorer and watchlist. */
export function GET() {
  const body: RowsFile = { years: YEARS, rows: packRows(allCities().map(rowOf)) };
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
