import "server-only";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { DATA_VERSION } from "@/lib/rows";

type Encoded = { raw: Buffer; gzip?: Buffer; br?: Buffer };
const cache = new Map<string, Encoded>();

/**
 * JSON response compressed by the handler itself (prerendered route-handler bodies are served uncompressed by
 * `next start`; PERF-01), memoised per process. `?v=<DATA_VERSION>` URLs are immutable; others revalidate via ETag.
 */
export function compressedJson(req: Request, key: string, build: () => unknown): Response {
  return compressed(req, key, () => JSON.stringify(build()), { "content-type": "application/json; charset=utf-8" });
}

/** Any text body, compressed per Accept-Encoding and memoised under `key` (also used by the CSV downloads). */
export function compressed(req: Request, key: string, build: () => string | null, extra: Record<string, string>): Response {
  let e = cache.get(key);
  if (!e) {
    const text = build();
    if (text == null) return new Response("Not found", { status: 404 });
    cache.set(key, (e = { raw: Buffer.from(text) }));
  }
  const etag = `"${DATA_VERSION}"`;
  const versioned = new URL(req.url).searchParams.get("v") === DATA_VERSION;
  const headers: Record<string, string> = {
    "cache-control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, stale-while-revalidate=86400",
    etag,
    vary: "Accept-Encoding",
    ...extra,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const accept = req.headers.get("accept-encoding") ?? "";
  let body = e.raw;
  if (/\bbr\b/.test(accept)) {
    // big files (CSV) get a faster brotli level
    body = e.br ??= brotliCompressSync(e.raw, { params: { [constants.BROTLI_PARAM_QUALITY]: e.raw.length > 4e6 ? 5 : 9 } });
    headers["content-encoding"] = "br";
  } else if (/\bgzip\b/.test(accept)) {
    body = e.gzip ??= gzipSync(e.raw, { level: 9 });
    headers["content-encoding"] = "gzip";
  }
  headers["content-length"] = String(body.length);
  return new Response(new Uint8Array(body), { headers });
}
