# QA report: government users (secretaria municipal, TCE auditor, legislative aide / CACS-Fundeb)

Tester persona slug: `government` · Date: 2026-10-07 · Server: http://localhost:3210 (dev) · Headless Chromium via Playwright, 1440×900 desktop and 390×844 mobile.
Evidence folder: `/Users/tuba/Dev/projects/radar-mde/qa/reports/government/`. The scripts there (`s1_secretario.mjs`, `s2_auditor.mjs`, `s3_kit_edge.mjs`, `s4_cacs.mjs`) re-run every check. Raw outputs are in `s*_out.json`.

No console errors or page errors came up on any route tested (`/mg/uberlandia`, `/ba/feira-de-santana`, `/ma`, `/pa`, `/sp`, `/explorar`, `/se/aracaju`, `/rj/cabo-frio`, `/sp/sao-paulo`, `/df/brasilia`, `/mt/boa-esperanca-do-norte`, `/pa/belem`, `/ac/marechal-thaumaturgo`, `/sp/buri`, `/sp/franca`).

## 1. Journey

**(a) Secretária de Educação, Uberlândia (MG) and Feira de Santana (BA).** Both city pages load fast (about 1 s warm). They answer "how do we look" clearly: a status badge ("No limite em 2025"), a verdict line, 4 KPIs with state and national medians, the rank in the UF and in Brazil, neighbours from the same região imediata, the state histogram and a full year-by-year table. I could find the latest year (2025). Three things I could not do:
- **Brief on a specific year.** `?ano=2019` is ignored, and the city page has no year control (GOV-05).
- **Get a clean PDF or print for the mayor.** No print stylesheet; the table is cut off and the header lands mid-page (GOV-07).
- **Export a chart or table for a slide.** There is no chart or table export on the city page; only screenshots work.

Neither page says how final the 2025 figures are or when the data was extracted (GOV-14).

**(b) TCE auditor, MA / SP / PA.**
- What worked: on the UF dashboards I filtered "Abaixo de 25%" for a year (MA 2020 → 6 de 217) and sorted by "Anos < 25%". On `/explorar` I combined UF=SP + 2021 + Abaixo de 25% + Reincidentes (35 municipalities) and exported CSV.
- Shared links don't keep the view: reloading, or opening the "shared" URL, loses the situation and reincidentes filters. The 35-row view reopens as all 645 SP municipalities (GOV-06).
- Recurrence is a fixed rule ("≥2 years below at any time 2008–2025"). MDE-below and Fundeb-below cannot be combined (GOV-10).
- The CSV is comma/dot formatted, which pt-BR Excel does not open as columns (GOV-08). The Explorer export ignores the selected year and has a different schema from `/dados` (GOV-09).
- On PA 2016 the headline says "0 de 119 (0%)" with a green delta, while 25 municipalities filed nothing (GOV-11).

**(c) Legislative aide / CACS-Fundeb council member (kit de ação).**
- What works: the 4 tabs (LAI, CACS, vereador, TCE/MP) are pre-filled with the city name and the right court (TCE-MG, TCM-BA, TCM-SP, TCDF, "deputado distrital" for DF). "Copiar texto" copies exactly the textarea content; I checked this through the clipboard for all 8 templates. Mobile layout is fine.
- Content problems:
  - The text claims compliance for a city with no data (GOV-01).
  - It omits years the city did not report (GOV-02).
  - It ignores the Fundeb violations that the page itself flags (GOV-03). This is the main subject of a CACS-Fundeb council.
  - It states R$ deficits computed from values the page itself calls "atypical / possible filing error", with no EC 119/2022 caveat for 2020–21 (GOV-04).

## 2. Findings

### GOV-01 · major · content: the kit says "declarou ter cumprido" for a municipality that never declared anything
- **URL:** http://localhost:3210/mt/boa-esperanca-do-norte
- **Steps:** Open the page and read the LAI tab (the other tabs use the same `belowTxt`).
- **Expected:** The text says the municipality never sent MDE data to SIOPE/SICONFI (itself a transparency problem) and asks for the reports.
- **Actual:**
  - The text reads: "o Município declarou ter cumprido o mínimo constitucional de 25% nos exercícios informados."
  - It is followed by an empty "Percentuais declarados:" list.
  - The page header right above says "Sem dados · Não declarou 2025".
