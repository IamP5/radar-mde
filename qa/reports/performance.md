# Radar MDE · Brasil: performance, robustness and SEO QA (Phase 1, report only)

- Date: 2026-10-07. Tester: qa-performance. No app files were changed. The isolated build rewrote `web/tsconfig.json` and `web/next-env.d.ts`; both were restored afterwards (see BUILD-02).
- Build: `NEXT_DIST_DIR=.next-perf next build`, served with `next start -p 3299`. Both were removed when testing finished.
- Lab profile: Playwright Chromium 1243, 412×823 @2.625x, mobile UA + touch. CDP adds **4x CPU** and DevTools **Slow 4G** (562.5 ms RTT, 1.47 Mbps down, 0.67 Mbps up). Every route gets a fresh context, so the cache is cold.
- Caveat: the server is on localhost, so TTFB is about 0. Real TTFB on a CDN adds roughly 100–600 ms to FCP/LCP.
- Re-runnable scripts are in `qa/reports/performance/`:
  - `measure.mjs [routes|interact|robust|seo|all]` writes `results-*.json` and screenshots (`shot_*.png`, `fail_*.png`).
  - `explorer-typing.mjs` measures typing and sort latency in the explorer.
  - `lh_*.json` holds Lighthouse 12 output (mobile defaults).
  - `build.log` holds the build output.

## Build

| Item | Value |
|---|---|
| Wall time | **54.5 s** (Turbopack compile 2.6 s, TS 2.1 s, 5,669 static pages generated in 49 s on 11 workers) |
| Pages | 5,669 prerendered: 5,570 cities, 27 UF, 5 regions, 28 CSV, 2 JSON, misc. |
| Output size | **2.9 GB** `.next-perf` total: `server/` 2.8 GB, `static/` 1.8 MB, `cache/` 73 MB |
| HTML | 5,609 files, 1.27 GB. City median **224 KB** raw / ~30 KB gzip, p95 255 KB. Largest is `/mg` at **734 KB** raw (165 KB gzip) |
| RSC | 28,164 `.rsc` files, 1.6 GB (of which 1.07 GB are `*.segments/*.rsc`, PPR segment prefetch files) |
| Warnings | No compile warnings. Build edits `tsconfig.json` and `next-env.d.ts` when `NEXT_DIST_DIR` is set (BUILD-02) |
| Data leak | **None.** `cities.json` (15 MB) is not in any client chunk or HTML. Fields such as `perAluno`/`funLeft` are absent from `static/chunks` and from city/UF/home HTML. The city RSC carries only `[id, mde, nd]` triples for its own state |

First-load JS per route, measured from `<script>` tags in prerendered HTML (gzip -9):

| Route | Chunks | gzip | raw |
|---|---|---|---|
| /sobre, /dados, /acompanhar | 14 | 261–266 KB | 812–826 KB |
| /explorar | 15 | 288 KB | 888 KB |
| / | 15 | 400 KB | 1,268 KB |
| /regiao/[slug], /[uf]/[slug] | 17 | 420 KB | 1.32 MB |
| /[uf] | 17 | **430 KB** | 1.35 MB |

Largest chunks:
- Recharts chunk `3bkffde-ugd9q.js`: 420 KB raw / 125 KB gzip
- react-dom: 72 KB gzip
- Next router: 46 KB gzip
- base-ui + cmdk dialog (SearchPalette in the root layout): ~60 KB raw

## Per-route metrics (prod, 4x CPU + Slow 4G, cold)

LCP and CLS come from PerformanceObserver. TBT is the sum of (longtask − 50 ms) up to network idle + 1.5 s. Transfer counts every request, including viewport prefetches.

| Route | FCP | LCP | CLS | TBT | Longest task | Req | Transfer | HTML gz / raw | Script | Fetch (data+RSC prefetch) | JS heap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 1.62 s | 1.62 s | 0 | 130 ms | 113 ms | 39 | **3,134 KB** | 46 / 395 KB | 440 KB | **2,576 KB** | 29 MB |
| /regiao/sudeste | 1.60 s | 1.60 s | 0 | 255 ms | 247 ms | 47 | **3,169 KB** | 23 / 148 KB | 445 KB | **2,629 KB** | 18 MB |
| /sp | 1.66 s | 1.66 s | 0 | 205 ms | 155 ms | 40 | 751 KB | **130 / 603 KB** | 445 KB | 105 KB | 16 MB |
| /mg | 1.68 s | 1.68 s | 0 | 231 ms | 156 ms | 40 | 807 KB | **161 / 717 KB** | 445 KB | 128 KB | 28 MB |
| /rr | 1.59 s | 1.59 s | 0 | 147 ms | 154 ms | 40 | 602 KB | 21 / 131 KB | 445 KB | 64 KB | 27 MB |
| /sp/sao-paulo | 1.60 s | 1.60 s | 0 | 185 ms | 178 ms | 45 | 1,065 KB | 33 / 260 KB | 466 KB | 494 KB | 16 MB |
| /sp/santo-andre | 1.61 s | 1.61 s | 0 | 179 ms | 168 ms | 45 | 1,068 KB | 37 / 289 KB | 466 KB | 494 KB | 16 MB |
| /rr/boa-vista | 1.60 s | 1.60 s | 0 | 138 ms | 163 ms | 45 | 911 KB | 26 / 201 KB | 466 KB | 347 KB | 23 MB |
| /explorar | 1.59 s | 1.59 s* | 0 | 125 ms | 169 ms | 34 | **2,805 KB** | 10 / 77 KB | 405 KB | **2,318 KB** | 16 MB (52 MB after use) |
| /acompanhar | 1.57 s | 1.57 s | 0 | 9 ms | 59 ms | 34 | **2,802 KB** | 7 / 32 KB | 405 KB | **2,318 KB** | 9 MB |
| /dados | 1.59 s | 1.59 s | 0 | 9 ms | 59 ms | 33 | 535 KB | 18 / 191 KB | 405 KB | 40 KB | 5 MB |
| /sobre | 1.57 s | 1.57 s | 0 | 1 ms | 51 ms | 33 | 532 KB | 14 / 60 KB | 405 KB | 41 KB | 5 MB |

