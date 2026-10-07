import { allCities } from "@/lib/data";

/** Municipality index: [ibge, name, UF, slug, population] (see lib/indice.ts). */
export function GET() {
  return Response.json(
    allCities().map((c) => [c.id, c.name, c.uf, c.slug, c.pop]),
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
