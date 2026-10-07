# QA report: Data journalist persona (journalist)

Tester: QA agent playing a data reporter at a national outlet on deadline.
App: Radar MDE · Brasil, dev server http://localhost:3210 (2026-10-07). Desktop 1440x900, headless Chromium (Playwright).
Evidence folder: `/Users/tuba/Dev/projects/radar-mde/qa/reports/journalist/` (scripts `s1–s7.mjs`, screenshots, page-text dumps, downloaded CSVs).
Console errors: none across all visited routes (`/`, `/regiao/*`, `/sp`, `/mg`, `/rs`, `/sp/sao-paulo`, `/rs/porto-alegre`, `/explorar`, `/dados`, `/sobre`).

---

## 1. Journey narrative

**Story 1: "How many cities broke the 25% rule, and how much money is missing?"** This worked well. The home headline sentence ("Em 2025, 23 municípios… R$ 150,1 mi deixaram de ir para o ensino. A maior proporção está em Acre (18%)") is almost quote-ready. I recomputed every headline figure from `web/src/data/cities.json` for all 18 years: count below 25%, national median, R$ shortfall, population below, state and region shortfalls (SP 2021 = R$ 573 mi, Sul 2021 = R$ 793,9 mi) and the top accumulated deficits (Porto Alegre R$ 674 mi, Aracaju R$ 460,5 mi, Volta Redonda R$ 448,7 mi). **All of them reproduce exactly.** The hard part is the caveats. Nothing says the R$ figures are nominal. Population is a single recent figure applied to every year. The "Deixou de ir para a educação" wording oversells what is a declared-data estimate.

**Story 2: "The pandemic dip."** It is clear on the home and state pages. The trend chart has a "pandemia" band, and 2020–2021 show an EC 119/2022 warning. 2021: 1.090 municípios (20%), R$ 4,3 bi+, median 25,79%. The Explorer, which is where I would actually build the list, shows 2021 without the EC 119 caveat.

**Story 3: "Which capitals / big cities are worst?"** Explorer with population "Mais de 500 mil" + "Abaixo de 25%" + sort by "Faltou" gave a perfect list for 2021 (Porto Alegre, Cuiabá, Joinville, Contagem, Teresina…). There is **no capital filter**, though `capital` exists in the data, and ⌘K "capitais" returns nothing. I had to use Python to find the capitals below 25% (2020: Belém, Teresina, João Pessoa, BH, Porto Alegre; 2021: + Fortaleza, Aracaju, Cuiabá; 2024: Cuiabá).

**Story 4: "Biggest drops year over year."** Not possible in the UI. There is no Δ column or sort. Python: 2024→2025 Araricá (RS) −24,9 p.p., Piaçabuçu (AL) −19,5 p.p., Magalhães Barata (PA) −17 p.p.

**Story 5: "Get a permalink / chart for the article."** This mostly failed:
- Explorer filters and sort are lost on reload or share. Only `?ano`, `?regiao` and `?uf` persist.
- Map drill-down and the state ranking table drop `?ano`.
- City pages ignore `?ano` completely.
- There is no chart PNG/SVG export, no embed code and no "copy number with source" control. The only share button is on city pages, and it shares a URL without the year.

**Story 6: "Download and open the CSV."** UTF-8 with BOM, accents fine, comma-separated, decimal point. That works for Python, R and Google Sheets. In Excel pt-BR it opens in a single column. The Explorer CSV and the `/dados` CSV use different schemas, and the Explorer export ignores the on-screen sort.

**Story 7: "Is the ranking fair?"** The headline singles out Acre (18%) = 4 of 22 municipalities, which is small-n noise. Implausible filings (e.g. Cantá/RR 2,28% in 2021, Jutaí/AM 2,41% in 2008; 27 municipality-years below 10% or above 60%) are counted in national totals and top the Explorer sort with no "atypical" flag. City pages do flag these values (`isAtypical`).

**Bonus stories surfaced:** state governments themselves below 25%:
- RS state 20,66% in 2025, 18,73% in 2023
- RJ 23,23% in 2021
- ES 19,64% in 2020

The MG state government is missing for 9 of 18 years ("—") with no explanation.

---

## 2. Findings

### JOR-01: City page ignores `?ano=`; the "year follows navigation" promise breaks at the last level
- **Severity:** major. **Type:** bug
- **URL:** http://localhost:3210/rs/porto-alegre?ano=2021
- **Steps:**
  1. Open `/rs?ano=2021`.
  2. Click a municipality in the table or map (link carries `?ano=2021`). Or open the URL above directly.
