import { YEARS, citiesOf, existedIn, getCity } from "@/lib/data";

/**
 * MDE % of every municipality of the city's state in one year, in `citiesOf(uf)` order (the same order as the
 * page's map ids): number, null (no data / not yet installed) or -1 (não declarou). Fetched by the city page
 * only when the reader picks a year other than the default, so the 5.570 static pages don't carry 18 years of
 * state-wide values each.
 */
export async function GET(_req: Request, { params }: RouteContext<"/[uf]/[slug]/ano/[ano]">) {
  const { uf, slug, ano } = await params;
  const year = Number(ano);
  if (uf !== uf.toLowerCase() || !getCity(uf, slug) || !YEARS.includes(year)) return Response.json({ error: "not found" }, { status: 404 });
  const v = citiesOf(uf).map((c) => {
    const r = c.years[year];
    if (!existedIn(c, year)) return null;
    return r?.s === "nd" ? -1 : (r?.mde ?? null);
  });
  return Response.json(
    { year, v },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