\* The LCP element is header text on every route, so LCP looks good. The useful content (map, table) arrives much later; see PERF-01.

Lighthouse 12 (mobile, simulated throttling):

| Route | Perf | LCP | TBT | Total bytes | Best practices | SEO |
|---|---|---|---|---|---|---|
| / | **70** | **18.2 s** | 100 ms | 3,140 KiB | 96 | 100 |
| /sp/santo-andre | 88 | 3.9 s | 80 ms | 1,075 KiB | 96 | 100 |
| /explorar | **71** | **14.7 s** | 230 ms | 2,812 KiB | 96 | 100 |

Lighthouse SEO = 100 because it does not check OG tags, sitemap or soft 404s; see SEO-*.

Interaction metrics (4x CPU):

| Scenario | Result |
|---|---|
| Home: "Estados → Municípios" (5,570 paths) | **492 ms** long task, event duration 552 ms, 658 ms until painted |
| Home (municipal map): one year step | longest 161 ms, event 192 ms |
| Home (municipal map): 18 rapid year clicks | 18 long tasks, **TBT 2,043 ms**, longest 186 ms, max event **248 ms** (INP "needs improvement") |
| /mg: 10 rapid year clicks | TBT 746 ms, longest 158 ms |
| Home heap/DOM before → after map use | 20.6 → **50.4 MB**, 3.5k → 11.6k nodes |
| Explorer: data ready on Slow 4G | **17.4 s** after navigation start |
| Explorer: 5 × "Mostrar mais" (100 → 1,100 rows) | TBT **3,835 ms**, longest task **1,206 ms**, 50,049 DOM nodes, heap 52 MB. Not virtualized |
| Explorer: typing "santo" | ~157 ms long task per keystroke, max event 176 ms |
| Explorer: sort click | 172 ms task, event 208 ms |

## Findings

### PERF-01 · High · `/data/municipios.json` is 2.27 MB, served without compression, and fetched eagerly
- **Evidence:**
  - The response carries `cache-control: public, max-age=3600` and no `Content-Encoding`, even with `Accept-Encoding: gzip, br`. Body is 2,326,818 B (gzip 889 KB, brotli 736 KB).
  - `/data/indice.json` behaves the same: 280 KB served raw, 98 KB gzip.
  - Prerendered HTML and `/geo/*` *are* gzipped by `next start`. Only the prerendered route-handler bodies skip compression.
  - On Slow 4G the explorer becomes usable after **17.4 s**. Lighthouse LCP is 18.2 s on `/` and 14.7 s on `/explorar`.
  - `/` and `/regiao/*` download the full file on mount even though the default map mode is "Estados", which does not need it. `/acompanhar` downloads all 5,570 rows to show 2 watched cities.
- **Root cause:**
  - `web/src/app/data/municipios.json/route.ts:5` and `web/src/app/data/indice.json/route.ts:4`: prerendered route handler output is served from the cache body without compression.
  - `web/src/components/territory/TerritoryDashboard.tsx:123` calls `loadAllRows()` unconditionally in an effect.
  - `web/src/components/Watchlist.tsx:47` does the same.
- **Fix:**
  1. Emit the files at build time as static assets in `public/data/` (a build script writing `.json`). Static files get gzip/brotli from both `next start` and the Vercel CDN. Use hashed or versioned names with `immutable`. Vercel's edge should compress the route handler too, but self-hosting and the local check do not. Expected: **−1.5 MB transfer**, explorer ready about 3× sooner (~6 s on Slow 4G).
  2. Shrink the payload. Split per year or per metric (the explorer shows one year at a time), or use columnar arrays and drop rarely used columns such as `aluno`/`fun`, loaded later on demand. Splitting per UF also lets `/acompanhar` fetch only what it needs.
  3. In `TerritoryDashboard`, load rows only when the user picks "Municípios" (or with `requestIdleCallback` after LCP). This removes 2.3 MB from the critical window of `/` and `/regiao/*`.

### PERF-02 · High · Explorer table is not virtualized; "Mostrar mais" blocks the main thread for up to 1.2 s
- **Evidence:** each click adds 200 rows. After 5 clicks: 1,100 rows, **50k DOM nodes**, longest task 1,206 ms, TBT 3.8 s. The table is about 45 nodes per row (sparkline cells). Showing all 5,570 rows would mean about 250k nodes.
- **Root cause:**
  - `web/src/components/Explorer.tsx:520` renders `sorted.slice(0, limit).map(...)` directly.
  - `Explorer.tsx:474` raises `limit` by `MORE = 200`.
- **Fix:**
  - Window the rows, either with `@tanstack/react-virtual` or `content-visibility: auto; contain-intrinsic-size` on `<tr>`.
  - Wrap `setLimit` in `startTransition`.
  - Draw the 18-year sparkline as one `<svg>` path (or a CSS gradient) instead of per-year elements.
- **Expected:** DOM bounded at about 2–3k nodes, "show more" under 50 ms.

### PERF-03 · Medium · Municipal choropleth: 492 ms task on mode switch; every year change re-renders 5,570 paths
- **Evidence:**
  - Mode switch: 492 ms task.
  - Per year change: 110–186 ms tasks, and INP proxy reaches 248 ms on rapid switching (18 clicks = 2 s blocked).
  - Heap rises 20 → 50 MB.
- **Root cause:**
  - `web/src/components/Choropleth.tsx:67-92` runs `feature()` plus `geoPath` over 5,570 features on the main thread, at first render and whenever `layer`/`height`/`ufKey` change.
  - `Choropleth.tsx:200-217`: `Shapes` is `memo`ized, but its `fill` callback identity changes with each year/metric (see `TerritoryMap`). React therefore re-renders and diffs all 5,570 `<path>` elements every time.
