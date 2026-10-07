import { allCities } from "@/lib/data";
import { compressedJson } from "../compressed";

/** Municipality index: [ibge, name, UF, slug, population] (see lib/indice.ts). */
export function GET(req: Request) {
  return compressedJson(req, "indice", () => allCities().map((c) => [c.id, c.name, c.uf, c.slug, c.pop]));
}
