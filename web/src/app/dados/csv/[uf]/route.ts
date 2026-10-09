import { YEARS, allCities, citiesIn, citiesOf, stateGov } from "@/lib/data";
import { CITY_CSV_COLUMNS, STATE_CSV_COLUMNS, cityCsvRecords, stateCsvRecords, toCsv } from "@/lib/csv";
import { FUNDEB_CSV_COLUMNS, fundebCsvRecords } from "@/lib/fundeb";
import { REGIONS, UFS, getRegionBySlug, getUf } from "@/lib/geo";
import { compressed } from "@/app/data/compressed";

const IDS = ["brasil", "estados", "fundeb", ...REGIONS.map((r) => `regiao-${r.slug}`), ...UFS.map((u) => u.uf.toLowerCase())];

/**
 * One line per municipality and year: /dados/csv/brasil, /<uf>, /regiao-<slug>; state governments: /estados.
 * Append "-excel" for the Excel-Brasil variant (";" separator, decimal comma). Schema: lib/csv.ts.
 * Rendered on request and compressed (gzip/br), memoised per process: the Brasil file is ~17 MB raw (PERF-11).
 */
export async function GET(req: Request, { params }: RouteContext<"/dados/csv/[uf]">) {
  const raw = (await params).uf.toLowerCase(); // /dados/csv/SP works too (FUN-23)
  if (!IDS.includes(raw.replace(/-excel$/, ""))) return new Response("Not found", { status: 404 });
  return compressed(req, `csv:${raw}`, () => build(raw), {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="radar-mde-${raw}.csv"`,
  });
}

function build(raw: string): string | null {
  const excel = raw.endsWith("-excel");
  const id = excel ? raw.slice(0, -"-excel".length) : raw;
  let text: string | null = null;
  if (id === "fundeb") {
    text = toCsv(FUNDEB_CSV_COLUMNS.map((c) => c.key), fundebCsvRecords(), { excel });
  } else if (id === "estados") {
    const recs = UFS.flatMap((u) => {
      const g = stateGov(u.uf);
      return g ? stateCsvRecords(g, YEARS) : [];
    });
    text = toCsv(STATE_CSV_COLUMNS, recs, { excel });
  } else {
    const region = id.startsWith("regiao-") ? getRegionBySlug(id.slice("regiao-".length)) : undefined;
    const cities =
      id === "brasil" ? allCities() : region ? citiesIn({ level: "region", region: region.key }) : getUf(id) ? citiesOf(id) : null;
    if (cities) text = toCsv(CITY_CSV_COLUMNS, cities.flatMap((c) => cityCsvRecords(c, YEARS)), { excel });
  }
  return text;
}