- **Fix:**
  1. Precompute projected SVG path strings at build time, per UF and for BR (they are static for a fixed `W`/`height`). This removes topojson and d3-geo from the client (~30 KB) and the 492 ms task.
  2. Keep paths stable and color them via a `data-bin` attribute plus CSS classes, or set `fill` imperatively in a `useLayoutEffect` loop. Updating 5,570 attributes costs under 20 ms.
  3. Wrap the year/mode setters in `startTransition` or `useDeferredValue` so the year chip responds immediately.
- **Expected:** INP under 100 ms at 4x CPU.

### PERF-04 · Medium · UF pages inline every municipality as verbose `Row` objects in HTML/RSC, and city pages prefetch them
- **Evidence:**
  - `/mg` HTML is 717 KB raw / 161 KB gzip; a single RSC line in `mg.rsc` is 528 KB.
  - `/sp` HTML is 603 KB raw / 130 KB gzip.
  - Every city page fetches `/sp?_rsc=…` (**114 KB**) as a viewport prefetch of the breadcrumb link. That prefetch makes up about a quarter of the city page's 494 KB "Fetch" bytes.
- **Root cause:**
  - `web/src/app/[uf]/page.tsx:66` passes `rows={rowsIn(...)}`: full `Row` objects with repeated keys and 6 arrays × 18 years.
  - Prefetch of `<Link href="/sp">` in `web/src/components/Breadcrumbs.tsx`, together with `partialPrefetching: true` in `next.config.ts`.
- **Fix:**
  - Pass `packRows(rows)` (already in `web/src/lib/rows.ts`) and unpack on the client. Expected ~40–60% smaller.
  - Alternatively, ship only the current year's columns server-side and lazy-load the rest.
  - Set `prefetch={false}` on breadcrumb/UF links from city pages, or move the UF table under a Suspense hole so the static prefetch is just the shell.
- **Expected:** −60 to −90 KB gzip per UF page and −114 KB per city page view.

### PERF-05 · Medium · Viewport prefetch on mobile nearly doubles bytes on light pages
- **Evidence:**
  - `/sobre` needs 261 KB gzip JS (14 chunks) but downloads 405 KB of scripts plus 9 RSC prefetches (532 KB total).
  - The Recharts chunk (125 KB gzip) is not referenced by `sobre.html` but is fetched through prefetch of the header/footer nav links.
  - The first load of every page is therefore about 0.5 MB on a metered mobile plan.
- **Root cause:** `Link` defaults in `web/src/components/kit/nav.tsx` and the footer `web/src/app/layout.tsx:66-72`, which renders the same NAV links twice.
- **Fix:** set `prefetch={false}` on footer links (or prefetch only on hover/intent), and keep the default for the header only. Expected −150 to −250 KB on first visit to any page.

### PERF-06 · Medium · Baseline JS is 261 KB gzip on text-only pages
- **Root cause:**
  - `SearchPalette` in the root layout statically imports `cmdk` plus base-ui `Dialog`/`Command` (`web/src/app/layout.tsx:4`, `web/src/components/SearchPalette.tsx:3-9`). The dialog chunk alone is ~64 KB raw.
  - `next-themes` and the Tooltip provider are also in the layout.
- **Fix:** keep only the trigger button in the layout and load the palette with `next/dynamic(() => import(...), { ssr: false })` on first open or on the ⌘K keydown. Expected −20 to −30 KB gzip on every route.
- `/` and `[uf]` pages also load the whole Recharts chunk up front (125 KB gzip). Lazy-load the below-the-fold charts (`TrendChart`, `MultiLine`, `Histogram`, `YearBars`) with `next/dynamic` and a skeleton.

### PERF-07 · Medium · City pages fetch `indice.json` (274 KB, uncompressed) only to label map tooltips
- **Evidence:** every city page requests `/data/indice.json`: 274 KB raw, 98 KB gzip.
- **Root cause:** `web/src/components/CityMap.tsx:19-27` calls `loadIndex()` on mount.
- **Fix:** add `[slug, name]` for the state's municipalities to `CityMapValue` (the server already has them; this adds ~10–20 KB raw for SP), or call `loadIndex()` on first pointer interaction. Expected −98 KB gzip (−274 KB today) per city view.

### PERF-08 · Low · Static geo and data files have weak caching
- `/geo/br.topo.json`: 1.0 MB raw / 273 KB gzip, `Cache-Control: public, max-age=0`, so every visit revalidates.
- `/geo/uf/*.topo.json`: same headers.
- `/data/*.json`: `max-age=3600` with no ETag and no versioning, so after a data update a client can mix new HTML with stale rows for up to 1 h. `alignRows` mitigates the year shift only.
- **Fix:**
  - Version the filenames (`/geo/br.<hash>.topo.json`) and send `public, max-age=31536000, immutable` via `headers()` in `next.config.ts`.
  - Simplify `br.topo.json` further for the national view: 5,570 municipalities at 800 px wide do not need this precision. Try `mapshaper -simplify 5%` and quantization; ~273 KB gzip could likely be halved.

### PERF-09 · Low · Explorer typing and sorting are borderline for INP
- **Evidence:** ~157 ms task per keystroke, sort event 208 ms (4x CPU).
- **Root cause:** `web/src/components/Explorer.tsx:180-223` recomputes facets, filter, sort and aggregate synchronously on every keystroke.
- **Fix:** `useDeferredValue(q)` plus a precomputed normalized-name index. Expected events under 100 ms.

### PERF-10 · Low · Build output is 2.9 GB
- **Evidence:**
  - 1.27 GB of HTML plus 1.6 GB of RSC.
  - About 1.07 GB of the RSC is PPR segment files, which duplicate `_full.segment.rsc` ≈ `.rsc`.
  - City HTML median is 224 KB raw. HTML is about 2.2× the RSC because the flight payload is inlined, and it repeats long Tailwind class strings in rendered tables.