- **Evidence:** `s3_mt_boa-esperanca-do-norte.png`, `s3_out.json` → `/mt/boa-esperanca-do-norte.templates[0]`. Reproduced twice.
- **Root cause:** `web/src/lib/templates.ts`, `belowTxt` falls into the "complied" branch whenever `below.length === 0`, including when `reported` is empty. `summary` is then `""`.
- **Fix:**
  - Branch on `reported.length === 0` and use dedicated text ("não há registro de envio dos dados de MDE ao SIOPE/SICONFI nos exercícios de …").
  - Only print "Percentuais declarados" when `reported.length > 0`.
  - Optionally hide the "complied" wording unless every year in YEARS was reported.

### GOV-02 · major · content: years with no declaration are silently dropped from every template
- **URL:** http://localhost:3210/rj/cabo-frio (filed nothing in 2020–2025). Other examples: `/sp/embu-guacu`, `/rn/porto-do-mangue` (nd 2025).
- **Steps:** Open the LAI or TCE tab.
- **Expected:** The non-declared years are listed, both as a request item and as a fact ("não enviou os dados de 2020 a 2025"). The page itself has a callout for this: "Anos sem declaração".
- **Actual:** The series stops at 2019 with no word about 6 missing years. A council member would send a letter that misses the most serious problem.
- **Evidence:** `s3_out.json` → `/rj/cabo-frio`. Data check: `cities.json` has `s:"nd"` for 2020–2025.
- **Root cause:** `web/src/lib/templates.ts` builds `reported` from `mde != null` only. `c.years[y].s === "nd"` is never read.
- **Fix:** Compute `notDelivered = YEARS.filter(y => c.years[y]?.s === "nd")`, then:
  - In the series list, show "• 2020: não declarou".
  - Add a request item to LAI, vereador and TCE ("envio dos demonstrativos do SIOPE/RREO dos exercícios …").
  - Add a sentence to the context text.

### GOV-03 · major · content: the CACS-Fundeb and TCE templates ignore Fundeb violations the page flags
- **URLs:** http://localhost:3210/sp/buri and http://localhost:3210/sp/franca
- **Steps:** Compare the "Sinais de alerta" panel with the "Ofício ao CACS-Fundeb" tab.
- **Expected:**
  - The CACS letter (whose mandate is Fundeb) cites the years where the share paid to professionals was below the legal minimum (Franca 2021 and 2022; Buri 2021, 56.35% vs 70%).
  - It also cites the years where unspent Fundeb exceeded 5% / 10% (Franca 2012 and 2021).
  - The TCE letter's item (i) on "art. 212-A" also cites them.
- **Actual:** No template mentions Fundeb percentages at all. A regex for 70%, 60%, "profissionais" and "remunera" finds nothing. Reproduced on both cities.
- **Evidence:** `s4_cacs.mjs` output; `s2_explorar_sp_2021_below_reinc.png` shows Franca at 52.73% and Buri at 56.35%.
- **Root cause:** `web/src/lib/templates.ts` only uses `yearsBelow` (MDE). The Fundeb flags are computed only in `web/src/app/[uf]/[slug]/page.tsx` (`funBelow` and `left`).
- **Fix:**
  - Move the flag computation into a shared helper in `lib/data.ts` or `lib/format.ts` (`fundebFlags(c)`), used by both the page and the templates.
  - Add a "Fundeb" paragraph and agenda item to CACS ("verificação da aplicação mínima de 70% (Lei 14.113/2020, art. 26) em …; saldo não utilizado acima de 10% (art. 25, §3º) em …").
  - Add the same to the TCE and vereador letters.

### GOV-04 · major · content: the kit treats likely filing errors and pandemic years as settled facts
- **URLs:** http://localhost:3210/rj/cabo-frio and http://localhost:3210/mg/uberlandia
- **Cabo Frio:**
  - 2016 is 4.34%. The page marks it "Valor atípico… erro de preenchimento".
  - The LAI letter still states "o valor ainda não compensado soma aproximadamente R$ 57.582.375".
  - That is a precise-looking figure sent to a prefeitura or MP, derived from a value the site itself distrusts.
- **Uberlândia:**
  - The only year below 25% is 2021 (20.29%). EC 119/2022 exempts 2020–21 from liability if the shortfall was compensated by 2023, and the site's own trail shows it was (saldo R$ 0 since 2023).
  - The vereador letter still asks for "medidas adotadas para compensar os valores não aplicados em 2021".
  - It then warns that "seu descumprimento pode ensejar intervenção estadual (art. 35, III)".
  - The page footer mentions EC 119; the templates never do.
