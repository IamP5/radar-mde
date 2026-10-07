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
