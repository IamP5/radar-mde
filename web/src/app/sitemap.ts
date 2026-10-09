import type { MetadataRoute } from "next";
import { META, allCities } from "@/lib/data";
import { REGIONS, UFS, cityPath, regionPath, ufPath } from "@/lib/geo";
import { SITE_URL } from "@/lib/site";

/** Every public page: home, regions, states, the 5.570 municipalities and the reference pages (SEO-03). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = META.updated;
  const at = (path: string, priority: number, changeFrequency: "monthly" | "yearly" = "monthly") => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });
  const seen = new Set<string>();
  const once = (e: ReturnType<typeof at>) => (seen.has(e.url) ? [] : (seen.add(e.url), [e]));
  return [
    at("/", 1),
    at("/mapa", 0.8),
    at("/explorar", 0.8),
    at("/dados", 0.6),
    at("/sobre", 0.5, "yearly"),
    ...REGIONS.map((r) => at(regionPath(r.key), 0.7)),
    ...UFS.flatMap((u) => once(at(ufPath(u.uf), 0.7))),
    ...allCities().flatMap((c) => once(at(cityPath(c.uf, c.slug), 0.5))),
  ];
}
