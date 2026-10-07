/** Public origin used for absolute URLs (metadataBase, sitemap, robots). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3210").replace(/\/+$/, "");
export const SITE_NAME = "Radar MDE";