- **Expected:** KPIs, verdict and ranking for 2021, as /sobre says: "O ano escolhido acompanha a navegação (parâmetro ?ano=…) para comparar o mesmo exercício em todos os níveis".
- **Actual:** the page shows "MDE 2025 · 25,69%" and "Em 2025, aplicou 25,69% — cumpriu, mas no limite." Porto Alegre's 2021 figure (21,02%, R$ 175,6 mi short) is only visible in the year table. Reproduced 2/2 (`s6.mjs`, `city-poa-ano2021.png`).
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx` always uses `latestYear(c)` (lines 59, 88) and has no `useYear`/YearPicker.
- **Fix:** Add a client year context to the city page (reuse `useYear` and `YearPicker`). Drive the KPI cards, verdict, rank and neighbours off the selected year, defaulting to latest. At minimum, show a banner when `?ano` differs: "Você veio de 2021 — ver 2021".

### JOR-02: Map drill-down and state ranking links drop the selected year
- **Severity:** major. **Type:** bug
- **URL:** http://localhost:3210/?ano=2021
- **Steps:**
  1. Open `/?ano=2021`.
  2. Hover São Paulo on the map (tooltip "118 de 645 · Faltou R$ 573 mi") and click it.
- **Expected:** `/sp?ano=2021`.
- **Actual:** navigates to `/sp`, which shows 2025. The ranking table link is `/rr` (no `ano`). The "Todos os estados" small multiples do keep `?ano`, so behaviour is inconsistent. Reproduced 2/2 (`s5.mjs`, `s4.mjs`).
- **Root cause:**
  - `web/src/components/territory/TerritoryMap.tsx`: `href` returns `ufPath(u.uf)` / `cityPath(...)` without `withYear`.
  - `web/src/components/territory/UfTable.tsx:104`: `<Link href={ufPath(u.uf)}>`.
  - Deficit lists (`TerritoryDashboard.tsx`, `UfDashboard.tsx:312`) also use bare `cityPath`.
- **Fix:** Pass `year` and `initialYear` into TerritoryMap and UfTable and wrap the links with `withYear(...)`, as UfMultiples already does.

### JOR-03: Explorer view is not shareable; filters and sort are lost on reload or share
- **Severity:** major. **Type:** UX
- **URL:** http://localhost:3210/explorar?ano=2021
- **Steps:**
  1. Set Situação = Abaixo de 25%, População = Mais de 500 mil, sort by "Faltou".
  2. Copy the URL and reload.
- **Expected:** the same 16-row view (a permalink to cite in an article).
- **Actual:** the URL stays `/explorar?ano=2021`, and the reload shows all 5.570 rows, sorted by MDE ascending. Reproduced 2/2 (`s3.mjs`).
- **Root cause:** `web/src/components/Explorer.tsx` `syncUrl()` only writes `regiao` and `uf`. `q`, `porte`, `sit`, `reinc` and `sort` live only in React state.
- **Fix:** Serialize all filter state, e.g. `?ano=2021&porte=p5&situacao=below&reinc=1&ordem=-short&q=…`. Read it in the existing mount effect. Add a "Copiar link desta visão" button.

### JOR-04: No way to export a chart image, embed, or copy a figure with its source and date
- **Severity:** major. **Type:** UX (feature gap)
- **URL:** `/`, `/regiao/*`, `/[uf]`, `/[uf]/[slug]`
- **Steps:** look for a download PNG/SVG, embed `<iframe>` or "copiar com fonte" action on any chart or KPI.
- **Expected:** a newsroom can drop a chart into an article or copy a sentence like "23 municípios ficaram abaixo de 25% em 2025 (Radar MDE, dados SIOPE/FNDE, atualizado em 07/10/2026)".
- **Actual:** none exists. The only share control (`ShareButton`) is on city pages and copies `http://localhost:3210/rs/porto-alegre` (no year). The "atualizado em" date appears only on `/dados`. There are no OG/Twitter images (`generateMetadata` has title and description only).
- **Root cause:** not implemented. See `web/src/components/ShareButton.tsx` and `web/src/app/*/page.tsx` metadata.
- **Fix:**
  - (a) Add a "⋯" menu on each Panel: "Baixar PNG" (serialize the SVG and draw it to a canvas; Recharts outputs SVG), "Baixar dados deste gráfico (CSV)", and "Copiar citação", which builds a text with value + year + scope + source + update date + permalink.
  - (b) Add `/embed/...` routes that render a single chart chrome-less.
  - (c) Add `opengraph-image.tsx` per route.
  - (d) Show "Dados atualizados em dd/mm/aaaa" in the footer or page header.

### JOR-05: R$ figures are not labelled as nominal, and accumulated deficits add up 17 years of unadjusted reais
- **Severity:** major. **Type:** content/data
- **URL:** `/` (KPI "Deixou de ir para a educação", panel "Maiores déficits acumulados", series "R$ que faltou"), `/[uf]`, city "Saldo devedor"
- **Steps:** read the KPI sub-labels and the methodology.
- **Expected:** a clear "R$ correntes de {ano}, sem correção pela inflação". For multi-year sums, either deflate to today's reais (IPCA) or say they are nominal sums.
- **Actual:**
  - Only "R$ por aluno" is labelled nominal (`UfDashboard.tsx:223`, city page panel, `bins.ts`).
  - "Saldo devedor"/"Maiores déficits acumulados" mixes R$ of 2008 with R$ of 2025. São Paulo's 2008 shortfall of R$ 556,5 mi is "compensated" by later nominal surpluses.
  - The KPI delta "61% a menos que em 2024" compares nominal amounts.
  - /sobre never mentions inflation.
- **Root cause:** `web/src/lib/data.ts` `deficitTrail`/`topDeficits`; labels in `TerritoryDashboard.tsx`, `UfDashboard.tsx`; `/sobre` "Cálculos".
- **Fix:** Add "(valores nominais)" to every R$ sub-label and a sentence in /sobre. Better: build an IPCA index in `scripts/` and offer "R$ de 2025 (IPCA)" for the deficit trail and series. Add an `ipca_fator` column to the CSV.

### JOR-06: "Deixou de ir para a educação" overstates what the number is
- **Severity:** major. **Type:** content
- **URL:** http://localhost:3210/ (2nd KPI and headline sentence "R$ 150,1 mi deixaram de ir para o ensino")
- **Expected:** a reporter can say exactly what it is: "Estimativa de quanto faltou aplicar para atingir 25%: (25% − % declarado) × receita de impostos, somada nos municípios abaixo do mínimo. Valores declarados, não apurados pelos TCs."
- **Actual:**
  - The sub-label "soma do que faltou para chegar a 25%" has no year, no "estimativa", no "declarado", no "nominal" and no link to the method.
  - The base for 2008–2019 is reconstructed (per /sobre), so the earlier years are estimates on top of estimates.
  - The phrase "deixaram de ir" reads like money was diverted. It also counts implausible filings (see JOR-08): Cantá/RR 2,28% adds R$ 6,5 mi in 2021.
- **Root cause:** `web/src/components/territory/TerritoryDashboard.tsx` (Stat "Deixou de ir para a educação", headline paragraph); same in `UfDashboard.tsx`.
- **Fix:**
  - Rename to "Faltou aplicar (estimativa)".
  - Use the sub-label "em {ano}, valores declarados e nominais".
  - Add an info tooltip with the formula and a link to `/sobre#calculos`.
  - In the headline, use "faltaram cerca de R$ X mi para atingir o mínimo".