- **Impact:** slow deploy upload and cache restore; risk of hitting hosting output limits.
- **Fix:**
  - Reduce per-city markup: extract repeated table and card JSX into client-free components with shorter class lists, or `@apply` component classes.
  - Consider whether `partialPrefetching` segment files are worth 1 GB.
  - Consider whether all 5,570 pages must be prebuilt, or whether ISR on first request with `generateStaticParams` limited to capitals and large cities is enough.

### PERF-11 · Low · `/dados/csv/brasil` is 12.7 MB served without compression
- **Evidence:** `cache-control: s-maxage=31536000`, no `Content-Encoding`.
- **Root cause:** the same uncompressed route handler path as PERF-01.
- **Fix:** generate the CSV into `public/` (or offer `.csv.gz`/`.zip`). CSV compresses about 8–10×.

### ROB-01 · Medium · Explorer shows a contradictory state when the data fetch fails
- **Evidence:** with `/data/*.json` aborted, the error "Não foi possível carregar os dados dos municípios." renders below the fold. Above it, "Carregando municípios…" and the KPI skeleton cards stay forever. A mobile user sees an endless loading state. See `qa/reports/performance/fail_explorar_data.png`.
- **Root cause:** `web/src/components/Explorer.tsx:406` and `:536` check only `!data` and ignore `error`. The skeleton cards also check only `!data`.
- **Fix:** render the error and retry in place of the summary line and skeletons when `error` is true.
- Other failure paths behave correctly. Home `/` and `/acompanhar` show "Não foi possível…", and map geo failure shows "Não foi possível carregar o mapa."

### ROB-02 · Low · City map silently degrades when `indice.json` fails
- **Evidence:** names show as "…" forever, map clicks do nothing, and nothing is announced.
- **Root cause:** `web/src/components/CityMap.tsx:24` has `.catch(() => {})`.
- **Fix:** show a short notice and retry on the next interaction, or remove the dependency (PERF-07).

### ROB-03 · Low · No offline fallback
- **Evidence:** after load, `setOffline(true)` and a click on a municipality link: the client navigation's RSC fetch fails, Next falls back to a hard navigation, and the user lands on Chrome's offline error page (`chrome-error://chromewebdata/`, `qa/reports/performance/offline_nav.png`).
- **Fix (optional):** a small service worker caching visited pages and `/data/*` would suit the target audience (school councils on poor mobile connections).

### ROB-04 · Info · Rapid navigation and back/forward cache
- Rapid navigation: 8 link clicks 150 ms apart ended correctly on `/dados`, with no page errors.
- Back/forward cache cannot be verified in headless Chromium (bfcache is disabled by the command line).
- The HTML headers do not block bfcache: `s-maxage` only, no `no-store`, no `unload` listeners found. Re-check in headed Chrome DevTools under Application → Back/forward cache.

### SEO-01 · High · Unknown URLs return 200 on the first request (soft 404)
- **Evidence:** on a fresh server, the first hit to each unknown path returns **200**, and the second returns 404 (cached):
  - `/qq`, `/sp/xyz123`, `/regiao/abc` and `/humans.txt` return 200 first, then 404.
  - `/sitemap.xml`, `/robots.txt` and `/favicon.ico` also returned 200 HTML on first hit.
  - The body is the not-found UI with `noindex`, but the status is 200. Crawlers and link checkers see soft 404s.
  - On a CDN with several regions or instances, each one serves a 200 at least once.
- **Root cause:** dynamic segments are partially prerendered (◐ in the build output). `notFound()` runs inside the `<Suspense>` boundary after the 200 shell has started streaming:
  - `web/src/app/[uf]/[slug]/page.tsx:67-81` (`CityContent`)
  - `web/src/app/[uf]/page.tsx:32-36`
  - `web/src/app/regiao/[slug]/page.tsx`
- **Fix:**
  - Reject unknown params before streaming. Use `export const dynamicParams = false` where it is supported with `cacheComponents`; verify on 16.4.
  - Alternatively, move the existence check (`getCity`/`getUf`) into the page component above the Suspense boundary. All valid params are known from `generateStaticParams`.
  - Add a regression test: `curl -o /dev/null -w '%{http_code}' /sp/nao-existe` must be 404 on the first hit.

### SEO-02 · High · No Open Graph/Twitter tags and no share image, so WhatsApp previews are empty
- **Evidence:** on `/`, `/sp`, `/sp/santo-andre`, `/regiao/sudeste`, `/explorar` and `/sobre`, all of `og:title`, `og:description`, `og:image`, `og:url` and `twitter:card` are absent, and there is no `metadataBase`. A city link shared on WhatsApp, the main distribution channel for this audience, shows only a bare URL or plain title.
- **Root cause:**
  - `web/src/app/layout.tsx:15-19`: metadata has only title and description.
  - `generateMetadata` in `web/src/app/[uf]/[slug]/page.tsx:55-66` and `web/src/app/[uf]/page.tsx:17` return only title and description.
- **Fix:**
  - Root layout: add `metadataBase: new URL(process.env.SITE_URL)`, `openGraph: { siteName: "Radar MDE", locale: "pt_BR", type: "website" }` and `twitter: { card: "summary_large_image" }`.
  - City pages: add an `opengraph-image.tsx` (`ImageResponse`) showing the city name, latest MDE %, the 25% status color and a mini 18-year bar strip. Prerender it with the page, or generate it on demand with caching so build size does not grow by 5,570 PNGs.
  - Set `openGraph.title`/`description` from the existing description text.

### SEO-03 · Medium · No sitemap.xml, no robots.txt, no canonical
- **Evidence:** `/sitemap.xml` and `/robots.txt` give 404 (200 on first hit, see SEO-01). There is no `<link rel="canonical">` anywhere.
- **Impact:**
  - 5,600 deep pages depend on crawl discovery.
  - `?ano=` variants (YearPicker mirrors the year in the URL) and `/SP` vs `/sp` can be indexed as duplicates.
