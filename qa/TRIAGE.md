# QA triage — fix wave 1

Source reports: `qa/reports/{academic,government,citizen,journalist,functional,a11y-visual,performance}.md`.
Five workstreams run **in parallel on the same working tree**. Each owns a disjoint set of files. Do not edit files
owned by another workstream; if you need a change there, append a request to `qa/fixes/REQUESTS.md`
(`- [W?→W?] what/why`) and work around it. Read `qa/fixes/CONTRACT.md` (written by W1) for new data fields.

Shared helpers already available: `normKey()` in `web/src/lib/format.ts` (accent/case/punctuation-insensitive key),
`useYear` / `withYear` in `web/src/components/YearPicker.tsx`.

Global rules
- UI copy in Brazilian Portuguese, plain language. Follow `web/DESIGN.md` (Vercel/Geist look, shadcn/ui Base UI — `render` prop, not `asChild`).
- Do not restart/kill the dev server on :3210. Verify in a headless Playwright browser (`qa/` has playwright + axe).
- Before finishing: `cd web && npx tsc --noEmit && npx eslint <your files>` clean. Do NOT run `next build` into `.next`
  (it would clobber the dev server); if needed use `NEXT_DIST_DIR=.next-wN` and delete it after, and restore
  `web/tsconfig.json`/`web/next-env.d.ts` if the build rewrites them.
- Don't git commit; the coordinator commits.
- Final message: list of fixed IDs, skipped IDs with reason, files changed, how verified.

## W1 · Data, exports & methodology
Owns: `scripts/build_data.py`, `web/src/data/*`, `web/src/lib/{data,rows,indice,thesis}.ts`, `web/src/app/data/**`,
`web/src/app/dados/**`, `web/src/app/sobre/**`, new `web/src/lib/csv.ts`, `qa/fixes/CONTRACT.md`.
- ACA-01, FUN-03: municipalities that didn't exist yet (installed 2013: Mojuí dos Campos, Pescaria Brava, Balneário Rincão,
  Paraíso das Águas, Pinto Bandeira; 2025: Boa Esperança do Norte) → no record / distinct "não existia" status, never "nd";
  exclude from coverage denominators.
- ACA-06, FUN-09: unknown `faltou_rs` → empty, not 0. ACA-04: flag atypical values (per-student outliers / big jumps, MDE % implausibly low/high, the
  "provável erro de declaração" cases) as data the UI can show (`atipico`), without silently dropping them.
- JOR-07 support: expose `capital` and year-over-year delta in rows. FUN-10/JOR/GOV-08: one CSV schema shared by
  /dados and Explorer (`lib/csv.ts`), UTF-8 BOM, plus Excel-Brasil variant (`;` separator, decimal comma). Region CSV (FUN-08) available.
- Methodology (/sobre): nominal R$ disclosure (JOR-05, ACA-05), pre-2020 "aplicado" is estimated (ACA minor), per-student
  denominator & indicator codes, population reference year, MG state-government gaps, health "desde 2015" overstatement,
  "participação no gasto total" mention, how to cite + license + data version/extraction date (GOV, ACA). Expose
  `meta` fields (extraction date, population year, data version) for the footer.
- PERF-01: make `/data/municipios.json` and `/data/indice.json` smaller (drop unused fields, compact keys ok only if you
  update every consumer — coordinate via CONTRACT.md; otherwise just trim) and send long cache + correct headers.
- **First thing**: write `qa/fixes/CONTRACT.md` describing new/changed fields & statuses so W2–W4 can code against it.

## W2 · Município page & action kit
Owns: `web/src/app/[uf]/[slug]/**` (page + new opengraph-image), `web/src/lib/templates.ts`, `web/src/components/{ActionKit,WatchButton,ShareButton,CityMap,TrendChart,YearBars,Breadcrumbs}.tsx`.
- FUN-04/GOV-05/JOR-01/ACA-03: city page honors `?ano=` and has a year picker (same client pattern as UF pages; keep static HTML).
  ShareButton link includes the year.
- Templates: GOV-01/ACA-02 (no data ≠ compliance), GOV-02 (non-declared years), GOV-03 (Fundeb 70% / unspent), GOV-04
  (atypical values hedged; EC 119 for 2020–21 + compensation status), legally careful wording.
- CIT-06: action kit higher on page, tabs usable at 375px, actions: copiar, WhatsApp, e-mail, plus "onde enviar" guidance/links.
- CIT-05: plain-language explanations (glossary popovers/inline help) for MDE, p.p., Fundeb, déficit, mediana, SIOPE, CACS, e-SIC, TCM.
  CIT-09 ranking wording, CIT-10 status when city stopped declaring (no green "Cumpre" headline; share text too),
  "better or worse" phrased plainly (e.g. "Subiu 14,5 pontos em relação a 2024").
- CIT-02 watch button touch state; CIT-04 focus rectangle on chart; ACA y-axis label clipping (TrendChart width);
  EC 119 pandemic note on MDE chart; R$ labeled nominal; A11Y: h1 "Santo AndréSP" reads wrong, 19 "SIOPE" links need
  distinct accessible names; no-data municipality page degrades gracefully (Boa Esperança do Norte).
- FUN-01 (city part): unknown slug must return real 404 status (call `notFound()` before any Suspense/streaming, or
  `dynamicParams = false` with generateStaticParams). FUN-05 for breadcrumb picker (use `normKey`). FUN-17 DF breadcrumb quirks.
- SEO-02 city part: `generateMetadata` with description + OG/Twitter, and a per-city `opengraph-image.tsx` (status + %).
- Print (GOV-07): add `print:hidden` to buttons/kit/nav-ish parts in your components; W5 does the global print CSS.