### JOR-07: No capital filter and no year-over-year change; two core newsroom questions can't be answered in-app
- **Severity:** major. **Type:** UX (feature gap)
- **URL:** http://localhost:3210/explorar
- **Steps:** try to list capitals below 25%, or the largest drops between two years.
- **Expected:** a "Capitais" toggle; a "Δ vs ano anterior (p.p.)" column, sortable.
- **Actual:** neither exists. ⌘K "capitais" returns no results. `City.capital` exists in `cities.json` (27 true) but is not in `Row`.
- **Root cause:** `web/src/lib/data.ts` `toRow` omits `capital`; the `Row`/`packRows` transport in `web/src/lib/rows.ts` lacks it; `Explorer.tsx` has no delta column.
- **Fix:**
  - Add `capital` to `Row`/`Packed`.
  - Add a "Capitais" chip in Explorer, next to "Reincidentes".
  - Add a sortable `delta` column (`mde[yi] − mde[yi-1]`) and an optional "comparar com ano X" select.
  - Include `capital` and `delta_pp` in the CSV export.

### JOR-08: Implausible values are counted in totals and lead the Explorer sort unflagged
- **Severity:** minor. **Type:** data
- **URL:** http://localhost:3210/explorar?ano=2021 (default sort MDE ascending)
- **Steps:** open the Explorer for 2021.
- **Expected:** values like 2,28% flagged as "valor atípico — possível erro de preenchimento" (city pages already do this via `isAtypical`), or excluded from medians and shortfall sums with a note.
- **Actual:** the top rows are Cantá RR 2,28%, Alto Alegre RS 3,62% and Santa Brígida BA 6,63%, all with R$ shortfalls added to the national total. 27 municipality-years in the dataset are below 10% or above 60%. RO state `perAluno` 2017 = 41.442 is about 8× its neighbouring years.
- **Root cause:** `web/src/components/Explorer.tsx` (`ExplorerRow`) and `web/src/lib/rows.ts` `aggregate` don't use `isAtypical` (`web/src/lib/format.ts`).
- **Fix:** Show an "atípico" badge in Explorer and the map tooltip. Report "R$ X mi (dos quais R$ Y mi em valores atípicos)". Optionally add a toggle to exclude atypical values from aggregates.