- **Fix:**
  - Add `app/sitemap.ts` listing `/`, regions, UFs and 5,570 cities. That is under 50k URLs, so one file is enough; use `lastModified` from `meta.updated`.
  - Add `app/robots.ts` pointing to the sitemap.
  - Add `alternates: { canonical: path }` in each `generateMetadata` (which also strips `?ano=`).

### SEO-04 · Medium · No favicon, apple-touch-icon, manifest or theme-color
- **Evidence:**
  - `/favicon.ico`, `/icon.png`, `/apple-touch-icon.png` and `/manifest.webmanifest` all 404.
  - No `<link rel="icon">` is emitted.
  - `public/` still holds the create-next-app placeholders (`next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg`).
- **Fix:**
  - Add `app/icon.svg` (the `Logo`), `app/apple-icon.png` and `app/manifest.ts`.
  - Set `viewport.themeColor` for light and dark.
  - Delete the unused SVGs.

### SEO-05 · Low · Generic descriptions on some pages; metadata inconsistencies
- `/explorar` and `/sobre` reuse the site-wide description. Give each its own.
- `/sp/Santo-Andre` (mixed case) renders the not-found body, yet `<title>` is "Santo André (SP) · Radar MDE" and has no `noindex`, while `/SP` gets `noindex`. `generateMetadata` and the page disagree on case handling. Make `generateMetadata` apply the same lowercase guard as `CityContent`, or 308-redirect mixed case to lowercase in `next.config.ts` redirects.

### BUILD-01 · Info · Isolated build works
`distDir: process.env.NEXT_DIST_DIR` in `web/next.config.ts:7` works, and a production build can run next to `next dev`.

### BUILD-02 · Low · An isolated build rewrites tracked config files
- **Evidence:** `NEXT_DIST_DIR=.next-perf next build` modified `web/tsconfig.json` (added `.next-perf/types/**/*.ts` to `include`) and `web/next-env.d.ts` (switched its imports to `./.next-perf/...`). This breaks the dev server's type references and dirties git. Both files were restored after this run.
- **Fix:**
  - Pre-add a glob such as `".next*/types/**/*.ts"` to `tsconfig.json` `include`.
  - Run the parallel build with `typescript.ignoreBuildErrors` off but in a copy, or restore `next-env.d.ts` in a wrapper script.
  - Add `.next-*` to `.gitignore`.

## Priority summary

| ID | Sev | Expected gain |
|---|---|---|
| PERF-01 | High | −1.5 MB per map/explorer visit; explorer ready ~17 s → ~6 s on Slow 4G; home Lighthouse LCP 18 s → under 4 s |
| PERF-02 | High | Remove 1.2 s tasks; DOM from 50k to ~3k nodes |
| SEO-01 | High | Correct 404 status for crawlers and link previews |
| SEO-02 | High | Rich WhatsApp/social previews for 5,570 city pages |
| PERF-03 | Med | Map INP 250 ms → under 100 ms; −492 ms task on mode switch |
| PERF-04 | Med | −60 to −90 KB gzip per UF page, −114 KB per city view |
| PERF-05/06/07 | Med | −150 to −350 KB on first visit to light and city pages |
| SEO-03/04, ROB-01 | Med | Indexing, branding, honest error state |
| Others | Low | Caching, build size, polish |

---

## Round 2: re-measure after ff4a309 (+ proxy fix build `.next-prod2`)

- **Server:** coordinator's prod server on :3299. I did not rebuild or stop it, and edited nothing under `web/`.
- **Profile:** same as Round 1 (4x CPU, Slow 4G, cold context per route).
- **Saved cities:** every context is seeded with 3 saved cities (`sp/santo-andre`, `mg/belo-horizonte`, `ba/salvador`).
- **Discarded run:** my first R2 run straddled the coordinator's rebuild (`/sp/santo-andre` returned 308 and a blank page). I threw it away and re-measured everything on `.next-prod2`.
- **Script fixes:**
  - Round-1 abort globs (`**/data/*.json`) did not match the new `?v=` URLs. I replaced them with regexes.
  - The explorer "ready" probe now waits for rows instead of `tr:nth-child(50)`, which a virtual window never reaches.
- **Artifacts:**
  - `qa/reports/performance/results-r2-*.json`
  - `round2-measure.log`
  - `lh_*.json`
  - `fail_*.png`
  - Round-1 files are in `qa/reports/performance/round1/`.
- **New scripts:**
  - `palette-and-lh.mjs palette` measures ⌘K latency.
  - `palette-and-lh.mjs lh-acompanhar` runs Lighthouse with a seeded watchlist.
  - `explorer-typing.mjs` was updated.

### R2 per-route metrics (before → after)

| Route | LCP | CLS | TBT | Longest | Transfer | HTML gz / raw | Fetch (data + prefetch) |
|---|---|---|---|---|---|---|---|
| / | 1.62 → 1.62 s | 0 | 130 → 144 ms | 113 → 166 | **3,134 → 910 KB** | 46/395 → 52/438 | **2,576 → 330 KB** |
| /regiao/sudeste | 1.60 → 1.60 s | 0 | 255 → 188 | 247 → 128 | 3,169 → 1,731 KB | 23/148 → 25/164 | 2,629 → 1,164 KB (municipal map is the default here) |
| /sp | 1.66 → 1.70 s | 0 | 205 → 190 | 155 → 164 | 751 → 788 KB | **130/603 → 129/585** | 105 → 117 KB |
| /mg | 1.68 → 1.70 s | 0 | 231 → 206 | 156 → 162 | 807 → 843 KB | **161/717 → 161/680** | 128 → 140 KB |
| /rr | 1.59 → 1.62 s | 0 | 147 → 127 | 154 → 150 | 602 → 640 KB | 21/131 → 23/143 | 64 → 75 KB |
| /sp/sao-paulo | 1.60 → 1.63 s | 0 | 185 → 203 | 178 → 209 | 1,065 → 937 KB | 33/260 → 39/276 | 494 → 321 KB |
| /sp/santo-andre | 1.61 → 1.64 s | 0 | 179 → 194 | 168 → 203 | 1,068 → 940 KB | 37/289 → **43/310** | 494 → 321 KB |
| /rr/boa-vista | 1.60 → 1.64 s | 0 | 138 → 171 | 163 → 196 | 911 → 785 KB | 26/201 → 33/251 | 347 → 176 KB |
| /explorar | 1.59 → 1.61 s | 0 | 125 → 42 | 169 → 92 | **2,805 → 1,347 KB** | 10/77 → 12/87 | **2,318 → 850 KB** |
| /acompanhar (3 saved) | 1.57 → 1.60 s | 0 → **0.251** | 9 → 2 | 59 → 52 | **2,802 → 627 KB** | 7/32 → 8/39 | **2,318 → 78 KB** |
| /dados | 1.59 → 1.62 s | 0 | 9 → 8 | 59 → 58 | 535 → 556 KB | 18/191 → 24/243 | 40 → 47 KB |
| /sobre | 1.57 → 1.60 s | 0 | 1 → 0 | 51 → 0 | 532 → 553 KB | 14/60 → 20/85 | 41 → 48 KB |