- **Expected:**
  - Atypical years are flagged in the letter ("valor declarado atípico, possivelmente erro de preenchimento; solicita-se confirmação"), and deficit totals built on them are excluded or caveated.
  - For 2020–21, the EC 119/2022 rule is cited, and the request is to show the compensation through 2023.
- **Evidence:** `s3_out.json` (Cabo Frio), `s1_out.json` (Uberlândia templates), `s1_mg_uberlandia_full.png`.
- **Root cause:** `web/src/lib/templates.ts` never uses `isAtypical` or `PANDEMIC_YEARS` from `lib/format.ts`.
- **Fix:**
  - Add the EC 119 sentence when `below` intersects `PANDEMIC_YEARS`.
  - Adjust the art. 35 sentence when every below-year is a pandemic year and carry is 0.
  - Mark atypical years in the series with "(valor atípico — confirmar)".
  - Drop the exact R$ to the cent: use `brlShort` or "cerca de R$ 57,6 mi" with "estimativa".

### GOV-05 · major · bug: the city page ignores `?ano=` although UF and region links add it
- **URLs:** http://localhost:3210/mg/uberlandia?ano=2019, http://localhost:3210/ba/feira-de-santana?ano=2019, http://localhost:3210/pa/concordia-do-para?ano=2016
- **Steps:**
  1. On `/pa?ano=2016`, click any municipality in "Todos os municípios". The link is `/pa/concordia-do-para?ano=2016`.
  2. Read the KPIs.
- **Expected:** 2016 KPIs, rank, neighbours and map, or at least a notice that the page shows the latest year.
- **Actual:** It always shows "MDE 2025". Reproduced 3 times (Uberlândia, Feira, Concórdia).
- **Evidence:** `s1_out.json` (`withAno`), `s2_out.json` (`pa_firstHref`), `s3_out.json` (`anoCity`).
- **Root cause:**
  - `web/src/app/[uf]/[slug]/page.tsx` uses `latestYear(c)` only and has no `YearPicker` or `useYear`.
  - `web/src/components/UfDashboard.tsx` builds links with `withYear(...)` (YearPicker.tsx says links "keep context when drilling down"). The promise is broken at the last level.
- **Fix:** Either:
  - add a client year picker to the city KPIs, rank, neighbours and map (read `?ano=` after mount, as `useYear` does), or
  - stop appending `?ano=` to city links and show "Dados de {ly}; a série completa está na tabela abaixo".

  The first option is what a secretária preparing a historical briefing needs.

### GOV-06 · major · UX: filters and sorting are not in the URL, so shared or reloaded views lose them
- **URLs:** http://localhost:3210/explorar?uf=SP&ano=2021 and http://localhost:3210/ma?ano=2020
- **Steps:**
  1. Explorer: set Situação = Abaixo de 25% and enable Reincidentes. The view shows "35 de 5.570". The URL stays `?uf=SP&ano=2021`.
  2. Open that URL in a new tab. It shows "645 de 5.570".
  3. UF dashboard: set Situação = Abaixo de 25% ("6 de 217") and reload. It shows "217 municípios".
- **Expected:** Situação, reincidentes, porte, name search, intermediate region and sort are all encoded in the query string, so an auditor can paste the link into a working paper or e-mail.
- **Evidence:** `s2_out.json` (`ex_url2`, `ex_sharedCount`, `ma_urlAfterFilter`, `ma_countAfterReload`). Reproduced twice.
- **Root cause:**
  - `web/src/components/Explorer.tsx`: `syncUrl` only writes `regiao` and `uf`.
  - `web/src/components/UfDashboard.tsx`: `status`, `inter`, `band`, `q` and `sort` live in React state only.
- **Fix:** Extend `syncUrl` with `situacao`, `reinc=1`, `porte`, `q`, `ordem=key:dir` and read them back in the mount effect. Do the same in `UfDashboard` (`?situacao=abaixo#municipios`). Keep `replaceState`.

### GOV-07 · major · UI: the print/PDF of a city page is not usable for a briefing
- **URL:** http://localhost:3210/mg/uberlandia (same on `/ba/feira-de-santana`)
- **Steps:** `page.emulateMedia({media:'print'})`, then `page.pdf({format:'A4'})`. Ctrl+P in a browser behaves the same.
- **Expected:**
  - Header, nav, buttons and the action kit are hidden.
  - Charts are redrawn to the page width.
  - The year-by-year table fits the page (smaller font or landscape) and keeps the "Fonte" column.
  - The footer carries the URL, data date and source.
