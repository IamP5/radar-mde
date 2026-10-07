import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /data/*.json stays crawlable: JS-rendering crawlers need it to see the maps and tables (FUN-22)
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