First-load JS (gzip, from HTML `<script>` tags):

| Route | Before → after |
|---|---|
| /sobre | **261 → 231 KB** |
| /acompanhar | 266 → 239 KB |
| /explorar | 288 → 283 KB |
| / | 400 → 382 KB |
| /[uf] | 430 → 429 KB |
| city | 420 → 430 KB |

Lighthouse 12, mobile (Round 1 → Round 2):

| Route | Perf | LCP | TBT | CLS | Bytes | BP | SEO |
|---|---|---|---|---|---|---|---|
| / | 70 → **77** | 18.2 → **5.6 s** | 100 → 160 ms | 0 | 3,140 → **911 KiB** | 96 → 100 | 100 |
| /explorar | 71 → **94** | 14.7 → **3.1 s** | 230 → 30 ms | 0 | 2,812 → 1,349 KiB | 96 → 100 | 100 |
| /sp | n/a → 82 | 4.5 s | 130 ms | 0 | 790 KiB | 100 | 100 |
| /sp/santo-andre | 88 → 86 | 3.9 → 4.2 s | 80 ms | 0 | 1,075 → 942 KiB | 96 → 100 | 100 |
| /acompanhar (3 saved) | n/a → 98 | 0.8 s | 0 | **0.088** | 143 KiB* | 100 | 66 (intentional `noindex`) |

\* For `/acompanhar`, Lighthouse attached to a pre-seeded Chrome with `--disable-storage-reset`, so the HTTP cache was warm and bytes are understated. CLS is real.

Interactions (4x CPU):

| Scenario | Before → after |
|---|---|
| Home "Municípios" switch, longest task | 492 → **411–424 ms**. The data now downloads lazily on click: **5.5 s until painted** on Slow 4G (was 0.66 s, because rows had been preloaded) |
| Home, 1 year step | longest 161 → 95–113 ms; event 192 → **72–88 ms** |
| Home, 18 rapid year clicks | TBT 2,043 → 1,367–1,853 ms; max event **248 → 88–104 ms** |
| /mg, 10 rapid year clicks | TBT 746 → 612 ms, longest 158 → 96 ms |
| Home heap after map use | 50 → 55 MB (14.4k nodes) |
| Explorer data ready (Slow 4G) | **17.4 → 9.6 s** |
| Explorer DOM | 50,049 nodes for 1,100 rows → **1,107 nodes total, 19 `<tr>` in DOM** (virtualized) |
| Explorer: scroll through all 5,570 rows (40 jumps, 3.3 s) | 112 frames; 10–15 frames over 50 ms, worst frame 67 ms; longest task 70–85 ms; TBT 364–462 ms |
| Explorer typing "santo" | ~157 ms task per key, event 176 → **no long tasks, max event 40 ms** |
| Explorer sort | event 208 → 104 ms, one 65 ms task |
| ⌘K palette, cold first open (dialog chunk not loaded) | **795 ms** with no throttling, **856 ms** with 4x + Slow 4G; reopen 10–46 ms; typing to first result 0.7–1.0 s (index fetched only after open) |

### Status of Round-1 findings