### JOR-09: Small-n states headline the "maior proporção" sentence
- **Severity:** minor. **Type:** content
- **URL:** http://localhost:3210/
- **Actual:** "A maior proporção está em Acre (18%)" is 4 of 22 municipalities. The UF map colours Acre darkest. A reporter could run "Acre is the worst state" off 4 cities.
- **Root cause:** `TerritoryDashboard.tsx` `worstUf` sort by `belowShare` with no minimum n.
- **Fix:** Show counts inline ("Acre (4 de 22, 18%)"), or require ≥ 5 below / ≥ 30 reporting to be named. Add a note in the ranking panel that shares from small states vary a lot from year to year.

### JOR-10: Explorer has no EC 119/2022 pandemic caveat for 2020–2021
- **Severity:** minor. **Type:** content
- **URL:** http://localhost:3210/explorar?ano=2021
- **Actual:** "Abaixo de 25% em 2021: 1.090" and "Faltou R$ 4,3 bi+" with no caveat. Home and state pages do show the warning.
- **Root cause:** `web/src/components/Explorer.tsx`; there is no `PANDEMIC_YEARS` check.
- **Fix:** Reuse the warning block from `TerritoryDashboard.tsx` when `PANDEMIC_YEARS.has(year)`. Also mark 2020/2021 rows in the CSV (`pandemia_ec119=1`).

### JOR-11: CSV opens as one column in Excel pt-BR; Explorer export ignores sort and has a different schema from /dados
- **Severity:** minor. **Type:** UX
- **URL:** `/explorar` → Exportar CSV; `/dados/csv/brasil`
- **Evidence:** `reports/journalist/explorar.csv`, `br.csv`. Both are UTF-8 with BOM, `,` separator and `.` decimal.
- **Problems:**
  - Excel with Brazilian regional settings expects `;` and `,`, so the file opens in one column (or turns 27.53 into 2753).
  - The Explorer CSV row order is the unsorted filter order: Teresina first, while the table showed Porto Alegre first.
  - Explorer columns are `ibge,municipio,uf,regiao_intermediaria,populacao,ano,mde_pct,fundeb_pessoal_pct,por_aluno_rs,faltou_rs,situacao`. /dados has 19 columns, including `regiao`, `receita_impostos_rs`, `mde_aplicado_rs` and `fonte`, and `situacao` means "declarou" there but "abaixo do mínimo" in Explorer.
  - The filename `radar-mde-explorar.csv` doesn't encode the filter or year.
- **Root cause:** `Explorer.tsx` `downloadCsv(rows, …)` passes `rows` (filtered) instead of `sorted`; it has its own header list.
- **Fix:**
  - Export `sorted`.
  - Reuse the /dados column set and add `situacao_mde` (and `capital`, `delta_pp`).
  - Offer "CSV (Excel Brasil, ;)" next to the standard CSV.
  - Name the file `radar-mde_2021_abaixo_500mil.csv`.
  - Add a comment header row, or a sidecar README, with the source and update date.

### JOR-12: "Moram nesses municípios" applies one population figure to all years; source year unstated
- **Severity:** minor. **Type:** data/content
- **URL:** http://localhost:3210/?ano=2008
- **Actual:** `cities.json` has a single `pop` (sum 213.344.166, an IBGE ~2025 estimate). "16,6 mi pessoas" in 2008 uses today's population. /sobre and /dados say only "População (IBGE)".
- **Root cause:** `web/src/lib/rows.ts` `aggregate` uses `r.pop`; the data has no per-year population.
- **Fix:** State "população: estimativa IBGE {ano}" in the KPI sub-label and the dictionary. Ideally add per-year estimates.

### JOR-13: State government MDE missing for MG in 9 of 18 years, with no explanation
- **Severity:** minor. **Type:** data
- **URL:** http://localhost:3210/mg?ano=2021
- **Actual:** "Governo do estado —". `states.json` MG lacks `mde` for 2016–2023 and 2025. RS (2018–19), RO and AP (2010) are also missing.
- **Fix:** Show "não declarado ao SIOPE" or "sem dado" with a reason, and list the gaps on /dados.

### JOR-14: Explorer MDE column header renders as "2021 MDE"
- **Severity:** polish. **Type:** UI
- **URL:** http://localhost:3210/explorar?ano=2021 (`explorar-2021-big-below.png`)
- **Root cause:** `Explorer.tsx` `th()` uses `flex-row-reverse` on the button. The label `<>MDE <span>2021</span></>` is several flex children, so they get reversed.
- **Fix:** Wrap the label in a single `<span>`.

