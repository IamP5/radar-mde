# QA triage — fix wave 2

Same workstreams, file ownership and global rules as `qa/TRIAGE.md` (W1–W5). Findings come from the "## Round 2"
sections appended to `qa/reports/*.md`. Read the Round 2 section of every report for your IDs.
Since wave 1: case normalisation moved to `web/src/proxy.ts` (coordinator-owned; pages no longer redirect).
A production build runs at http://localhost:3299 (`web/.next-prod2`) — it will NOT reflect your edits; verify on dev :3210.

## Decisions (apply consistently)
- **Atypical values (JOR-17):** "possível erro de declaração" only for values that are outliers *against the
  municipality's own history* (or physically implausible, e.g. MDE < 5% or > 60%, per-student absurd jumps). Persistent
  low application (e.g. Volta Redonda 12–17% for years) is REAL under-application, not an error. Use neutral wording
  ("valor fora do padrão — confirme na fonte") in UI, never "erro" unless implausible. Remove the
  "dos quais R$ X em valores atípicos" lines from headline KPI cards (keep the info in tooltips/popovers and CSV).
- **Watch feature naming (CIT-19):** "Salvar" everywhere — button "Salvar" / "Salvo", page title "Municípios salvos",
  nav "Salvos" (route stays `/acompanhar`).
- **Site URL (SEO-02, CIT-16, JOR-20, FUN-22, ACA-18):** `lib/site.ts` resolves `NEXT_PUBLIC_SITE_URL` →
  `https://${VERCEL_PROJECT_PRODUCTION_URL}` → `https://${VERCEL_URL}` → `http://localhost:3000`; everything (metadataBase,
  sitemap, robots, citations, share text) imports `SITE_URL` from there. No `Host:` line in robots.
- **IPCA (ACA-05/JOR-05):** W1 downloads the official IPCA index (IBGE SIDRA, table 1737, Dec/Dec annual variation or
  the Dec index) at build-data time into `data/raw/` via `scripts/fetch_br.py` (no runtime fetch), exposes deflators in
  meta (`ipca`: year → factor to R$ of the latest year), adds `_real` columns to the CSV, and documents it in /sobre.
  W3 adds a "Nominal / Corrigido (IPCA)" toggle on accumulated-deficit panels; W2 shows the accumulated deficit corrected as secondary.
  If SIDRA is unreachable, stop and report — do not type values from memory.
- **Chart actions (JOR-04):** W5 builds `web/src/components/kit/chart-actions.tsx` (menu: Baixar PNG, Baixar SVG,
  Baixar CSV dos dados, Copiar citação "Radar MDE (ano). <título>. <url>. Fonte: FNDE/SIOPE."), first, and messages W2/W3
  (SendMessage to `fix-w2-city`, `fix-w3-territory`) when ready; W2/W3 wire it into their main charts' Panel actions.

## W1 · Data, exports & methodology
JOR-17 rule rewrite (+ /sobre + CONTRACT); ACA-04 per-student jump rule consistent with CONTRACT & /sobre (Rio Branco
2022→23 case), expose per-student flags for city charts; ACA-18 citations with SITE_URL + real access date format;
GOV-12 `topDeficits` carries atypical flag; GOV-09 add receita/aplicado/fundeb columns available to row CSV;
FUN-23 `/dados/csv/SP` case-insensitive id; CDN-01 `s-maxage`/`stale-while-revalidate` on `/data/*` and CSV routes;
A11Y-13 captions on /dados and /sobre tables; SEO-03 canonical on /sobre & /dados; IPCA (above); ACA-10 tell W2/W3 how
to know whether a UF has health data (field/helper) so the Saúde column hides when empty.

## W2 · Município page & action kit
GOV-19 garbled CACS words; GOV-20/FUN-20 keep letter edits across tab switches (lift state); FUN-21/CIT-21/GOV-26 short
mailto (copy full text to clipboard + mailto with short body saying "texto copiado — cole aqui"); GOV-24 legal basis by
year (Fundeb ≤2020: ADCT art. 60 + Lei 11.494/2007; ≥2021: art. 212-A + Lei 14.113/2020); GOV-25 + CIT-17 atypical
caveats in deficit headline and "Subiu/Caiu" sentence (and share text); CIT-15 y-axis first digit clipped (TrendChart);
ACA-20/CIT-18 OG bars from zero baseline; ACA-21/ACA-04 mark atypical points on city charts & list per-student flags in
"Sinais de alerta"; OG-01 cache headers for OG image + FUN-24 unknown city OG → 404; FUN-23 `/ano/02019` strict;
PERF-07 load `indice.json` only when needed; PERF-04 breadcrumb/UF links `prefetch={false}`; CIT-11 tap targets ≥24px
(glossary terms, "Voltar para 2025", kit links); A11Y-20 "≠" marker target; A11Y-05 "Posição" bar in forced-colors;
A11Y-15 city header text in rem; ACA-10 hide empty Saúde column; WatchButton naming per decision; JOR-19 share card
note: if `?ano` ≠ latest, share text states the year (OG image stays latest — acceptable); chart actions wiring;
GOV-26 empty "série histórica (abaixo)" item, stray space; canonical stays correct.