- **Actual:**
  - **Sticky header:** the site header is printed in the middle of page 3, covering the "Ano a ano" title.
  - **Table cut off:** the year-by-year table loses everything right of "Fundeb salários" (Fundeb não usado, Por aluno, Saúde, Fonte).
  - **Chart clipped:** the MDE chart is cut at the right edge, so the 2025 point is lost.
  - **Clutter:** the "Acompanhar / Compartilhar / Copiar texto" buttons and the full letter textarea are printed.
  - **Length:** 5–6 A4 pages.
- **Evidence:** `s1_mg_uberlandia.pdf`, `s1_ba_feira-de-santana.pdf`, `pdfhi-1.png` (clipped chart), `pdfhi-3.png` (header over the table), `s1_pdf_uberlandia_pages.png`. Reproduced on 2 cities.
- **Root cause:** `web/src/app/globals.css` has no `@media print` rules, and no component uses the `print:` variants. Recharts' `ResponsiveContainer` keeps the screen width.
- **Fix:**
  - Add a print block: `header, nav, [data-print=hide] {display:none}`, `.sticky {position:static}`, `@page {size:A4; margin:12mm}`, `table {font-size:9pt; white-space:normal}`, `section {break-inside:avoid}`.
  - Tag the action kit, ShareButton, WatchButton and the source buttons with `print:hidden`.
  - Add a print-only footer: "Fonte: SIOPE/FNDE, extraído em …, radar…/mg/uberlandia".
  - Consider a dedicated "Imprimir / PDF" button that calls `window.print()` after a resize event so the charts re-layout.

### GOV-08 · major · UX: CSVs use comma separators and dot decimals, which pt-BR Excel does not open as columns
- **URLs:** http://localhost:3210/dados/csv/ma and Explorer → "Exportar CSV"
- **Steps:** Download the file and open it in Excel with Brazilian regional settings (list separator ";", decimal ",").
- **Expected:** The file opens with one value per column. Prefeituras and TCEs work almost exclusively in pt-BR Excel.
- **Actual:** The header is `ibge,municipio,uf,...`, values look like `25.23`, and there is no `sep=` hint. In pt-BR Excel a double-click puts each line in column A, and "Importar" needs manual decimal configuration. (Inferred from the file format and known Excel pt-BR behaviour; the UTF-8 BOM is present, which is good.)
- **Evidence:** `s2_ma.csv`, `s2_explorar.csv`
- **Root cause:** `web/src/app/dados/csv/[uf]/route.ts` and `downloadCsv` in `web/src/components/Explorer.tsx`.
- **Fix:** Offer "CSV (Excel Brasil)" using `;` and decimal comma (keep the current format as "CSV padrão / dados abertos"), or prepend `sep=,` (Excel only). Better still, also offer `.xlsx`. Document the format on `/dados`.

### GOV-09 · minor · UX/data: the Explorer CSV ignores the selected year, has a generic name and its own schema
- **URL:** http://localhost:3210/explorar?uf=SP&ano=2021 + Abaixo de 25% + Reincidentes
- **Actual:**
  - 35 municipalities are filtered, but the file has 629 data rows (35 × 18 years), in filter order rather than the on-screen sort.
  - The file is always `radar-mde-explorar.csv`, with no hint of filters or year.
  - Columns `receita_impostos_rs`, `mde_aplicado_rs`, `fundeb_nao_usado_pct`, saldo devedor and anos abaixo are missing.
  - `situacao` uses "abaixo do mínimo/cumpriu" here but "declarou/nao_declarou" in `/dados/csv`.
  - `/dados/csv` writes `faltou_rs = 0` for `nao_declarou` rows; the Explorer leaves it blank.
- **Evidence:** `s2_explorar.csv` and `s2_ma.csv` (Araioses 2020 `nao_declarou … ,0,`).
- **Root cause:** `downloadCsv` in `Explorer.tsx`; `route.ts` (`Math.round(shortfall(r)) || 0`).
- **Fix:**
  - Offer two exports: "Esta tabela (ano X, ordem atual)" and "Série completa 2008–2025".
  - Build the filename from the filters (`radar-mde_SP_2021_abaixo25_reincidentes.csv`).
  - Unify the column set and `situacao` vocabulary with `/dados/csv`.
  - Leave `faltou_rs` empty when there is no data.