### JOR-15: Inconsistent number formatting and wording across levels
- **Severity:** polish. **Type:** content/UI
- **Problems:**
  - The UF ranking "R$/aluno (mediana)" shows "R$ 18.969,5" / "R$ 14.173,5" (even-n median not rounded, `UfTable.tsx:128`), while the state KPI shows "R$ 18.970".
  - On `/mg?ano=2021`, the sentence says "Na região Sudeste, foram 20%; no Brasil, 20%" and the card context says "Sudeste: 19,6% · Brasil: 19,6%".
  - Deltas read "61 a menos que em 2024" on home vs "−1 vs 2024" on state pages.
  - Grammar: "1 de 640 municípios… aplicaram" should agree with "1 … aplicou". "0 de 497 municípios (0%) aplicaram menos de 25%" should read "Nenhum município…".
  - City meta says "Região imediata: região imediata São Paulo".
  - IBGE label typo in data: `inter` "Juíz de Fora" should be "Juiz de Fora".
  - Deficit list shows the *last* four years followed by "…" ("2021, 2022, 2023, 2025…"), implying more years after 2025. It should be "…, 2021, 2022, 2023, 2025".
- **Fix:** Round with `Math.round`. Use one share formatter for sentence and card. Pluralize. Fix the data label in the build script. Move the ellipsis to the front.

### JOR-16: "Maiores déficits acumulados" doesn't react to the selected year
- **Severity:** polish. **Type:** UX
- **URL:** http://localhost:3210/regiao/sul?ano=2021
- **Actual:** the list shows the balance as of 2025 (including 2022–2025) while everything else on the page is 2021. The description says "desde 2008" but not "até 2025".
- **Fix:** Compute the carry up to the selected year, or label it "saldo em 2025".

---

## 3. Top 5 improvements for the data-journalist persona

1. **Permalinks for every view.** Put every UI state in the URL: Explorer filters and sort, map level and metric, trend tab. Make the year carry across every link (JOR-01/02/03). A reporter must be able to paste "the exact view" into a story.
2. **Newsroom export kit on each panel.** Add "Baixar PNG/SVG", "CSV deste gráfico", "Copiar citação", embed iframe and OG images (JOR-04). Show the "Atualizado em" date site-wide.
3. **Honest money figures.** Label R$ as nominal everywhere and offer IPCA-adjusted totals and deficits. Rename "Deixou de ir para a educação" to "Faltou aplicar (estimativa)" with the formula inline (JOR-05/06/12).
4. **Story-finding tools in Explorer.** Add a capitals filter, a year-over-year Δ column and sort, a "compare year A vs B" option, and an atypical-value flag (JOR-07/08). Put the EC 119 caveat in Explorer and the CSV (JOR-10).
5. **Analyst-grade CSV.** One schema across Explorer and /dados that follows the on-screen sort, plus an Excel-BR (`;`) variant. Include capital, region, delta, pandemic and atypical flags, and source/update metadata (JOR-11).

---

## Fact-check appendix (recomputed from `web/src/data/cities.json`)

| Year | Reported | Below 25% | Median MDE | Shortfall (R$ mi) | Shown in app |
|---|---|---|---|---|---|
| 2008 | 5.506 | 83 | 27,42% | 636,5 (São Paulo city 556,5) | — |
| 2020 | 5.547 | 383 | 26,57% | 1.324,3 | — |
| 2021 | 5.567 | 1.090 | 25,79% | 4.345,5 (+1 without base) | 1.090 · R$ 4,3 bi+ · 25,8% ✓ |
| 2024 | 5.565 | 84 | 27,20% | 383,6 | delta −61% ✓ |
| 2025 | 5.560 | 23 | 27,12% | 150,1 | 23 · R$ 150,1 mi · 27,12% · 732.269 hab ✓ |

Top accumulated deficits ✓ (Porto Alegre 674,0; Aracaju 460,5; Volta Redonda 448,7; Cuiabá 267,1; Canoas 106,7 R$ mi). SP state 2021 R$ 573,0 mi ✓, Sul 2021 R$ 793,9 mi ✓ (= PR 153,4 + RS 446,3 + SC 194,2).

---

## Round 2: re-validation after commit ff4a309 (production build, http://localhost:3299)

Evidence: `qa/reports/journalist/r2/` (scripts `a–g.mjs`, screenshots, page-text dumps, downloaded CSVs, OG PNGs). No console errors on any route tested. Bugs were reproduced at least twice.

### Fact-check (year-specific counts)

I recomputed from `web/src/data/cities.json`, skipping municipalities with `since > year`. All figures match the UI.

| Year | n (existed) | Reported | Below 25% | Median | Shortfall | Of which atypical (`mde`/`base`) | UI |
|---|---|---|---|---|---|---|---|
| 2008 | 5.564 | 5.506 | 83 | 27,42% | R$ 636,5 mi | 13 mun. · R$ 19,4 mi | Explorer card "5.564 · todos os que existiam em 2008" ✓ |
| 2021 | 5.569 | 5.567 | 1.090 | 25,79% | R$ 4,35 bi (+1 without base) | 102 mun. · R$ 1,28 bi | "1.090 · ao menos R$ 4,3 bi · dos quais R$ 1,3 bi de valores atípicos" ✓ |
| 2025 | 5.570 | 5.560 | 23 | 27,12% | R$ 150,1 mi | 6 mun. · R$ 122,0 mi | "23 · R$ 150,1 mi · dos quais R$ 122 mi de valores atípicos" ✓ |