| ID | Status | Before → after / note |
|---|---|---|
| PERF-01 | **FIXED** | `/data/*.json` now go through `app/data/compressed.ts`: brotli, ETag, 304 on `If-None-Match` (verified), and `?v=<DATA_VERSION>` gives `immutable`. `municipios.json` transfer is 2,273 → 795 KB and `indice.json` 274 → 90 KB. Home no longer preloads rows (Fetch 2,576 → 330 KB). `/acompanhar` uses `/acompanhar/dados` (966 B for 2 cities). Residual: the payload is still 2.34 MB raw and not split; see PERF-12 |
| PERF-02 | **FIXED** | Virtual window, 19 rows in DOM. Mild scroll jank remains: 10–15 frames over 50 ms during fast jumps at 4x CPU |
| PERF-03 | **PARTIAL** | Year-switch INP is fixed (`useDeferredValue`; max event 248 → ~100 ms). The 411–424 ms projection task on first municipal render is not fixed, because geometry is still projected on the client (`Choropleth.tsx`). Precomputed paths are still recommended |
| PERF-04 | **NOT FIXED** | `/sp` 130 KB gzip / 585 KB raw and `/mg` 161 KB / 680 KB are unchanged. City pages still prefetch `/sp?_rsc=…` (**113 KB**) through the breadcrumb |
| PERF-05 | **PARTIAL** | Footer links have `prefetch={false}` (`layout.tsx:97`), but header nav still prefetches. `/sobre` still fetches 9 RSC prefetches and the 126 KB gzip Recharts chunk (`1ld_8e5z4zudl.js`) it does not use; transfer 532 → 553 KB |
| PERF-06 | **FIXED** (palette) / PARTIAL (charts) | The palette is now `next/dynamic` + preload on intent, and baseline JS dropped 261 → 231 KB. Recharts is still eager on `/`, `/[uf]` and city pages |
| PERF-07 | **PARTIAL** | `indice.json` on city pages is now 90 KB brotli, versioned and immutable, but it is still fetched on mount just for tooltips. City "Fetch" 494 → 321 KB |
| PERF-08 | **PARTIAL** | Data files are versioned and immutable (FIXED). `/geo/*.topo.json` is still `public, max-age=0` (NOT FIXED), and `br.topo.json` is still 273 KB gzip |
| PERF-09 | **FIXED** | Typing max event 40 ms, sort 104 ms |
| PERF-10 | **REGRESSED** | Build output is now **4.1 GB**: `server/app` 2.9 GB plus a new `server/route-cache` 1.1 GB (14.7k files, written at build time 12:21, duplicating page HTML/RSC and `sitemap.xml.body`). It appeared together with `src/proxy.ts`; the coordinator reported 3.0 GB for `.next-prod` before the proxy. City HTML median 224 → **262 KB** raw |
| PERF-11 | **FIXED** | `/dados/csv/brasil`: 17.1 MB raw → 3.24 MB brotli q5 (≈ 174 ms to compress once per process) |
| ROB-01 | **FIXED** | The explorer shows "Dados indisponíveis" plus the error and "Tentar de novo"; no infinite skeleton |
| ROB-02 | **FIXED** | City page with `/data/*` aborted shows "Não foi possível…". The new `/ano/<ano>` fetch failure also shows an error |
| ROB-03 | NOT FIXED (optional) | Offline client navigation still lands on Chrome's error page |
| ROB-04 | Info | Rapid navigation is OK. bfcache still cannot be tested in headless |
| SEO-01 | **FIXED** | First hit to `/qq`, `/sp/xyz987` and `/regiao/zzz` returns **404**. Mixed case returns 308 to lowercase via the proxy |
| SEO-02 | **PARTIAL (release blocker)** | og/twitter tags and a per-city 1200×630 PNG (~46 KB) now exist. But every absolute URL is **`http://localhost:3210/...`** (`og:image`, `og:url`, canonical, sitemap `<loc>`, robots `Sitemap:`), because `NEXT_PUBLIC_SITE_URL` was not set at build (`web/src/lib/site.ts:2`). WhatsApp would fetch localhost. Set the env var in the deploy (or fall back to `VERCEL_PROJECT_PRODUCTION_URL`) and add a build-time check that fails when it is missing in production |
| SEO-03 | **PARTIAL** | `sitemap.xml` (5,605 URLs) and `robots.txt` exist. Canonical is present on city pages, `/explorar` and `/acompanhar`, but **missing on `/`, `/[uf]`, `/regiao/*`, `/sobre` and `/dados`**. The localhost caveat above applies |
| SEO-04 | **FIXED** | `icon.svg`, `apple-icon`, `manifest.webmanifest` and `theme-color` are present; `/favicon.ico` redirects 307 to `/icon.svg`. The create-next-app placeholder SVGs are still in `public/` (cosmetic) |
| SEO-05 | **FIXED** | `/explorar` and `/sobre` have their own descriptions; mixed-case URLs redirect |
| BUILD-01 | Info | — |
| BUILD-02 | **PARTIAL** | `.gitignore` now covers `/web/.next-*/`, and `tsconfig.json` is clean in git. `next build` with `NEXT_DIST_DIR` still rewrites those files; restore them after each isolated build, or pre-add `.next-*/types` to the tsconfig `include` |

### New findings (Round 2)

**PERF-12 · Medium · Home "Municípios" map waits 5.5 s on Slow 4G after the click (side effect of the PERF-01 fix)**
- **Evidence:** `untilPaintedMs` was 658 ms in R1, when rows were preloaded, and is 5,530–5,612 ms now. The click starts the 795 KB download. A "carregando" status is shown, so the UI does not hang.
- **Fix:**
  - Warm `loadAllRows()` on `requestIdleCallback` after load, or on `pointerenter`/`focus` of the "Municípios" segment (the palette already uses the same intent pattern).
  - Better: ship a per-year slice for the map (`/data/mapa/<ano>.json?v=`), about 5,570 × [id, mde, nd], roughly 25–35 KB brotli. The full 2.3 MB file is not needed to color one year.
- **Expected:** under 1 s.

**CLS-01 · Medium · `/acompanhar` with saved cities has CLS 0.251 (poor)**
- **Evidence:**
  - The R2 lab run measured CLS 0.251; Lighthouse measured 0.088.
  - Both shifts are attributed to `FOOTER.border-t` (0.052 at 61 ms and 0.199 at 76 ms).
  - The prerendered HTML contains "Nenhum município acompanhado": the server snapshot is `"[]"`. On hydration, the client swaps that empty state for the 3-city list, which pushes the footer down.
- **Root cause:**
  - `useSyncExternalStore(subscribe, snapshot, () => "[]")` in `web/src/lib/watchlist.ts`.
  - The empty-state branch in `web/src/components/Watchlist.tsx` (around line 100).
- **Fix:** render a neutral placeholder until mounted (a server snapshot of `null` means "unknown", not "empty"), with a reserved `min-height` of about 60vh. Show the empty state only after hydration confirms the list is empty.
- **Expected:** CLS ≈ 0.
- Round 1 measured this route without saved cities, so it was not caught then.

**OG-01 · Medium · Per-city OG image is rendered on every request with `cache-control: public, max-age=0, must-revalidate` and no ETag**
- **Evidence:** 10 different cities took 14–22 ms each on M-series hardware (warm process), 44–48 KB PNG each. Repeat requests are also re-rendered (14.7 ms). The `og:image` URL has a content hash (`?73c90a808ef72ccb`), so the URL changes when the build changes.
- **Impact on Vercel:**
  - Every crawler fetch (WhatsApp, Facebook, Telegram, X, Slack; group shares trigger repeated fetches) is a function invocation plus 46 KB of egress.
  - Cold starts add the `cities.json` parse (~61 ms measured) plus ImageResponse/wasm initialization.
  - WhatsApp's fetcher has a short timeout, so a cold start risks a missing preview.
