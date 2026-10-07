import { YEARS, getCity, rowOf } from "@/lib/data";
import { packRows, type RowsFile } from "@/lib/rows";

const ID = /^[a-z]{2}\/[a-z0-9-]{1,80}$/;
const MAX = 200;

/**
 * Rows for just the municipalities on a watchlist (CIT-08): /acompanhar/dados?m=sp/santo-andre&m=ba/salvador.
 * Same packed format as /data/municipios.json, a few hundred bytes instead of the whole country.
 */
export function GET(req: Request) {
  const url = new URL(req.url);
  const ids = [...new Set(url.searchParams.getAll("m"))].filter((m) => ID.test(m)).slice(0, MAX);
  const rows = ids.flatMap((id) => {
    const [uf, slug] = id.split("/");
    const c = getCity(uf, slug);
    return c ? [rowOf(c)] : [];
  });
  const body: RowsFile = { years: YEARS, rows: packRows(rows) };
  return Response.json(body, {
    headers: {
      "cache-control": url.searchParams.has("v") ? "public, max-age=86400, stale-while-revalidate=604800" : "public, max-age=300",
    },
  });
}