Other checks, all ✓:
- SP 2021: 118/645, R$ 573 mi.
- Sudeste 2021: 326/1.667 = 19,6% (the same as Brasil by coincidence).
- Porto Alegre "Déficit até 2021": R$ 1 bi (recomputed R$ 1.046,7 mi).
- Capitals below 25% in 2021 (Explorer `capital=1&situacao=abaixo`): Cuiabá, Aracaju, Teresina, Porto Alegre, Fortaleza, Belo Horizonte. This matches Python.
- Largest 2024→2025 drops (`ordem=variacao`): Araricá −24,9, Piaçabuçu −19,5, Magalhães Barata −17,0. This matches Python.

### Status of round-1 findings

| ID | Status | Evidence |
|---|---|---|
| JOR-01 city `?ano=` | **FIXED** | `/rs/porto-alegre?ano=2021`: "MDE em 2021 21,02%", verdict for 2021 with the EC 119 note, "Mostrando 2021. Voltar para 2025", year picker, "Déficit até 2021". "Copiar link" copies `…/rs/porto-alegre?ano=2021`. Reproduced 2/2. |
| JOR-02 drill links keep year | **FIXED** (JOR-18 broke this for MG and RJ until the rebuild; now OK) | Map click on SP from `/?ano=2021` → `/sp?ano=2021` (2/2). UF table links `/rr?ano=2021`. Deficit links `/rs/porto-alegre?ano=2021`. |
| JOR-03 Explorer permalink | **FIXED** | Filters and sort → `?ano=2021&situacao=abaixo&porte=p5&ordem=-faltou`. Reloading restores the identical rows (2/2). "Copiar link" button works. Invalid params are dropped. |
| JOR-04 chart image / embed / citation | **PARTIAL** | Added: OG images (site and per city, 1200×630, good quality), footer "Dados extraídos em 07/10/2026 · versão 2026-10-07.586603bb · licença CC BY 4.0", "Versão e como citar" on /sobre, year-aware share link. Still missing: per-chart PNG/SVG download, embed iframe, "copiar citação" for a KPI. |
| JOR-05 nominal R$ | **FIXED** | KPI sub-label "em 2025, valores declarados e nominais", deficit panel "(valores nominais)", city "R$ da época", /sobre "Valores monetários são nominais…". IPCA adjustment is on the roadmap only. |
| JOR-06 KPI wording | **FIXED** | "Faltou aplicar (estimativa)". Info tooltip gives the formula, says "reais da época" and "tribunais de contas podem apurar valores diferentes", and links to the methodology. Headline: "faltaram cerca de R$ 150,1 mi para atingir o mínimo (estimativa)". |
| JOR-07 capitals + YoY | **FIXED** | Explorer has a "Capitais" filter, a "vs 2020" Δ column (sortable, `ordem=variacao`), and `capital` / `delta_mde_pp` in the CSV. |
| JOR-08 atypical flags | **FIXED** (the rule itself is a problem; see JOR-17) | Explorer rows show "(valor atípico, possível erro de declaração)". Totals show "dos quais R$ X de valores atípicos". CSV has an `atipico` column. |
| JOR-09 small-n headline | **FIXED** | "A maior proporção está em Tocantins (4 de 139, 2,9%, entre estados com 30 ou mais municípios)". 2021: "Mato Grosso (66 de 141, 47%…); o maior número, em Minas Gerais (177)". |
| JOR-10 EC 119 in Explorer | **FIXED** | 2020/2021 show "2021 foi ano de pandemia. A Emenda Constitucional 119/2022 livrou de punição…". CSV has a `pandemia_ec119` column. |
| JOR-11 CSV | **FIXED** | One schema shared by Explorer and /dados (`envio`, `situacao_mde`, `capital`, `delta_mde_pp`, `pandemia_ec119`, `atipico`…). Export follows the table order (Porto Alegre first). Menu offers "Só 2021" or "Série" × "CSV padrão" or "Excel Brasil" (`;` separator, decimal comma, BOM). Descriptive file names, e.g. `radar-mde_2008-2025_abaixo_Mais-de-500-mil_excel.csv`. New `/dados/csv/regiao-sul`, `estados` and `*-excel` routes return 200; an unknown id returns 404. |
| JOR-12 population year | **FIXED** | /sobre: "uma única estimativa… (exercício 2026)… usada em todos os anos. Totais… em anos antigos usam a população de hoje." The KPI card itself has no population year (acceptable). |
| JOR-13 MG state-gov gaps | **FIXED** | Card: "— · sem dado do governo estadual neste ano". /sobre lists the MG, RO, AP and RS gaps. |
| JOR-14 "2021 MDE" header | **FIXED** | Header now reads "MDE em 2021", followed by "vs 2020". |
| JOR-15 formatting / wording | **PARTIAL** | Fixed: R$/aluno rounded (R$ 14.174), "aplicou"/"nenhum dos 497…", "Região imediata de Porto Alegre", "Juiz de Fora" (0 occurrences of "Juíz" in the CSV), leading ellipsis ("…, 2017, 2018…"), sentence and card rounding agree (19,6%). Remaining: delta wording still differs between levels. Home says "61 · vs 2024 (a menos que no ano anterior)"; state pages say "−1 vs 2024". |
| JOR-16 deficit panel vs year | **FIXED** | Labelled "Maiores déficits acumulados até 2025… Não muda com o ano escolhido". The city page shows "Déficit até {ano}". |