- **Fix:**
  - Because the URL is already content-hashed, serve the image with `public, max-age=31536000, immutable`, or at least `s-maxage=86400, stale-while-revalidate=604800`.
  - With `cacheComponents`, wrap the data lookup in `'use cache'`, or implement the image as a route handler that sets headers.
  - Alternatively, prerender only state capitals and the top ~300 cities by population.

**CDN-01 · Medium (Vercel cost) · Dynamic `/data/*.json`, `/acompanhar/dados` and CSV routes send `max-age` without `s-maxage`**
- **Headers today:**
  - `compressed.ts` sends `public, max-age=31536000, immutable` (versioned) or `public, max-age=300, stale-while-revalidate=86400` (unversioned).
  - `/acompanhar/dados` sends `public, max-age=86400|300`.
- **Impact:** Vercel's CDN keys shared caching on `s-maxage` / `CDN-Cache-Control` (`max-age` alone is browser-only per Vercel docs; verify on a preview). As written, every new visitor who opens a municipal map, the explorer or a CSV triggers a function invocation that streams 795 KB to 3.2 MB from the function, instead of a CDN hit.
- **Cold cost per instance, measured locally:** parse `cities.json` 61 ms, brotli q9 of municipios 122 ms, CSV brasil brotli q5 174 ms (17 MB raw kept in memory per instance, plus compressed copies). The Brasil CSV first response took 0.41 s.
- **Fix:**
  - Add `s-maxage=31536000` (versioned) or `s-maxage=300, stale-while-revalidate=86400` (unversioned), or a `CDN-Cache-Control` header. Vercel's edge then serves its own compressed copy.
  - Alternatively, go back to build-time static files in `public/data/<version>/…`, which give zero invocations.
- `/[uf]/[slug]/ano/[ano]` already sends `s-maxage=86400, stale-while-revalidate=604800` (good). It is uncompressed, but only 3.8 KB, so that is fine.

**PAL-01 · Low · Cold ⌘K open takes ~0.8 s even on a fast CPU**
- **Evidence:**
  - The three palette chunks download in about 3 ms locally, yet the dialog appears **318 ms** after the keydown (no throttling, MutationObserver timing). Playwright's visibility wait reports about 0.8 s, which includes the open animation.
  - This matches React's Suspense reveal throttle (~300 ms) for the `next/dynamic` boundary.
  - `indice.json` is requested only after the dialog mounts (at +304 ms), so on Slow 4G the first results arrive about 1.0 s after typing starts.
- **Fix:**
  - Preload the dialog chunk on `requestIdleCallback` after load (it is ~20–30 KB gzip and almost always used), or on the first `keydown` of Meta/Control.
  - Start `loadIndex()` in the same idle callback.
  - Keep the dialog shell non-lazy, with only the results list lazy.
- **Expected:** open under 100 ms; results immediate on warm data.

**SIZE-01 · Low · City HTML grew 295 → 318 KB raw (gzip 37 → 43 KB); the growth is rendered markup, not RSC data**
- **Evidence:**
  - RSC actually **shrank** from 131 to 115 KB: per-year state values moved to `/ano/<ano>`, and no precomputed ranks or neighbours are embedded.
  - Of the HTML, 133 KB is inline flight scripts and 185 KB is markup.
  - **49% of the markup (90 KB) is `class="…"` attributes** (1,084 of them).
  - The largest blocks are the year table section (57 KB), the action kit `#agir` (29 KB, templates rendered for printing) and `#tese` (17 KB).
- **Fix (optional):**
  - Collapse repeated Tailwind utility strings on table cells into one component class via `@apply` (`.td-num` etc.).
  - Render the action-kit templates on demand (a client toggle), or move them into `<template>`/`details` rendered from data.
- **Expected:** about −80 KB raw / −8 KB gzip per page and about −450 MB of build output.

**PROXY-01 · Info · `src/proxy.ts` costs effectively nothing on the hot path**
- The matcher `/((?!_next/|geo/|data/|dados/csv/)(?:.*[A-Z].*))` runs only for paths that contain uppercase letters.
- Lowercase page TTFB is unchanged (2–7 ms locally), and `/geo/uf/SP.topo.json` is not intercepted.
- Uppercase paths redirect 308 to lowercase in about 1 ms with no loops. That includes percent-encoded paths: `/sp/s%C3%A3o-paulo` goes to `%c3%a3` and then 404s once.
- On Vercel it invokes Routing Middleware only for those rare uppercase URLs.
- The possible side effect is the extra 1.1 GB `route-cache` in PERF-10.

**SITEMAP · OK with caveats**
- 838 KB and 5,605 URLs is well under the 50k URL / 50 MB limits. It is cached at the route level (`x-nextjs-cache: HIT`, about 1 ms).
- It is served **uncompressed** (`Transfer-Encoding: chunked`, no `Content-Encoding`); gzip would be 36 KB. Crawlers tolerate this.
- Every `<loc>` is `http://localhost:3210` (SEO-02 blocker).
- `lastmod` is the same for all URLs, which is fine.

### R2 priorities

1. **SEO-02 env:** set `NEXT_PUBLIC_SITE_URL` before any public deploy. Every share link, canonical and sitemap entry currently points to localhost.
2. **CDN-01 and OG-01:** add `s-maxage`/immutable headers so Vercel serves the data, CSV and OG images from the CDN instead of invoking functions.
3. **CLS-01:** fix the `/acompanhar` hydration swap.
4. **PERF-12:** add idle prefetch or a per-year slice for the municipal map.
5. **PERF-10:** investigate the 1.1 GB `route-cache` and the 4.1 GB output.
6. **PERF-04 and PERF-05**, still open: packed UF rows, and no breadcrumb/nav prefetch of heavy pages.