### GOV-10 · major · UX: recurrence screening is too rigid for an audit
- **URLs:** http://localhost:3210/explorar and http://localhost:3210/sp
- **What's wrong:**
  - "Reincidentes" means "≥ 2 years below 25% at any time 2008–2025" (`timesBelow` in `web/src/lib/rows.ts`), whatever year is selected.
  - Pandemic years count as fully as others: most of the 35 SP hits above are "2020 + 2021" cases, which EC 119 treats differently.
  - It is impossible to ask "below in ≥3 of the last 5 years", "consecutive years" or "below in 2022–2024".
  - "Situação" is single-select, so MDE < 25% and Fundeb < 70% cannot be combined (Buri and Franca fail both in 2021).
  - The UF dashboard has no Reincidentes filter and no "Fundeb não usado acima do limite" filter, though it has a sortable "Anos < 25%" column.
- **Evidence:** `s2_explorar_sp_2021_below_reinc.png`, `s2_ma_2020_below.png`
- **Fix:**
  - Add a period selector (from–to) for the recurrence count, plus an "ignorar 2020–21 (EC 119)" toggle.
  - Make Situação multi-select with AND semantics (MDE / Fundeb pessoal / Fundeb não usado / não declarou).
  - Add a "Anos consecutivos" column.
  - Reuse the same filter set in `UfDashboard.tsx`.

### GOV-11 · minor · content: UF headline and KPI hide non-declaring municipalities
- **URL:** http://localhost:3210/pa?ano=2016
- **Actual:**
  - The headline reads "Em 2016, 0 de 119 municípios do Pará (0%) aplicaram menos de 25%".
  - The KPI shows "0" with a green "−2 vs 2015".
  - 25 of 144 municipalities filed nothing; they are visible only as hatched areas on the map.
  - For an auditor, non-filing is at least as serious as a shortfall.
- **Evidence:** `s2_pa_2016.png`
- **Root cause:** `web/src/components/UfDashboard.tsx` headline and "Abaixo dos 25%" Stat.
- **Fix:** Add "· 25 não declararam" to the headline and a red sub-line on the KPI. Only colour the delta green when `nd` did not grow.