**Totals:** 14 FIXED, 2 PARTIAL (JOR-04, JOR-15), 0 NOT FIXED, 0 REGRESSED. JOR-08 is fixed as reported, but its rule has a new problem (JOR-17). There was one new production-only defect affecting year links, JOR-18. It is now fixed by the rebuild.

### New findings (round 2)

#### JOR-17: Fixed "MDE < 18% = possível erro de declaração" rule casts doubt on genuine, recurring under-spending, including most of the headline money
- **Severity:** major. **Type:** data/content
- **URLs:**
  - http://localhost:3299/ (KPI "dos quais R$ 122 mi de valores atípicos")
  - `/explorar?ano=2021&situacao=abaixo&porte=p5&ordem=-faltou`
  - `/rs/porto-alegre` (action-kit LAI letter)
- **Evidence:**
  - In 2025, R$ 122,0 mi of the R$ 150,1 mi headline (81%) is labelled "atípico". Almost all of it is Volta Redonda: 16,63%, flag `mde`. Its own series is 16,30 / 12,88 / 12,39 / 13,78 / 25,17 / 16,63 for 2020–2025. That is a persistent pattern, not a typo, and it is #3 in the national accumulated-deficit ranking.
  - In 2021, R$ 1,28 bi of R$ 4,35 bi is flagged. Cuiabá 16,24%, Joinville 16,85%, Contagem 16,59%, Campos 16,05% and Chapecó 15,31% all show "(valor atípico, possível erro de declaração)". Large cities going below 18% during the pandemic was a real, reported phenomenon.
  - The Porto Alegre LAI template asks the city to confirm "o percentual… de 2019 e 2020 (17,20%; 15,28%)… pode conter erro de preenchimento" and adds "esse número depende de valores declarados atípicos e deve ser confirmado".
- **Why it matters:** a reporter reading "dos quais R$ 122 mi de valores atípicos" will discount most of the story, and the city gets a ready-made "it was a filing error" defence. The rule is a fixed band (<18% or >45%) and doesn't consider the municipality's own history or the pandemic.
- **Root cause:**
  - `scripts/build_data.py` atypical rule (`atip: "mde"` when MDE < 18 or > 45).
  - The label `ATIP_LABEL` in `web/src/lib/rows.ts`.
  - The KPI note in `TerritoryDashboard.tsx` / `UfDashboard.tsx`.
  - Template wording in `web/src/lib/templates.ts`.
- **Fix:**
  - (a) Keep "possível erro" for clear outliers only: MDE < 10% or > 60%, a value inconsistent with `mdeV/base`, or a one-year spike against the city's own ±2-year median, as is already done for `aluno`/`base`.
  - (b) For 10–18%, use a neutral label: "muito abaixo do mínimo — confirme na fonte".
  - (c) Drop "dos quais R$ X de valores atípicos" from headline KPIs, or count only `base` flags (the money is doubtful only when the base is).
  - (d) In templates, ask for confirmation without suggesting a filing error when the value repeats across years.

#### JOR-18: Production: `/mg` and `/rj` return a cached 308 with no `Location`; `?ano=` and every filter param are stripped
- **Status update:** **FIXED by the coordinator's rebuild of :3299.** Re-test, 2/2: `/mg?ano=2021` and `/rj?ano=2021` return 200 and the browser shows 2021/2020/2024 correctly. `/MG` → `308 location: /mg`, and `/mg` stays 200 afterwards (no re-poisoning). Original report kept below for the record.
- **Severity (when found):** major. **Type:** bug (production only; the dev server on :3210 is fine)
- **URL:** http://localhost:3299/mg?ano=2021, http://localhost:3299/rj?ano=2021
- **Steps:**
  1. Run `curl -sI "http://localhost:3299/mg?ano=2021"`. Response: `HTTP/1.1 308 Permanent Redirect`, `x-nextjs-cache: HIT`, no `location` header, body `<html id="__next_error__">`.
  2. In a browser, the client router lands on `/mg` (query dropped) and shows 2025.
