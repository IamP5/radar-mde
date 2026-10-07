/**
 * Public origin for every absolute URL (metadataBase, sitemap, robots, citations, share text).
 * Resolution order (TRIAGE2 decision):
 *   1. NEXT_PUBLIC_SITE_URL                 — set this for the real domain
 *   2. https://VERCEL_PROJECT_PRODUCTION_URL — Vercel production domain (also NEXT_PUBLIC_-prefixed for client code)
 *   3. https://VERCEL_URL                    — Vercel preview/deployment URL
 *   4. http://localhost:<PORT|3000>          — local development
 */
const env = process.env;

function resolve(): { url: string; fallback: boolean } {
  const explicit = env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return { url: explicit, fallback: false };
  const prod = env.VERCEL_PROJECT_PRODUCTION_URL || env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return { url: `https://${prod}`, fallback: false };
  const deploy = env.VERCEL_URL || env.NEXT_PUBLIC_VERCEL_URL;
  if (deploy) return { url: `https://${deploy}`, fallback: false };
  return { url: `http://localhost:${env.PORT || 3000}`, fallback: true };
}

const resolved = resolve();

export const SITE_URL = resolved.url.replace(/\/+$/, "");
export const SITE_NAME = "Radar MDE";
/** Host without protocol, for human-readable citations ("radar-mde.org/dados"). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

if (resolved.fallback && env.NODE_ENV === "production" && typeof window === "undefined") {
  console.warn(
    `[radar-mde] NEXT_PUBLIC_SITE_URL is not set: absolute URLs (sitemap, Open Graph, citations) will use ${SITE_URL}. ` +
      "Set NEXT_PUBLIC_SITE_URL to the public origin before deploying.",
  );
}
