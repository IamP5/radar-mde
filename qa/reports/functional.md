# Radar MDE · Functional QA report (phase 1: test and report only)

- **Target:** `next dev` on http://localhost:3210, 2026-10-07. Source was read but not edited.
- **Tester:** functional QA agent, using Playwright with headless Chromium.
- **Regression scripts** (all in `qa/reports/functional/`; run them from `qa/`):
  - `node reports/functional/crawl.mjs [--links all]`: crawl, 404 probes and internal-link check. Prints a PASS/FAIL summary and writes `crawl-results.json`.
  - `node reports/functional/interact.mjs [year search watch share theme mobile explorer uftable territory crumbs clicks notfound]`: 193 interactive checks. Prints PASS/FAIL per check and a summary.
  - `node reports/functional/csvcheck.mjs`: validates the `/dados/csv/*` exports.
  - Helpers: `search-order.mjs` dumps search-palette ranking, `txt.mjs <url> [regex] [shot]` dumps page text, `shots.mjs` takes full-page screenshots.

## Coverage summary

| Area | What was exercised | Result |
|---|---|---|
| Crawl | 140 pages: `/`, `/explorar`, `/acompanhar`, `/dados`, `/sobre`, all 5 regions, all 27 UFs (`/df` → `/df/brasilia`), and **103 city pages**. The cities are all 27 capitals, 2 seeded-random cities per UF, DF/Brasília, the apostrophe cases (Santa Bárbara d'Oeste, Pau D'Arco PA *and* TO, Olho d'Água das Cunhãs, Alta Floresta D'Oeste, Dias d'Ávila, Mãe d'Água, Olho d'Água do Borges, Pau D'Arco do Piauí, Sant'Ana do Livramento), hyphenated names (Embu-Guaçu), Boa Esperança do Norte (MT, no data at all), and all 10 cities that did not declare 2025. Each page was checked for HTTP status, `pageerror`, console errors and warnings (hydration, `key`, `Warning:`), failed requests and 4xx/5xx sub-requests (geo/topojson, `/data/*.json`), NaN/undefined/Infinity/null/`[object Object]` in the visible text, and empty Recharts charts. | **All 140 pages are clean.** There were 0 console, hydration or key warnings, 0 failed requests, 0 bad tokens and 0 empty charts. |
| Internal links | 2,133 unique internal `<a href>` were collected. 396 were checked: every non-city link (CSV links checked with HEAD) plus 300 random city links. Each check was GET with redirects followed, plus soft-404 detection. | All 200, with no soft-404 targets. |
| 404s | `/xx`, `/sp/nao-existe`, `/regiao/foo`, `/regiao/Sul`, `/SP`, `/Sp/santo-andre`, `/sp/Santo-Andre`, `/sp/santo-andre/extra`, `/dados/csv/xx`, `/regiao`, `/favicon.ico`, `/robots.txt` | **FUN-01** (soft 404s) and FUN-13 |
| Year picker | Click; Arrow keys, Home and End; prev/next buttons and their disabled state at the ends; `?ano` on reload; deep links; invalid `?ano=1999/abc/2015.5/2030/empty` fall back to 2025; drill-down from `/` to UF keeps `?ano`; back/forward keeps the year; clicking a bar in YearBars changes the year | Pass, except **FUN-04** and FUN-06 |
| Segmented / tabs / maps | Home: map mode (Estados/Municípios: 5,500+ paths render), map metric, trend segmented control, Evolução KPI tabs, ranking sort. UF: map metric MDE/Fundeb/Por aluno. Map click navigates. City: 4 template tabs and "Copiar texto" (clipboard verified), neighbour links, state map. | Pass, except FUN-06 and **FUN-03** |
| Tables | UF table: search, região intermediária filter, sort, "Mostrar mais" (50 → 150), empty state. Explorer: Região/UF/Exercício/Situação filters, conflicting params, lowercase `uf=sp`, invalid params, sort asc/desc, pagination (100 → 300), facet counts (Sul=1,191, SC=295, SP=645). | Pass, except **FUN-05** and FUN-07 |
| CSV | Explorer export (RR filtered: filename, BOM, 15×18 rows, every row RR, no NaN). `/dados/csv/{brasil,sp,df,mt,pa,ro,ac}`: BOM, Content-Disposition, consistent field count, numeric columns, row count = dataset (100,260 rows, 5,570 IBGE ids) | Pass, except FUN-08, FUN-09 and FUN-10 |
| Watchlist | Add from the city page (SP, MT no-data, DF); aria-pressed; persists across reload; `/acompanhar` lists 3; remove; removal persists; legacy bare-slug entries map to SP; unknown entry footer; corrupt JSON and non-string entries do not crash; cross-tab `storage` sync | All pass |
| Share | "Copiar link" (clipboard read back = absolute city URL); "Link copiado" label and its 2 s reset; WhatsApp opens `api.whatsapp.com/send?text=…` containing the URL | Pass (note under FUN-04) |
| Search palette | ⌘K, Ctrl+K, `/` (and `/` ignored inside inputs), Esc, accent-insensitive and uppercase queries, curly apostrophe, `pau d'arco` (PA+TO), `pau d'arco to`, `campinas sp`, regions, UF sigla, no-result state, whitespace-only query, arrow keys, Enter, recents, corrupt recents, DF → `/df/brasilia`, 404 CTA | Pass, except **FUN-02**, FUN-11 and FUN-14 |
| Breadcrumbs | Region menu, state menu (4 Sudeste UFs), municipality combobox (645 SP entries, filter, Enter), DF has no city picker | Pass, except FUN-05 and FUN-12 |
| Theme | Header toggle, persists across reload and navigation, footer radios in sync, "Sistema" follows the OS, inline no-flash script | All pass |
| Mobile (375 px, touch) | The nav reaches all 5 sections. No horizontal overflow on 10 routes including 404. Search opens on tap and tapping a result navigates. | Pass, except FUN-15 |

Every finding below was reproduced in at least two independent runs: crawl plus interact, or two interact runs.

---

## Findings

### FUN-01 · major · Routing/HTTP · Unknown UF, city and region URLs return a soft 404 (HTTP 200)
- **URL:** `/xx`, `/regiao`, `/sp/nao-existe`, `/regiao/foo`, `/regiao/Sul`, `/SP`, `/Sp/santo-andre`, `/sp/Santo-Andre`
- **Steps:** `curl -s -o /dev/null -w '%{http_code}' http://localhost:3210/sp/nao-existe`
- **Expected:** HTTP 404 with the not-found page, and `<title>` "Página não encontrada · Radar MDE".
- **Actual:**
  - Every case returns **200**. The "Página não encontrada" UI and `noindex` are rendered.
  - `<title>` is the default "Radar MDE · Brasil".
  - For `/SP` and `/Sp/santo-andre` the title is even "São Paulo · Radar MDE" or "Santo André (SP) · Radar MDE", because `generateMetadata` resolves case-insensitively (`getUf` upper-cases) while the page requires lowercase.
  - Contrast: `/sp/santo-andre/extra` (no matching segment) correctly returns 404 with the right title.
  - Crawlers, link checkers and monitoring will treat broken links as valid.
- **Evidence:** `crawl-results.json` → `nf`; `interact-run.log` → `404:` lines.
- **Root cause:**
  - `notFound()` is thrown inside a `<Suspense>` boundary after the shell has started streaming, so the status code is already committed as 200. This happens at `web/src/app/[uf]/page.tsx:26-34`, `web/src/app/[uf]/[slug]/page.tsx:70-80` and `web/src/app/regiao/[slug]/page.tsx:26,58-59`.
  - The title mismatch comes from `web/src/app/[uf]/page.tsx:18` and `[uf]/[slug]/page.tsx:57`, which don't apply the lowercase rule.
- **Fix:**
  - Validate params before the Suspense boundary. Make `Page` async, resolve `params`, call `notFound()` (or `redirect()` for case variants) first, then render `<Suspense>`. Alternatively, move the check into a non-suspended layout.
  - Add `permanentRedirect` from `/SP…` to the lowercase path instead of a 404.
  - Return `{}` or a "Página não encontrada" title from `generateMetadata` when the lowercase check fails.
  - Re-test against a production build too. Starting a second `next start` on another port was not permitted in this session, so only dev was verified.

### FUN-02 · major · Search · Typing a state or region name selects a small city instead of the state or region
- **URL:** any page → ⌘K
- **Steps:** Type `bahia` and press Enter.
- **Expected:** The state Bahia (`/ba`) is the top hit, since the name is an exact match of a territory.
- **Actual:** You land on **`/ba/itaguacu-da-bahia`**. Other queries pick the wrong top hit the same way:

  | Query | Top hit | Territory shown at |
  |---|---|---|
  | `acre` | Acreúna (GO) | position 5 |
  | `para` | Parauapebas | position 9 |
  | `parana` | Paranã (TO) | position 9 |
  | `ceara` | Ceará-Mirim (RN) | — |
  | `norte` | Nortelândia | position 9 |
  | `sul` | Sulina | position 9 |
  | `brasil` | Brasília (Brasil at position 9) | — |
  | `mato grosso` | Mato Grosso (PB city) | UF Mato Grosso is last |
  | `sp` | São Paulo city | UF is 9th, after 8 cities |

  The footer hint itself suggests "nordeste", which works only because no city starts with it.
- **Evidence:** `node reports/functional/search-order.mjs`; `interact-run.log` → "search: Enter on 'bahia'".
- **Root cause:** `web/src/components/SearchPalette.tsx:323-326` always orders `[...cities, ...ufs, ...regions]` when there is a query. Territory hits get no rank at all (`searchTerritories`, l.153), so a rank-1 prefix city match always beats a rank-0 exact state match.
- **Fix:**
  - Give territory options the same rank scale (exact, prefix, word-prefix) and merge them into one sorted list.
  - At minimum, put UFs and regions first when `keyOf(name) === query` or `uf === query`.
  - Keep exact city name ties (e.g. "rio de janeiro", "são paulo") ordered by population, or show both at the top.

### FUN-03 · major · Content/data · Boa Esperança do Norte (MT): false "complied" template text, "não declarou" claims for years before the municipality existed, and no map shape
- **URL:** `/mt/boa-esperanca-do-norte` (installed in 2025; every year in `cities.json` is `{"s":"nd"}`)
- **Expected:**
  - Years before installation are "não existia / sem dados", not "não declarou".
  - The action templates do not claim compliance.
  - The municipality is highlighted on the "Onde fica" map.
- **Actual:**
  1. The header shows the badge "Não declarou 2025" and an empty-state panel that says it "não declarou dados de MDE ao SIOPE/Tesouro em 2008, 2009, …, 2025. A falta de envio também é um sinal de alerta de transparência". This happens for years before the municipality existed. The `/acompanhar` table shows 18 red "n/d" cells. All CSVs contain 18 `nao_declarou` rows, and national "não declarou" counts are inflated by 1 for 2008–2024.
  2. The **"Pedido via Lei de Acesso" template** (and the other three) says: "o Município declarou ter cumprido o mínimo constitucional de 25% nos exercícios informados", followed by an empty "Percentuais declarados:" list. That is false and ends up in a letter users are invited to send.
  3. The municipality is missing from `web/public/geo/uf/MT.topo.json`, which has 141 geometries vs 142 cities (it is the only missing id of 5,570). The "Onde fica" map has no highlight and the MT choropleth cannot show it. With no `ly`, the whole MT map is also grey.
- **Evidence:** `reports/functional/boa.png`, `shots/acompanhar.png`; `interact-run.log` → `city(no data)` checks.
- **Root cause:**
  - The data build marks pre-installation years as `nd` (scripts/build_data.py).
  - `web/src/app/[uf]/[slug]/page.tsx:97,99,129,204` treats every `nd` as non-delivery.
  - `web/src/lib/templates.ts:26-28` falls into the "cumpriu" branch whenever `below.length === 0`, even when no year has data.
  - The geo is outdated (IBGE 2022 mesh) or the build did not include new municipalities.
- **Fix:**
  - Emit no record, or `{s:"na"}`, for years before installation (IBGE 2025 installation date) and skip them in `nd` lists and counts.
  - In `templates.ts`, add a third branch for `!hasAny` ("não há percentuais declarados…") and omit the empty "Percentuais declarados" block.
  - Regenerate MT topojson from the 2024/2025 IBGE mesh. Alternatively, fall back to a marker or a "geometria indisponível" note when `hiShape` is not found.

### FUN-04 · major · URL state · City page ignores `?ano`, so the year context is lost when drilling down from UF to city
- **URL:** `/sp?ano=2019`, then click any city in "Todos os municípios", e.g. `/sp/pirapora-do-bom-jesus?ano=2019`
- **Expected:** `YearPicker.tsx:7-9` documents that `?ano=` keeps context "when drilling down (Brasil → UF → município)", and the UF table and map deliberately append it (`UfDashboard.tsx:85,427`). The city page should open on 2019 for the headline, KPIs, map and neighbours.
- **Actual:**
  - The city page always shows the latest year ("Em 2025, aplicou 25,21%…"). `?ano` is silently ignored and there is no year control on the city page.
  - "Compartilhar → Copiar link" also drops it (`/sp/santo-andre?ano=2015` copies `/sp/santo-andre`).
- **Evidence:** `interact-run.log` → "year: city page honours ?ano=2019".
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx:88` uses `latestYear(c)` only. `ShareButton` builds the URL from `path` alone (`ShareButton.tsx:21`).
- **Fix:** Either add `useYear` and a year control on the city page (the KPIs, map, neighbours and histogram all depend on `ly`), or stop appending `?ano` to city links so the URL doesn't promise something it doesn't do. If a year is supported, have ShareButton append the current `?ano`.

### FUN-05 · minor · Search/filter · Name filters in Explorer, the UF table and the breadcrumb picker don't fold punctuation or curly apostrophes
- **URL:** `/explorar`, `/sp` (table search), breadcrumb "Trocar de município"
- **Steps:** Type `embu guacu`, `santa barbara d oeste`, `olho d agua`, or `santa bárbara d’oeste` (U+2019, which iOS and macOS smart punctuation inserts automatically).
- **Expected:** Same behaviour as the ⌘K palette, which finds all of them.
- **Actual:** 0 results ("Nenhum município com esses filtros"). Only the exact straight-apostrophe or hyphen spelling works.
- **Root cause:** `norm()` (`web/src/lib/format.ts:88`) strips accents and lowercases but keeps `'` `’` `-`. It is used at `Explorer.tsx:154,183`, `UfDashboard.tsx:90` and `Breadcrumbs.tsx:147`. The palette uses `keyOf` (`SearchPalette.tsx:22`), which maps punctuation to spaces.
- **Fix:** Export one `searchKey(s) = norm(s).replace(/[^a-z0-9]+/g," ").trim()` and use it on both sides in all four places. Optionally collapse spaces so "dagua" also matches "d agua".

### FUN-06 · minor · URL state · Map clicks on Brasil and region dashboards drop `?ano`
- **URL:** `/?ano=2015`, then click a state on the map
- **Expected:** `/am?ano=2015`, like the ranking table, UF multiples and region chips (all use `withYear`).
- **Actual:** `/am`. The year resets to 2025.
- **Root cause:** `web/src/components/territory/TerritoryMap.tsx:127-137` returns `ufPath`/`cityPath` without `withYear`.
- **Fix:** Wrap the result in `withYear(…, year, initialYear)`; this needs `year` and `initialYear` props.

### FUN-07 · minor · URL state · Most Explorer filters are not in the URL, so they are lost on reload and when shared
- **URL:** `/explorar?regiao=sul&uf=SC&ano=2021`, then set Situação = "Abaixo de 25%" (12 rows) and reload
- **Expected:** The same 12 rows. The page copy promises "exporte o recorte", and filtered views are meant to be shareable (`syncUrl` comment).
- **Actual:** 295 rows. Only `regiao`, `uf` and `ano` persist. Name search, População, Situação, Reincidentes, sort and page size reset. The UF dashboard table persists none of its filters.
- **Root cause:** `web/src/components/Explorer.tsx:108-116` only syncs regiao and uf.
- **Fix:** Extend `syncUrl` to `q`, `porte`, `sit`, `reinc` and `ord` (e.g. `mde-asc`), validated on read the way `regiao` and `uf` are.

### FUN-08 · minor · Data export · The region page's "Baixar CSV" downloads the whole country
- **URL:** `/regiao/sul` → "Baixar CSV"
- **Expected:** The Sul municipalities only, or a label that makes clear it is the national file.
- **Actual:** `/dados/csv/brasil` (12.7 MB, 100,260 rows).
- **Root cause:** `web/src/app/regiao/[slug]/page.tsx:71` hard-codes `/dados/csv/brasil`.
- **Fix:** Add `regiao-<slug>` support to `app/dados/csv/[uf]/route.ts` (add it to `generateStaticParams`) and link to it. Alternatively, link to `/explorar?regiao=<slug>` and use its export.

### FUN-09 · minor · Data export · `/dados/csv/*` writes `faltou_rs = 0` when the shortfall is unknown
- **URL:** `/dados/csv/brasil`
- **Actual:**
  - 626 `nao_declarou` rows have `faltou_rs=0`.
  - 1 declared-below row has `faltou_rs=0`: Barra do Choça (BA) 2021, `mde_pct=21.74`, `receita_impostos_rs` empty.
  - The Explorer export leaves the same cell empty, and the city page shows "sem base em 2021". "0" reads as "nothing was missing".
- **Root cause:** `web/src/app/dados/csv/[uf]/route.ts:22` uses `Math.round(shortfall(r)) || 0`, and `shortfall()` returns 0 for both "no shortfall" and "unknown".
- **Fix:** Emit `""` when `r.mde == null || (r.mde < 25 && r.base == null)`. Keep the two exports' semantics identical.

### FUN-10 · minor · Data export · The two CSV exports disagree on columns and vocabulary
- `/dados/csv/*` has 19 columns with `situacao` = `declarou`/`nao_declarou`. The Explorer export has 11 columns with `situacao` = `abaixo do mínimo`/`no limite`/`cumpriu`/…, and has no `regiao` or `regiao_imediata`.
- Not wrong, but the same column name has different meanings across the two files.
- **Fix:** Rename one column (e.g. `envio` vs `situacao_mde`) or align the schemas. Document both in `/dados`.

### FUN-11 · polish · Search · UF-name reading creates noise matches
- **Steps:** Type `sao paulo sp`.
- **Actual:** Results include "Espírito Santo do Pinhal" and "Boa Esperança do Sul". The "são paulo" UF reading leaves the query `sp`, which substring-matches e**sp**írito and e**sp**erança.
- **Root cause:** `SearchPalette.tsx:57-75` (`readings`) together with `rankName` rank 3 (substring) for 2-letter leftovers.
- **Fix:** Skip readings whose leftover text is itself a UF sigla, or require word-prefix (rank ≤ 2) for leftovers shorter than 3 characters.

### FUN-12 · polish · Breadcrumbs · The city picker matches IBGE code digits
- **Steps:** On `/sp/santo-andre`, open "Trocar de município" and type `3548`.
- **Actual:** 11 unrelated cities appear (Santo Antônio de Posse, …) with no visible reason.
- **Root cause:** `Breadcrumbs.tsx:163` sets `value={\`${c.name} ${c.id}\`}` to keep values unique, and the custom `filter` searches the whole value.
- **Fix:** Use `keywords={[c.name]}` with a unique `value`, or filter on the name part only.

### FUN-13 · polish · Assets/SEO · No favicon, robots.txt or sitemap
- `/favicon.ico`, `/robots.txt`, `/sitemap.xml` and `/opengraph-image` all return **the HTML 404 page with status 200** (see FUN-01).
- Every page load requests `/favicon.ico` and gets HTML back. With about 5,600 static pages, a sitemap matters.
- **Fix:**
  - Add `app/icon.svg` (the Logo).
  - Add `app/robots.ts` and `app/sitemap.ts`, generated from UFS, REGIONS and `allCities()`.
  - Optionally add `app/opengraph-image.tsx`.

### FUN-14 · polish · Search UX · Pressing Enter right after typing a state name is easy to get wrong
This is a variant of FUN-02 on the default selection: the highlight is always on the first row. After FUN-02 is fixed, also consider showing a "Estado" / "Região" section header *above* the municipalities when one of them matches exactly.

### FUN-15 · polish · Mobile · The header nav clips the last item at 375 px
- **URL:** any page at 375×812
- **Actual:** "Metodologia" is cut to "Meto…" at the right edge, with no fade or scroll affordance (`shots/mobile-home.png`). It is reachable by horizontal scroll.
- **Fix:** Add a right-edge fade mask or `scroll-snap`, or shorten it to "Método". See `web/src/components/kit/nav.tsx` and `app/layout.tsx:56-58`.

### FUN-16 · polish · Copy · "Distribuição do MDE em Bahia"
- The histogram description and aria-label on city pages use `em ${ufName}`, which produces "em Bahia", "em Rio de Janeiro" and "em Amazonas".
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx:320` and the histogram caption.
- **Fix:** Use the existing `ofUf`-style article table to get "na Bahia", "no Rio de Janeiro", "em São Paulo".

### FUN-17 · polish · Breadcrumbs (DF) · The "Distrito Federal" crumb links to the current page
- On `/df/brasilia` the crumbs read Brasil / Centro-Oeste / Distrito Federal / Brasília. "Distrito Federal" is a link to `/df/brasilia` (via `ufPath`), i.e. a self-link that does not carry `aria-current`.
- **Fix:** For DF, render the UF crumb as current, or merge the two crumbs ("Distrito Federal · Brasília").

---

## Things verified OK, worth keeping as regressions
- Year picker keyboard behaviour (Arrow keys, Home, End, roving tabindex), disabled prev/next at the ends, `?ano` validation, and back/forward with `replaceState`.
- Watchlist persistence, legacy SP slugs, corrupt-storage resilience, cross-tab sync, and the "not found" footer.
- Share: clipboard copy, the "Link copiado" state and the WhatsApp link.
- Theme persistence across reload and navigation, with no hydration warnings.
- Explorer facet counts, sort with nulls last, pagination, filtered CSV, and ignoring invalid or conflicting `regiao`/`uf` params.
- No console errors, hydration or key warnings, or failed requests on 140 pages. All 396 sampled internal links return 200.

---

## Round 2: re-validation after ff4a309 (prod :3299 and dev :3210)

**Runs** (logs in `qa/reports/functional/`):

| Check | Prod (:3299, build rebuilt after the ACA-17 proxy fix) | Dev (:3210) |
|---|---|---|
| `crawl.mjs --links all` (140 pages; **all 2,154** internal links; 9 404 probes; 7 case redirects × 2 hits; 9 SEO/data endpoints) | **PASS**, log `r2-crawl-3299.log` | **PASS**, log `r2-crawl-3210.log` |
| `interact.mjs` (272 checks) | **267/272** | 266/272 |
| `csvcheck.mjs` (11 CSV ids) | **PASS** | **PASS** |

On prod, all 5 interact failures are open issues: FUN-03 (counted twice), FUN-19, FUN-20 and FUN-21. Dev has the same 5 plus the dev-only console errors in FUN-25. A later re-run of `r2explorer` added an `ordem` check, which passes.

**Script changes:**

`crawl.mjs`:
- `--base` writes `crawl-results-<port>.json`.
- The case variants `/SP`, `/Rj`, `/regiao/Sul`, `/Sp/santo-andre`, `/sp/Santo-Andre` and `/SP/santo-andre` now expect a **308 with exactly one Location** to the lowercase URL, on both the first and the second hit. Previously they were expected to return 404.
- New 404 probes: `/regiao`, `/dados/csv/regiao-foo`, `/<uf>/<slug>/ano/1999`, an unknown city's `/ano/2019`.
- New asset probes: robots, sitemap, manifest, icon, OG images, `/data/indice.json`, `/acompanhar/dados`, `/ano/2019`.

`interact.mjs`:
- The palette is now lazy-loaded, so the tests wait for the dialog (up to 3 s) instead of a fixed 300 ms.
- Mobile nav labels are now Salvos/Método.
- Pagination checks were replaced by virtualisation checks: under 120 DOM rows, `aria-rowcount`, scrolling to the end reaches "Zortéa", and the middle of the list is not blank.
- The Explorer CSV is now taken from the "Série … CSV padrão" menu item. It is checked for the slice filename, the shared header, and equality with `/dados/csv/rr` on the shared columns.
- 404 tests: the case variants now expect a redirect, not a 404, and the canonical pages must still return 200 afterwards.
- Console 404s for intentional 404 visits are ignored.
- New groups: `r2city`, `r2watch`, `r2search`, `r2explorer`, `r2uf`.

`csvcheck.mjs`:
- Rewritten for the CONTRACT §6 schema: `envio` and `situacao_mde` vocabulary, no `situacao` column, empty `faltou_rs` when the shortfall is unknown.
- Excel variants are parsed with `;` and decimal commas; region and `estados` files are included.
- BOM detection now reads raw bytes, because `fetch().text()` strips the BOM.

### Status of round-1 findings

| ID | Status | Evidence |
|---|---|---|
| FUN-01 soft 404 | **FIXED** | Prod and dev, first hit: `/xx`, `/regiao`, `/sp/nao-existe`, `/regiao/foo`, `/sp/santo-andre/extra` return **404** with title "Página não encontrada · Radar MDE". Case variants return a single 308 with the query string preserved (`/SP/Santo-Andre?ano=2019` → `/sp/santo-andre?ano=2019`), and the canonical pages stay 200 afterwards (the FUN-18 check). |
| FUN-02 search ranks cities over states | **FIXED** | Top hits are now the territory for bahia, acre, para, parana, norte, sul, brasil, mato grosso and ceara; Enter on "bahia" opens `/ba`. Typo tolerance works ("campinsa" → Campinas), and so does UF parsing ("bom jesus go", "santo andre pb"). |
| FUN-03 Boa Esperança do Norte | **PARTIAL** | Fixed: no "não declarou" for 2008–2024 ("Não existia em 2015/2024"); the letter says "Não há registro de envio…"; `/acompanhar` shows one n/d; CSVs carry only the 2025 row. **Still open:** `web/public/geo/uf/MT.topo.json` has 141 geometries and no 5101837, so the municipality is never highlighted on its map (`city(no data)` and `r2 city(Boa Esperança)` checks). |
| FUN-04 city page ignores `?ano` | **FIXED** | `/sp/santo-andre?ano=2019` shows "Em 2019…" and the picker shows 2019. Values come from `/sp/santo-andre/ano/2019` (200). Clicking 2015 updates the URL, the change survives reload, and the default year removes `?ano`. Share copies `…?ano=2015`. Neighbour and breadcrumb links carry `?ano`. |
| FUN-05 punctuation-insensitive filters | **FIXED** | Explorer (`?q=embu guacu` → 1), UF table and breadcrumb picker all match "santa barbara d oeste" and the curly apostrophe. |
| FUN-06 map clicks drop `?ano` | **FIXED** | `/?ano=2015` → map click → `/am?ano=2015`. The Explorer still drops it: see FUN-19. |
| FUN-07 Explorer URL state | **FIXED** | `q`, `regiao`, `uf`, `porte`, `situacao`, `reinc`, `capital`, `ordem` and `ano` are all written to the URL and restored on reload (deep link → 37 rows, same after reload). Invalid values are ignored. The UF table also persists `q` and `ordem` (GOV-06). |
| FUN-08 region CSV = whole country | **FIXED** | `/regiao/sul` links to `/dados/csv/regiao-sul` (21,423 rows = 1,191 municipalities). |
| FUN-09 `faltou_rs=0` when unknown | **FIXED** | 0 such rows in all 11 files. Barra do Choça 2021 now has an empty value. |
| FUN-10 two CSV schemas | **FIXED** | Shared vocabulary. The Explorer series CSV for RR matches `/dados/csv/rr` cell-for-cell on the 15 shared columns (0 diffs). |
| FUN-11 "sao paulo sp" noise | **FIXED** | No Pinhal / Esperança do Sul results. |
| FUN-12 picker matches IBGE digits | **FIXED** | "3548" → 0 options. |
| FUN-13 no favicon/robots/sitemap | **FIXED** | `/favicon.ico` → 307 to `/icon.svg`; `robots.txt`, `sitemap.xml` (5,605 URLs, no redirecting URLs), `manifest.webmanifest`, `apple-icon` and OG images all return 200. See FUN-22 for the URL host they contain. |
| FUN-14 Enter after typing a state | **FIXED** | Covered by FUN-02. |
| FUN-15 mobile nav clipped | **FIXED** | Labels are now Painel / Explorar / Salvos / Dados / Método and all fit at 375 px (`shots/r2-mobile-header.png`). |
| FUN-16 "em Bahia" | **FIXED** | Now "Distribuição do MDE na Bahia". |
| FUN-17 DF crumb self-link | **FIXED** | On `/df/brasilia` the crumb links are only `/` and `/regiao/centro-oeste`. |

Also verified with no regressions found:
- Watchlist now loads `/acompanhar/dados?m=…&v=…` instead of `/data/municipios.json`.
- `/data/*.json` and `/dados/csv/*` are br/gzip-compressed with an `ETag`. `If-None-Match` returns **304**, and `?v=<version>` responses are `immutable`.
- Explorer virtualisation renders 21 DOM rows for 5,570 and scrolls to the end.
- Glossary popover opens and closes with Esc.
- Print media hides the header and every action button.
- The year endpoint returns 404 for unknown years or cities.
- Lazy palette: ⌘K, Ctrl+K, `/`, and corrupt recents all work. The first open takes about 340 ms while the chunk loads. A shortcut pressed *before hydration* is ignored, which was also true in round 1.

### New findings (round 2)

### FUN-18 · blocker → **FIXED during the round** · Caching · One uppercase URL poisoned the canonical page in production
- **URL:** first build on :3299
- **What happened:** a single `GET /Ap/oiapoque` was served STALE from the shared prerender entry and triggered a background revalidation with the uppercase params. The page's `permanentRedirect()` result was then stored for `/ap/oiapoque`.
- **Effect:** every later visitor of the lowercase page got **308 with no Location** (`s-maxage=31536000`) and saw "Página não encontrada". Reproduced on `/ro/cacoal`, `/rj`, `/mg` and `/sp/santo-andre`. First hits also sent duplicated `Location` headers.
- **Fix that landed:** `web/src/proxy.ts` lowercases the path before routing, and the page-level redirects were removed.
- **Re-verification on the rebuilt :3299:** `/Ap/oiapoque`, `/ro/Cacoal`, `/Rj`, `/Mg`, `/SP`, `/Sp/santo-andre`, `/regiao/Sul` and `/XX` each return a single 308 with one Location on repeated hits. Every canonical page still returns 200 with x-nextjs-cache HIT afterwards. This is now a permanent check in `crawl.mjs` and in `interact.mjs` (`notfound`).

### FUN-19 · minor · URL state · Explorer city links drop `?ano`
- **URL:** `/explorar?ano=2019` → first row links to `/pa/aurora-do-para`
- **Expected:** `…?ano=2019`, like the UF table, maps, neighbours and breadcrumbs. TRIAGE asks that every drill link keep the year.
- **Root cause:** `web/src/components/Explorer.tsx:820` uses `href={cityPath(r.uf, r.slug)}`.
- **Fix:** Use `withYear(cityPath(r.uf, r.slug), year, initialYear)`.

### FUN-20 · minor · Action kit · Edits to a letter are lost when switching template tabs
- **URL:** `/sp/santo-andre`
- **Steps:** Edit the first letter (e.g. replace "[Seu nome]"), click another tab, then come back.
- **Expected:** The text keeps your edits.
- **Actual:** The edits are lost. The original text returns silently and "Desfazer edições" disappears. Edits *do* survive a year switch.
- **Root cause:** `web/src/components/ActionKit.tsx` keeps the text in `Letter`'s local `useState(t.body)`, and Base UI `TabsContent` unmounts inactive panels.
- **Fix:** Add `keepMounted` on `TabsContent`, or lift the per-template text into `ActionKit` state, keyed by `t.id`.

### FUN-21 · minor · Action kit · The "E-mail" button builds a ~4,000-character `mailto:` URL
- **URL:** `/sp/santo-andre`, first template: the href is 3,979 chars.
- **Problem:** Outlook and Windows mail handlers and several webmail handlers cap `mailto:` URLs at about 2,000 characters. The body arrives truncated, or the link does nothing.
- **Root cause:** `ActionKit.tsx:64` URL-encodes the whole body.
- **Fix:** Copy the text to the clipboard on click and open `mailto:?subject=…&body=<short note: "cole o texto copiado aqui">`. Alternatively, only fall back to the full body when it is under about 1,800 chars.

### FUN-22 · minor · SEO/config · The production build advertises `http://localhost:3210` in every absolute URL
- **URL:** :3299 `/robots.txt` (`Host: http://localhost:3210`, `Sitemap: http://localhost:3210/sitemap.xml`), all 5,605 sitemap `<loc>` entries, and `og:image` (`http://localhost:3210/opengraph-image?…`).
- **Root cause:** `web/src/lib/site.ts:2` silently falls back to `http://localhost:3210` when `NEXT_PUBLIC_SITE_URL` is unset at build time. A deploy that forgets the env var ships a broken sitemap and broken OG cards.
- **Fix:**
  - In production, fall back to `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL`, or throw at build time when it is unset.
  - Drop the non-standard `Host:` line, which expects a bare host anyway.
  - Reconsider `Disallow: /data/`: crawlers that render JS can't fetch the data the maps and tables load client-side.

### FUN-23 · polish · Routing · `/dados/csv/SP` now 404s (it returned 200 in round 1)
- The proxy matcher excludes `dados/csv/`, and the route only accepts lowercase ids. `/Dados/CSV/sp` is redirected, but `/dados/csv/SP` is not.
- **Fix:** Lowercase the id in `app/dados/csv/[uf]/route.ts`, or let the proxy handle `dados/csv/` paths (only `geo/` needs to be excluded).

### FUN-24 · polish · Endpoints · Loose validation on new per-city routes
- `/sp/nao-existe/opengraph-image` returns **200** with a generic "Município / Sem dados declarados" card (`shots/r2-og-nao-existe.png`); it should return 404.
- `/sp/santo-andre/ano/02019` and `/ano/2019.0` are accepted as aliases of `/ano/2019`, creating duplicate cache entries. Accept only `^\d{4}$`.
- `/acompanhar/dados` issues an extra request for unknown ids alone (`?m=xx/nope`) after the main fetch. Skip ids that already came back missing.
- **Root cause:** `web/src/app/[uf]/[slug]/opengraph-image.tsx` and `web/src/app/[uf]/[slug]/ano/[ano]/route.ts`. For the extra request, the watchlist fetch logic in `Watchlist.tsx`.

### FUN-25 · polish (dev only) · Console · Errors on the 404 page and after client navigations in `next dev`
- On `/xx`: "Encountered a script tag while rendering React component…" (the next-themes inline script re-rendered by the not-found boundary).
- Once during the mobile run: "Failed to execute 'measure' on 'Performance': 'Page [Prerender]' cannot have a negative time stamp".
- Neither appears on the prod build.
- **Fix:** For the first, pass `scriptProps={{ type: "application/json" }}`-style mitigation, or upgrade next-themes. The second is a Next dev-overlay issue; track it upstream.