- **Expected vs actual:** expected 200 and 2021. Actual: the year is lost for all ?ano values tried (2020, 2021, 2024), reproduced 4/4. The 25 other UFs return 200 (`/ba?ano=2021` and `/sp?ano=2020` work). `/MG` returns the same Location-less cached 308. `/SP` correctly returns `308 location: /sp`.
- **Consequences:**
  - Every year link into Minas Gerais and Rio de Janeiro (the two states with the most municipalities below 25% in 2021) from the map, ranking and Explorer opens on 2025.
  - Crawlers see a 308 without a target for two state pages.
- **Suspected root cause:** the uppercase canonicalisation `permanentRedirect()` inside the statically generated `web/src/app/[uf]/page.tsx`. A request for `/MG` or `/RJ`, probably from another QA agent, was rendered as a redirect and stored in the ISR/full-route cache under the same key as `/mg`. The cache key is case-insensitive here, likely because of macOS filesystem or cache-path normalisation. Build artefacts `.next-prod/server/app/mg.html` are fine (200), so the poisoning happened at runtime.
- **Fix:**
  - Move case normalisation out of the cached page into `next.config.ts` `redirects()` or middleware, which runs before the cache.
  - Or set `dynamicParams = false`, so `/MG` is a 404 or is redirected at the edge.
  - Add a regression check: `curl -I /MG` then `curl -I /mg` must return 200.
  - I did not request other uppercase UFs, to avoid poisoning more pages on the shared server.

#### JOR-19: Shared year links preview the latest year
- **Severity:** minor. **Type:** UX/SEO
- **URL:** `/rs/porto-alegre?ano=2021`
- **Actual:** the share link correctly carries `?ano=2021`, but `og:description` reads "Em 2025, aplicou 25,69%… cumpriu, mas no limite". The OG image headline is "25,69% · No limite em 2025". A post about Porto Alegre's 2021 shortfall (21,02%, R$ 175,6 mi) unfurls with a "cumpriu" card. The bar chart in the image does show the red 2018–2021 bars.
- **Root cause:** `web/src/app/[uf]/[slug]/opengraph-image.tsx` and `generateMetadata` are static per city.
- **Fix:** Use year-specific share paths, e.g. `/rs/porto-alegre/2021` (statically generable) with their own metadata and OG image. Or make the OG image route accept `?ano` and have ShareButton point to an `/s/...` URL with year-aware metadata.

#### JOR-20: Absolute URLs default to `http://localhost:3210` in the production build
- **Severity:** minor. **Type:** bug/config
- **URL:** http://localhost:3299/sitemap.xml, `/robots.txt`, `og:url`/`og:image` meta
- **Actual:**
  - All 5.605 `<loc>` entries, the sitemap line in robots.txt and the OG URLs point to `http://localhost:3210` while served from :3299.
  - robots.txt has `Host: http://localhost:3210`. `Host` is non-standard and should be a bare hostname.
- **Root cause:** `web/src/lib/site.ts` falls back to `http://localhost:3210` when `NEXT_PUBLIC_SITE_URL` is unset.
- **Fix:** Fail the production build when `NEXT_PUBLIC_SITE_URL` is missing (or warn loudly), or derive the origin from the request (`headers()`) for robots and sitemap. Drop the `Host:` line.

#### JOR-21: Explorer count line ignores municipalities that didn't exist yet; invalid `?ano` lingers in the URL
- **Severity:** polish. **Type:** UI
- **URL:** `/explorar?ano=2008`, `/explorar?ano=1999`
- **Actual:**
  - In 2008 the summary card says "Municípios 5.564 · todos os que existiam em 2008", but the count line says "5.570 de 5.570 municípios", and the table lists Mojuí dos Campos etc. as "Não existia".
  - `?ano=1999` falls back to 2025 but stays in the address bar (other invalid params are removed).
- **Fix:** Count line "5.564 municípios em 2008 (+6 criados depois)", or hide not-yet-existing rows by default. Remove an invalid `ano` with `replaceState`.

#### JOR-22: Explorer "Faltou aplicar" card lacks the atypical-share line shown on home and state pages
- **Severity:** polish. **Type:** content
- **URL:** `/explorar?ano=2021`
- **Actual:** "R$ 4,3 bi+ · 1 de 1090 sem receita declarada para estimar". Home and state pages add "dos quais R$ 1,3 bi de valores atípicos". The same figure is described differently on different pages. Align these after resolving JOR-17.

### Round-2 recommendations (persona)

1. Keep a regression check for JOR-18 (`curl -I /MG` then `/mg` must return 200), now fixed.
2. Rework the atypical rule (JOR-17) so it flags filing errors, not the newsworthy cases themselves.
3. Finish the newsroom kit (JOR-04): per-chart PNG/CSV download, "copiar citação" (value + year + scope + source + data version + permalink), embed. Add year-specific OG cards (JOR-19).
4. Set `NEXT_PUBLIC_SITE_URL` as a build requirement (JOR-20).