## W3 · Dashboards & maps
GOV-12 marker on "Maiores déficits"; GOV-21 UF "Baixar CSV" follows table filters + Excel-BR option (use `lib/csv`);
GOV-10 recurrence: "nos últimos N anos" and "N anos seguidos" + combined MDE/Fundeb filter; JOR-15 consistent delta
wording across home/region/UF; JOR-17 remove "dos quais…atípicos" from KPI cards; A11Y-03/A11Y-18 municipal maps:
below-25% visible in grayscale (halo/marker or pattern); A11Y-04 grayscale-distinct dashes (Nordeste vs Sul);
VIS-05 histogram empty space; A11Y-20 DF tiny shape on mobile (marker/label hit area); PERF-03 first municipal render
(~420 ms block) + PERF-12 prefetch rows on hover/focus/idle of the "Municípios" toggle; PERF-04 UF inline rows
(send only what the first render needs, lazy-load rest) if feasible; SEO-03 canonical for `/`, `/[uf]`, `/regiao/*`;
VIS-13 home search hero alignment; IPCA toggle; chart actions wiring.

## W4 · Explorer, search, watchlist, shell & SEO
A11Y-17 nav `scrollIntoView` steals first Tab (use container scrollLeft); FUN-19 Explorer city links keep `?ano`;
site URL decision (`lib/site.ts`, robots without Host); JOR-21/ACA-19 Explorer counts only municipalities that existed
that year (use `existedIn`), invalid `?ano` removed from URL; JOR-22 per decision; GOV-09 Explorer CSV columns
(receita, aplicado, fundeb) via W1; GOV-10 Explorer recurrence options parity with UF table; CLS-01 watchlist SSR
empty-state swap (render skeleton until hydrated); PAL-01 first ⌘K open latency (preload on idle, avoid Suspense throttle);
PERF-05 nav links don't prefetch heavy routes; PERF-08 `Cache-Control` for `/geo/*` via next.config headers;
A11Y-19 dark watchlist tile contrast; VIS-13 palette cap (100 of 203 → show all / paginate), footer wrapping,
watchlist 768px; CIT-19 naming per decision; CDN-01 `s-maxage` on `/acompanhar/dados`; sitemap compressed if cheap.

## W5 · Design system, a11y globals & print
VIS-12 page-header actions `shrink-0` squeezes title (wrap actions below title when tight; title min width);
A11Y-15 px→rem regression in kit/global (200% default font size check on /sp/santo-andre header);
GOV-22 print: Fundeb chart axis cut, half-empty first page (break rules); chart-actions kit component (above) first;
A11Y-05 leftover in kit components (bars/tracks forced-colors); any token requests in qa/fixes/REQUESTS.md.

# Wave 3 (small, from "## Round 3" sections)
- W5: ChartActions — export draws a legend (new optional `legend: {label, color, dash?}[]` prop, plus auto-collect from
  Recharts legend/series names when absent) and wraps/never clips the source URL footer (CIT-23, JOR-24, GOV-29, ACA-24);
  CSV numbers rounded (max 4 decimals, no float artefacts: CIT-24, JOR-25); citation/footers use `window.location.origin`
  on the client when SITE_URL is a localhost fallback (ACA-22, JOR-23 — coordinate with W4's lib/site.ts helper).
  On touch devices offer "Compartilhar imagem" via navigator.share({files}) when supported (CIT-26).
- W4: `lib/site.ts` exports a client-safe `siteUrl()` that returns `window.location.origin` in the browser when no
  explicit/Vercel URL is configured (ACA-22/JOR-23); tell W5.
- W3: pass `legend` + metric-explicit titles to ChartActions on maps (title names the metric + year; legend = bins) and
  multi-line charts (JOR-24); IPCA toggle, trend tab and map mode in the URL (JOR-26); GOV-27 option order ("Qualquer
  histórico" first — use an array, not object keys); GOV-28 print the full filtered table (no 50-row cap in print; hide
  filter controls; repeated header keeps labels).
- W2: pass `legend` to ChartActions (city vs UF median vs Brasil median, fora do padrão marker); CIT-25 paste hint
  device-aware ("toque e segure para colar" on touch).
- W1: ACA-23 flag one-year per-student spikes that revert (compare with both neighbours); CIT-27/ACA-24 money formatting:
  billions with 2 significant decimals ("R$ 1,03 bi") in `lib/format.ts` brlShort (W1 owns format.ts for this).