## W3 · Brasil / região / UF dashboards & maps
Owns: `web/src/components/territory/**`, `web/src/components/{UfDashboard,Choropleth,MultiLine,Histogram,YearPicker,useWidth}.tsx`,
`web/src/lib/{bins,geo}.ts`, `web/src/app/page.tsx`, `web/src/app/regiao/**`, `web/src/app/[uf]/page.tsx`.
- JOR-02/FUN-06: every drill link (map clicks, UfTable rows) keeps `?ano`. GOV-06: UF page filters/sort in URL; GOV-10
  recurrence filter on UF page.
- CIT-01: home gets a prominent "Encontre seu município" search entry (use `openSearch()`/`SearchButton` exported from SearchPalette).
- JOR-06: rename/explain the "Deixou de ir para a educação" KPI (year in label, "estimativa", formula tooltip, "vs ano anterior").
  Headline "worst state" fairness (JOR: Acre 4 of 22 — use min N or show counts), GOV: "/pa 0 de 119" with 25 nd — show nd.
- A11Y-03 map: bins distinguishable (thresholds/legend), hatch for "abaixo de 25%" or outline, CVD-safe; ensure below-25% cities visible
  at municipal scale (stroke/size). Coordinate colors with W5 (W5 owns tokens in globals.css — request via REQUESTS.md).
- A11Y-04: region lines distinguishable without color (direct labels/markers/dash), A11Y-07: maps keyboard-accessible or
  clear link "ver em tabela"; aria-live for KPI changes on year switch.
- VIS-01 UfTable responsive (key column visible at 375, no cut at 1280–1440), money format "R$ 14.173,5" fix; sort button targets ≥24px.
- PERF-01/03/04: fetch `/data/municipios.json` only when municipal map mode is shown; memoize per-year map fills; slim
  UF page inline rows if possible; FUN-08 region CSV link → region-only CSV (W1 provides route; see CONTRACT.md).
- FUN-01 (uf/region part): real 404 status for unknown UF/region/`/SP`. "em Bahia" grammar (FUN-15) if in your files.
- Tooltip copy "Passe o mouse…" → device-neutral (CIT-03).

## W4 · Explorer, search, watchlist, shell & SEO
Owns: `web/src/components/{Explorer,SearchPalette,Watchlist}.tsx`, `web/src/lib/watchlist.ts`, `web/src/app/{explorar,acompanhar}/**`,
`web/src/app/layout.tsx`, `web/src/app/not-found.tsx`, `web/src/components/kit/{nav,nav-items}.ts*`, new `web/src/app/{sitemap,robots,manifest,icon,apple-icon,opengraph-image}.*`, `web/next.config.ts`.
- FUN-02: search ranks exact/prefix state & region matches first ("bahia", "acre", "para", "norte", "sul", "brasil").
  CIT-07: typo tolerance + "ver todos os N resultados" (not just 8), UF hint parsing ("bom jesus go"). FUN-05 (`normKey`), FUN-11/12 noise.
  CIT-13 visible close button on mobile palette; PERF-06 lazy-load palette (cmdk) on first open.
- Explorer: JOR-03/GOV-06/FUN-07 all filters + sort + year in URL; JOR-07 capital filter + YoY change column/sort;
  atypical flag (from CONTRACT); EC 119 caveat for 2020–21; "2021 MDE" header wording; CSV via W1's `lib/csv.ts`
  following on-screen filters/sort, with Excel-Brasil option; PERF-02 virtualize or paginate (no 50k DOM nodes);
  ROB-01 visible error state with retry; legend cut on mobile.
- Watchlist: CIT-08 avoid downloading the whole dataset for a few cities if feasible; CIT-14 year columns reachable on mobile.
- Shell: CIT-12 mobile nav clipping "Metodologia"; footer shows data version/extraction date (from meta per CONTRACT);
  SEO-01 not-found title; SEO-02 site-wide metadataBase + OG/Twitter defaults + default OG image; SEO-03/04 sitemap.xml
  (all pages), robots.txt, favicon/icon, manifest, theme-color; PERF-05 prefetch tuning on huge link lists.

## W5 · Design system, a11y globals & print
Owns: `web/src/app/globals.css`, `web/src/components/kit/{panel,stat,status,segmented,page-header,theme,logo}.tsx`,
`web/src/components/ui/**`, `web/src/components/{chart-parts,Tile}.tsx`, `web/DESIGN.md`.
- A11Y-01: `--critical-ink` (≥4.5:1 on critical-soft, light & dark) used by StatusBadge/below badges.
- A11Y-02: `scroll-padding-top` accounting for sticky header + sticky context bar. A11Y-06: at short viewports / high zoom
  (`@media (max-height: 500px)`), sticky bars become static.
- A11Y-04: series/categorical chart colors ≥3:1 vs surface in light & dark — validate with the dataviz validator
  (`node /private/tmp/claude-501/bundled-skills/*/*/dataviz/scripts/validate_palette.js` if present; otherwise compute contrast + CVD ΔE yourself).
  A11Y-03 map bin tokens (bin-1..5, red-*) with adjacent-step separation and ≥1.5:1 contrast vs card where possible; coordinate with W3.
- A11Y-05: forced-colors support (legend swatches, dots, bars `forced-color-adjust`, segmented/selected state uses border/outline).
- Global: recharts/svg focus outline only on :focus-visible (CIT-04), touch targets ≥24px in kit controls,
  Stat delta pill no wrap at 320 (stat.tsx:45), sparkline anchored to bottom (stat.tsx:36), scroll lists not cutting last row.
- GOV-07/print: `@media print` stylesheet — hide header/nav/footer/buttons, expand tables, avoid breaking cards, light colors,
  print URL + date. Document new rules in DESIGN.md.