### GOV-12 · minor · data: "Maiores déficits acumulados" ranks atypical values without warning
- **URL:** http://localhost:3210/pa?ano=2016 (the list does not depend on the year)
- **Actual:**
  - #2 is Magalhães Barata at R$ 9,6 mi, "1 ano abaixo: 2025".
  - Its 2025 record has MDE 14.21% and a revenue base of R$ 88.6 mi, against R$ 24.1 mi in 2024: a 3.7× jump, almost certainly a filing error.
  - Ipixuna do Pará (#1) has 9.71% in 2021.
  - Both are "atípico" by the site's own rule (<18%), but the ranking shows no marker.
- **Evidence:** `s2_pa_2016.png`; `cities.json` excerpt in the session notes.
- **Root cause:** `topDeficits` in `web/src/lib/data.ts`; rendered in `UfDashboard.tsx` (around line 312).
- **Fix:** Show the ⚠ atypical marker next to items whose deficit comes from an atypical year. Optionally add a sanity check on base jumps greater than 2× year over year in `scripts/build_data.py`.

### GOV-13 · minor · data: "Aplicado" (mdeV) is missing for 424 municipalities in 2023
- **URL:** http://localhost:3210/mg/uberlandia, "Ano a ano", 2023 row: "Aplicado —" although MDE is 27.73% and the revenue base is R$ 2,3 bi.
- **Scale:** 424 municipalities have `mde` but no `mdeV` in 2023 (BA 74, MG 50, RN 34, SP 28…), against 0–56 in other years.
- **Root cause:** Likely a changed SIOPE field or indicator code for 2023 in `scripts/build_data.py`.
- **Fix:** Fall back to `mde/100 × base` (labelled "estimado"), or fix the field mapping for 2023.

### GOV-14 · minor · content: no data date or "how final is the latest year" on city and UF pages
- **What's wrong:**
  - `meta.updated` is written as `date.today()` at build time (`scripts/build_data.py:208`), so it reflects the build, not the SIOPE extraction.
  - It appears only on `/dados`.
  - City pages show "Em 2025, aplicou…" with no note that 2025 is the latest exercise, that SIOPE data can still be corrected, or that TCE figures may differ (the Santo André comparison shows they do).
  - A secretária citing the number to the mayor needs "Fonte: SIOPE/FNDE, consulta em dd/mm/aaaa".
- **Fix:**
  - Store the fetch timestamp per source in `meta.json`.
  - Show "Dados do SIOPE extraídos em … · exercício 2025: 5.560 de 5.570 municípios declararam" under the city header and in the print footer.

### GOV-15 · polish · content: wording and legal details in the templates
- `web/src/lib/templates.ts`:
  - "nos exercícios de 2021" with a single year should be "no exercício de 2021".
  - "Excelentíssimo Senhor Prefeito" should be "Excelentíssimo(a) Senhor(a) Prefeito(a)".
  - The old `https://www.fnde.gov.br/siope` returns 302; prefer the current gov.br/fnde SIOPE page.
  - The CACS letter cites "SICONFI (RREO, Anexo 8/14)" even when every value came from SIOPE.
  - Some Leis Orgânicas set a higher minimum (São Paulo capital: 31%, worth verifying). `/sp/sao-paulo` shows "No limite em 2025 (25,17%)" without that context, and the TCM-SP letter does not mention it.
- **Fix:**
  - Pluralise by count and use gender-neutral forms.
  - Update the URL.
  - Cite only the sources actually used (`rec.src`).
  - Optionally add a per-municipality `minLOM` override.

### GOV-16 · minor · a11y: low contrast on the red "Abaixo" status badges
- **URLs:** `/ba/feira-de-santana` (1 node), `/sp` (1), `/explorar` (12 nodes)
- **Finding:** axe `color-contrast` (serious) on `.bg-critical-soft.text-critical` badges and pills.
- **Evidence:** `s3_out.json` → `axe …` entries.
- **Fix:** Darken `--critical` text on `--critical-soft` in `web/src/app/globals.css` (both themes) to reach 4.5:1, or use a `critical-ink` token as was done for `good-ink`.

### GOV-17 · polish · UX: kit letters cannot be personalised in place
- **URL:** any city, `#agir`
- **What's wrong:**
  - The textarea is `readOnly`, so "[Seu nome]" and "[Contato]" must be edited after pasting.
  - There is no "baixar .txt/.docx" and no "abrir no e-mail" (mailto) option.
  - Councils and gabinetes usually need a signed document file.
- **Fix:** Add optional Nome, Contato and Segmento inputs above the tabs that fill the placeholders (kept in `localStorage`). Also add "Baixar .docx/.txt" and "Abrir no e-mail" buttons. Root file: `web/src/components/ActionKit.tsx`.

### GOV-18 · minor · UX: "Fonte" links open raw API JSON
- **What's wrong:**
  - The header "SIOPE" button and the "Fonte" column open OData or SICONFI API URLs (`siopeUrl` and `siconfiUrl` in `web/src/lib/format.ts`).
  - The browser shows raw JSON, which finance staff and councillors cannot read or attach as evidence.
- **Fix:**
  - Label the links "dados brutos (JSON)".
  - Add a human-facing link: the SIOPE "Relatórios Municipais / Demonstrativo da Função Educação" for the IBGE code and year, or the SICONFI RREO consultation page.

## 3. Top 5 recommendations for this persona (prioritised)

1. **Fix the kit's content before anything else** (GOV-01–04, GOV-15). These letters go to prefeituras, Câmaras, TCEs and MPs; a false "declarou ter cumprido", missing non-declarations, missing Fundeb violations, or an exact R$ deficit based on an atypical value would hurt the credibility of the people using the site. Use one shared flag helper so the page's "Sinais de alerta" and the letters always agree, and add the EC 119 and "valor atípico" caveats.
2. **Make audit views shareable and reproducible** (GOV-06, GOV-09). Put every filter and the sort in the URL. Export exactly what is on screen, named after the filters, plus a full-series option with one schema shared with `/dados`.
3. **Make it print- and Excel-ready for briefings** (GOV-07, GOV-08, GOV-14). Add a print stylesheet with a source and date footer, a "Baixar CSV (Excel BR)" or `.xlsx` option, and PNG/CSV export per chart for slides.
4. **Add a year selector to the city page** (GOV-05). Honour `?ano=` so drill-down from UF and region keeps context and a secretária can brief on any exercise. Add "compare with similar-size municipalities in the state" (same `POP_BANDS`) alongside região imediata neighbours.
5. **Give auditors proper screening tools** (GOV-10, GOV-11, GOV-12): a configurable recurrence period, an EC 119 toggle and consecutive-year counts; AND-combinable MDE / Fundeb pessoal / Fundeb não usado / não declarou filters; non-declarants surfaced in the UF KPIs; atypical markers in the deficit ranking.
