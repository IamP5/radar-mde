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

---

## Round 2: re-validation after commit ff4a309

- **Target:** production build at http://localhost:3299, same persona journeys.
- **Scripts:** `reports/government/r2_city.mjs`, `r2_auditor.mjs`, `r2_fresh.mjs`.
- **Evidence:** `/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r2/`. Raw outputs are in `r2_city.json`, `r2_auditor.json` and `r2_fresh.json`.
- **Errors:** no console errors or page errors on any route tested.

I re-read all 4 letters for each of these cities: Uberlândia, Feira de Santana, Boa Esperança do Norte, Cabo Frio, Buri, Franca, Aracaju, São Paulo and Brasília.

### Status of round-1 findings

| ID | Status | Evidence / note |
|---|---|---|
| GOV-01 no data ≠ compliance | **FIXED** | Boa Esperança do Norte: all 4 letters now say "Não há registro de envio… no exercício de 2025… não é possível verificar". Item 1 of the CACS letter still points to a series that isn't there (see GOV-26). |
| GOV-02 years not declared dropped | **FIXED** | Cabo Frio: the series lists "2020: não declarou … 2025: não declarou". LAI item 5, vereador item c), CACS item 5 and TCE item (iii) all ask for the missing statements. |
| GOV-03 Fundeb ignored | **FIXED** | Franca and Buri: the context gives 2021 at 52,73% and 2022 at 67,50% (minimum 70%), and unspent Fundeb above the limit in 2012 and 2021. The CACS letter has agenda items 2–3 (art. 26 and art. 25 §3º of Lei 14.113). The TCE letter cites art. 212-A. |
| GOV-04 atypical values / EC 119 | **FIXED** in the letters, **partial** on the page | Letters: Cabo Frio 2016 is marked "(valor atípico — confirmar)" and "R$ 57,6 mi … depende de valores declarados atípicos e deve ser confirmado". Uberlândia gets the EC 119 paragraph ("parece ter coberto essa diferença…"), and the art. 35 intervention sentence is gone. The "Déficit até 2019: R$ 57,6 mi" KPI on the Cabo Frio page still has no caveat (GOV-25). |
| GOV-05 city ignores `?ano=` | **FIXED** | `/mg/uberlandia?ano=2019` shows "MDE em 2019 · 28,80%". `/pa/concordia-do-para?ano=2016` shows 2016. Picking 2021 updates the URL to `?ano=2021`. The share link copies `…/mg/uberlandia?ano=2021`. Printing with `?ano=2021` prints 2021. Mojuí dos Campos with `?ano=2010` says "ainda não existia". Invalid `?ano=1999` or `abc` falls back to the latest year. |
| GOV-06 filters not in URL | **FIXED** | UF page: `/sp?ano=2021&situacao=below&reinc=3&ordem=reinc-desc` gives "9 de 645" after reload and in a new tab. Explorer: `/explorar?uf=SP&ano=2021&situacao=abaixo&reinc=1` gives 35 in a new tab (round 1: 645). |
| GOV-07 print/PDF | **FIXED** (new minor issues in GOV-22) | Each page now carries a print header (URL + "impresso em 07/10/2026" + source), no sticky header, all 11 table columns including Fonte, the MDE chart through 2025, no buttons or kit. The footer shows "Dados extraídos em … · versão … · CC BY 4.0". See `print_mg_uberlandia.pdf`, `print_uberlandia_pages_*.png`. |
| GOV-08 Excel-BR CSV | **FIXED** (UF page gap in GOV-21) | `/dados/csv/ma-excel` uses `;` separators, decimal comma and a BOM, and `/dados` lists an `-excel` link for every scope. Explorer has "Só 2021 / Série 2008–2025 · Excel Brasil". |
| GOV-09 Explorer CSV | **PARTIAL** | Fixed: you can export the year only or the full series, rows follow the table order, filenames describe the filters (`radar-mde_SP_2021_abaixo_reincidentes_excel.csv`), the vocabulary matches `/dados` (`envio`, `situacao_mde`, `pandemia_ec119`, `atipico`), and `faltou_rs` is empty when not declared. Still missing from Explorer exports: tax revenue, amount applied and unspent Fundeb (the `Row` limitation documented in CONTRACT §6). An auditor screening a state still has to switch to `/dados/csv/<uf>` for those. |
| GOV-10 recurrence screening | **PARTIAL** | The UF page now has "Reincidência": 2+, 2+ outside 2020–21, 3+ and 5+, all in the URL. SP 2021 below 25%: 118 → 5 (excluding the pandemic years) → 9 (3+). Still missing: a configurable period ("last N years"), consecutive years, combining MDE + Fundeb (Situação is single-select on both pages), and the same options in Explorer (still a single ≥2 "Reincidentes" toggle). |
| GOV-11 non-declarants hidden | **FIXED** | `/pa?ano=2016`: "0 de 119 abaixo de 25% · 25 não declararam", the headline sentence repeats it, and the KPI shows "+ 25 não declararam". |
| GOV-12 deficit ranking includes atypical values | **NOT FIXED** | `/pa`, "Maiores déficits acumulados": #1 Ipixuna do Pará (2021 is 9,71%, flagged `atip:["mde"]`) and #2 Magalhães Barata (2025 flagged `["mde","base"]`) still show no marker. The `atip` data exists, but `topDeficits` (`lib/data.ts`) and the list in `UfDashboard.tsx` don't use it. |
| GOV-13 2023 amount applied missing | **FIXED** | Uberlândia 2023 shows "≈ R$ 630,4 mi" with the "≈ = estimado pelo Radar" note. |
| GOV-14 data date | **FIXED** | The footer has "Dados extraídos em 07/10/2026 · versão 2026-10-07.586603bb · licença CC BY 4.0", and print adds the date and source. |
| GOV-15 wording | **FIXED** | "no exercício de 2021" singular; "Excelentíssimo(a) Senhor(a) Prefeito(a)"; SIOPE URL now gov.br/fnde; only SIOPE is cited when it is the only source; Lei Orgânica clause added to the vereador letter. The new code introduces its own wording bug (GOV-19). |
| GOV-16 badge contrast | **FIXED** | axe reports 0 issues on `/ba/feira-de-santana`, `?ano=2016`, `/explorar` and the Mojuí page. A new, different axe issue shows up on the UF table (GOV-23). |
| GOV-17 letters not editable | **FIXED** (with a new bug, GOV-20) | Letters are editable. "Copiar texto" copies the edited text. WhatsApp and E-mail buttons are there, plus "Onde enviar" with Fala.BR and search links. "Desfazer edições" is shown. |
| GOV-18 Fonte opens raw JSON | **PARTIAL** | The table description now says "leva aos dados brutos (JSON) no sistema oficial", so expectations are set. There is still no human-readable link (SIOPE municipal report or SICONFI RREO page) that finance staff could attach as evidence. |

**Totals:** 14 FIXED · 3 PARTIAL (GOV-09, GOV-10, GOV-18) · 1 NOT FIXED (GOV-12) · 0 REGRESSED.

### New findings (round 2)

#### GOV-19 · major · content: CACS letter has garbled words ("Verificação d demonstração", "Verificação ds medidas", "Pedido d confirmação")
- **URLs:** http://localhost:3299/mg/uberlandia, `/sp/franca`, `/rj/cabo-frio`, CACS tab.
- **Actual text:**
  - Uberlândia, item 2: "Verificação d demonstração da aplicação complementar exigida pela EC nº 119/2022…" (Franca, item 4: same).
  - Cabo Frio, item 4: "Verificação ds medidas adotadas para compensar…".
  - Cabo Frio, item 6: "Pedido d confirmação ou retificação…".
  - Reproduced on 3 cities.
- **Expected:** "Verificação da demonstração…", "Verificação das medidas…", "Pedido de confirmação…".
- **Evidence:** `r2/r2_city.json` → `/mg/uberlandia.letters[1]`, `/rj/cabo-frio.letters[1]`.
- **Root cause:** `web/src/lib/templates.ts`, `cacsItems`. The items are built as `` `verificação d${asks.comp.slice(1)}` ``, `` `verificação d${asks.ec119.slice(1)}` `` and `` `pedido d${asks.atyp.slice(1)}` ``. `asks.*` start with "as …" or "a …", so `slice(1)` drops the article's first letter instead of merging it.
- **Fix:**
  - Use `` `verificação d${asks.comp}` `` ("d"+"as" → "das") and `` `verificação d${asks.ec119}` `` ("da").
  - Use `` `pedido de ${asks.atyp.replace(/^a /, "")}` ``.
  - Better: keep a noun-only form of each ask and add the article explicitly.
  - Add a unit test asserting no `/\bd[s ]\b/` artefacts in the generated letters.

#### GOV-20 · major · UX: edits to a letter are lost when switching tabs
- **URLs:** http://localhost:3299/mg/uberlandia and `/sp/franca`
- **Steps:**
  1. In "Pedir informações" (or "Avisar o conselho"), replace "[Seu nome]" or add text.
  2. Click another letter tab, then come back.
- **Expected:** The edits persist. The UI says "Você pode editar o texto aqui: troque [Seu nome] e [Contato]…", and a council member filling in several letters will switch tabs.
- **Actual:** The text resets to the template (`editPersists: false` on both cities). Changing the year keeps the edits (`editAfterYear: true`), so only tab switching loses them.
- **Evidence:** `r2/r2_city.json` (`editPersists`), `r2/r2_fresh.json` (`editPersists2`).
- **Root cause:** `web/src/components/ActionKit.tsx`. `Letter` holds `text` in local `useState`, and Base UI `TabsContent` unmounts inactive panels, so the state is discarded.
- **Fix:**
  - Pass `keepMounted` to `TabsContent`, or lift `text` per `t.id` into `ActionKit`. Optionally persist it to `sessionStorage`.
  - Better: add shared "Seu nome / Contato / Segmento" fields above the tabs that fill the placeholders in all 4 letters.

#### GOV-21 · minor · UX: the UF page "Baixar CSV" ignores the table filters and has no Excel-BR option
- **URL:** http://localhost:3299/sp?ano=2021&situacao=below&reinc=3
- **Actual:**
  - The only download is `/dados/csv/sp`: comma-separated, every municipality and every year.
  - An auditor who just filtered 9 municipalities must go to `/explorar` and set the filters up again to export that list, or to `/dados` for the Excel variant.
- **Root cause:** `web/src/app/[uf]/page.tsx` (header actions); `UfDashboard.tsx` has no export.
- **Fix:**
  - Replace the button with the same dropdown as Explorer ("Esta tabela (N municípios, ano) / Série completa" × "CSV padrão / Excel Brasil"), reusing `rowCsvRecord`/`toCsv`/`csvFilename`.
  - Or link "Abrir no Explorar com estes filtros" with the same query string.

#### GOV-22 · minor · UI: print issues remain (Fundeb chart clipped, half-empty first page)
- **URL:** http://localhost:3299/mg/uberlandia (print to A4)
- **Actual:**
  - In "% do Fundeb pago aos profissionais", the y-axis labels are cut on the left and the x-axis years are cut at the bottom, overlapping the legend ("50%" sits on top of "Fundeb — mínimo legal").
  - Page 1 has only the header and the 4 KPIs, and the rest of the page is blank. Pages 2–5 also have large gaps.
  - The result is 6 A4 pages for one municipality.
- **Evidence:** `r2/print_p5_fundeb_chart.png`, `r2/print_uberlandia_pages_1.png`, `r2/print_uberlandia_pages_2.png`, `r2/print_mg_uberlandia.pdf`
- **Root cause:**
  - `TrendChart` keeps its screen-measured width or height in print.
  - The `break-inside: avoid` rules in `web/src/app/globals.css` (print block) push whole panels to the next page.
- **Fix:**
  - Give charts a fixed print height and redraw them on the `beforeprint` event (or use `matchMedia('print')` in `useWidth`).
  - Allow the year-by-year table to break across pages, and keep `avoid` only for small cards.
  - Consider a compact "ficha para impressão" (KPIs + MDE chart + table) of 2 pages.

#### GOV-23 · minor · a11y: `aria-label` on a role-less span in the UF table (axe `aria-prohibited-attr`, serious)
- **URL:** http://localhost:3299/sp?situacao=below&ano=2021
- **Finding:** `<span tabindex="0" aria-label="Valor atípico: possível erro de preenchimento, confira na fonte" data-slot="tooltip-trigger">`, the atypical hint in the MDE cell. Screen readers may ignore the label.
- **Root cause:** `Hint` in `web/src/components/UfDashboard.tsx`
- **Fix:** Add `role="img"` (or render a `<button type="button">`) on the trigger. Keep the visible tooltip.

#### GOV-24 · minor · content: TCE letter cites art. 212-A / Lei 14.113 for Fundeb years before 2021
- **URL:** http://localhost:3299/rj/cabo-frio, TCE tab: "(ii) o cumprimento do art. 212-A da Constituição Federal e da Lei nº 14.113/2020 (Fundeb) no exercício de 2016".
- **Problem:** Art. 212-A (EC 108/2020) and Lei 14.113 did not exist in 2016. Fundeb was then governed by art. 60 of the ADCT and Lei 11.494/2007. The CACS letter gets this right ("60% para o magistério até 2020, Lei nº 11.494/2007"); the TCE letter does not.
- **Root cause:** `checks` in `web/src/lib/templates.ts`
- **Fix:** Split by year. For years ≤ 2020, cite "art. 60 do ADCT e da Lei nº 11.494/2007"; for years ≥ 2021, cite "art. 212-A da CF e da Lei nº 14.113/2020".

#### GOV-25 · minor · content: the city deficit KPI has no caveat when the estimate rests on atypical values
- **URL:** http://localhost:3299/rj/cabo-frio (also with `?ano=2022`)
- **Actual:**
  - The KPI reads "Déficit até 2019: R$ 57,6 mi · estimativa não compensada desde 2008". The whole amount comes from the 2016 value of 4,34%, flagged atypical.
  - The "Sinais de alerta" panel and the letters carry the caveat; the headline KPI, which is what gets screenshotted into a slide, does not.
- **Root cause:** The deficit `Stat` in `web/src/app/[uf]/[slug]/city-year.tsx` doesn't read `cityFacts().carryShaky`.
- **Fix:** When `carryShaky` is set, show a ⚠ icon and the sub-text "depende de valor atípico de 2016, confirme na fonte".

#### GOV-26 · polish · content/UX: small leftovers in the kit
- **Boa Esperança do Norte (installed 2025):**
  - The CACS letter item 1 says "Análise da série histórica de aplicação em MDE (abaixo)", but no series is printed.
  - The LAI letter asks for "últimos 5 exercícios" for a municipality with 1 year of existence.
  - Fix: drop item 1 when `reported.length === 0`, and use `min(5, anos desde a instalação)`.
- **Mobile intro text** (`#agir` description, 375px): "…uma comunicação ao Tribunal de Contas ." The glossary term's inline-block leaves a space before the period. See `r2/mobile_kit.png`.
- **E-mail links:** the `mailto:` links are 3.3k–5k characters (Uberlândia/Franca LAI ≈ 4.7k). Some desktop clients (Outlook on Windows) truncate mailto bodies around 2k. Consider a note "se o texto chegar cortado, use Copiar texto", or put a shorter summary in the body.

### Updated top 5 for this persona
1. Fix the CACS wording bug (GOV-19) and keep edits across tabs, with shared name and contact fields (GOV-20). These are the two things a council member will notice first.
2. Mark atypical values in "Maiores déficits" and on the city deficit KPI (GOV-12, GOV-25). These are the most quotable numbers on the site.
3. Make audit screening complete: an export of the filtered UF table plus an Excel option on the UF page (GOV-21), MDE + Fundeb combinable filters, and a recurrence window and consecutive-year count, also in Explorer (GOV-10).
4. Polish the print: chart sizing and page breaks, or a compact 2-page "ficha" (GOV-22).
5. Fix the legal details: cite the Fundeb law of the right period in the TCE letter (GOV-24), and add a human-readable source link next to the JSON link (GOV-18).

_Note (after the :3299 rebuild for the uppercase-URL cache fix):_ none of my round-2 routes had returned 404, a blank page or a 308. After the rebuild I re-checked `/mg/uberlandia`, `/ba/feira-de-santana`, `/sp`, `/ma`, `/pa`, `/mg`, `/rj`, `/sp/santo-andre`, `/rj/cabo-frio`, `/sp/franca`, `/explorar?uf=SP&ano=2021` and `/dados/csv/ma-excel`: all return 200. I re-ran `r2_fresh.mjs`; it reproduces GOV-20 (`editPersists2: false`) and GOV-23 (`aria-prohibited-attr`), with no console errors. The statuses above are unchanged.

---

## Round 3: final check of fix wave 2 (commit 72c19ee)

- **Target:** fresh production build at http://localhost:3299.
- **Scripts:** `reports/government/r3.mjs` (letters, edit persistence, UF recurrence and export, deficits, Explorer, print, axe, mobile), `r3b.mjs` (e-mail copy, Explorer situation options) and `r3c.mjs` (chart export).
- **Evidence:** `/Users/tuba/Dev/projects/radar-mde/qa/reports/government/r3/`; raw output in `r3.json`.
- **Errors:** no console errors or page errors on any route.
- **axe (WCAG 2 A/AA):** 0 violations on `/sp?situacao=below&ano=2021`, `/rj/cabo-frio` and `/explorar?uf=SP`.

### Status of findings that were open after round 2

| ID | Status | Evidence |
|---|---|---|
| GOV-09 Explorer CSV columns | **FIXED** | `r3/ex_radar-mde_SP_2021_abaixo_excel.csv` now has `mde_aplicado_rs`, `receita_impostos_rs`, `fundeb_nao_usado_pct` and `fundeb_nao_usado_max_pct`, plus `atipico_grau` and the IPCA-corrected `*_real` columns, in Excel-BR format. |
| GOV-10 recurrence screening | **FIXED** | UF table options: 2+, 3+, 5+, 2+ outside 2020–21, "2+ nos últimos 5 anos", "2+ anos seguidos" and "3+ anos seguidos". The column header follows the option ("Abaixo nos últimos 5", "Anos seguidos < 25%"). There is a combined "MDE e Fundeb abaixo do mínimo" situation. SP 2021 below 25%: 118 → 22 (2+ in the last 5 years) → 17 (2+ in a row) → 2 (3+ in a row: Marília, Barretos). MDE + Fundeb together: 20. Explorer has the same options with counts ("2+ anos abaixo em 2017–2021", "… seguidos (até 2021)", "Abaixo de 25% e Fundeb < 70%"), and the state is kept in the URL (`reinc=u5`). One ordering glitch is listed as GOV-27. |
| GOV-12 deficit ranking includes atypical values | **FIXED** | `/pa` "Maiores déficits": Ipixuna do Pará, Magalhães Barata, Salinópolis and Brasil Novo each show "Inclui valor fora do padrão do próprio município (ano); confirme na fonte". Same on `/sp` (Riolândia, Nova Granada). There is also a nominal/IPCA toggle. Screenshot: `r3/pa_deficits.png`. |
| GOV-18 Fonte opens raw JSON | **PARTIAL** (unchanged) | Links now have explicit names ("Dados brutos de 2019 no SIOPE (JSON, abre em nova aba)"), but they still point to the OData API. There is still no human-readable SIOPE or SICONFI report link a secretária could attach. Low priority. |
| GOV-19 garbled CACS words | **FIXED** | I scanned all 20 letters (5 cities × 4) for `d `/`ds ` artefacts, double spaces, "undefined", "NaN" and "null" and found none. Cabo Frio's CACS letter now reads "Verificação das medidas…" and "Pedido de confirmação…"; Buri's reads "Verificação da demonstração…". |
| GOV-20 edits lost on tab switch | **FIXED** | Edits survive tab switching on Uberlândia and Franca (`keptAcrossTabs: true`). They reset on page reload, which is acceptable since nothing is stored. |
| GOV-21 UF CSV ignores filters | **FIXED** | The new "Exportar tabela" menu follows the filters and the table order. Example: `sp?ano=2021&situacao=below&reinc=u5` → `radar-mde_SP_2021_below_reinc-u5.csv` with 22 rows, and the series in Excel-BR with 396 rows (22 × 18). The header button now offers "CSV padrão / Excel Brasil" for the whole state. |
| GOV-22 print issues | **FIXED** | Uberlândia prints on 5 A4 pages, with no half-empty first page. The Fundeb chart's axes (50–90%, 2009–2025) are fully visible. The year-by-year table header repeats on each page. See `r3/print_mg_uberlandia.pdf`, `r3/print_uberlandia_pages.png`. Panels may now split across pages (e.g. "Posição em 2025"): acceptable. A UF-page print problem is listed as GOV-28. |
| GOV-23 aria on the atypical hint | **FIXED** | axe reports 0 issues on `/sp?situacao=below&ano=2021`. |
| GOV-24 Fundeb law by year | **FIXED** | Cabo Frio TCE letter: "(ii) o cumprimento do art. 60 do ADCT e da Lei nº 11.494/2007 (Fundeb) no exercício de 2016". Franca splits the years correctly: 2012 → ADCT art. 60 / Lei 11.494; 2021–22 → art. 212-A / Lei 14.113. |
| GOV-25 deficit KPI caveat | **FIXED** | Cabo Frio: "Déficit até 2019 · R$ 57,6 mi · estimativa que depende de valor fora do padrão em 2016 — confirme na fonte". |
| GOV-26 kit leftovers | **FIXED** | <ul><li>Boa Esperança do Norte: the CACS letter no longer has the "série histórica (abaixo)" item, and the LAI letter asks for "no exercício de 2025" instead of "últimos 5 exercícios".</li><li>The `mailto:` links are now about 280–340 characters. Clicking "E-mail" copies the full (edited) text to the clipboard and shows "Texto copiado: no e-mail que abriu, cole no corpo da mensagem".</li><li>At 375px the kit has no horizontal overflow (`r3/mobile_kit.png`).</li></ul> Tiny leftover: "no exercício de 2025, que não constam" (singular year, plural verb). |

**Round 3 totals for the 12 rechecked IDs:** 11 FIXED · 1 PARTIAL (GOV-18) · 0 NOT FIXED · 0 REGRESSED.

**Letters:** I re-read all 4 letters for Cabo Frio, Franca, Uberlândia, Buri and Boa Esperança do Norte. Each one is pre-filled correctly, uses the right court (TCE-RJ, TCE-SP, TCE-MG, TCE-MT), cites the right law for each period, carries the EC 119 and atypical-value caveats, includes the Fundeb points and lists the years not declared. I found no factual or grammatical errors beyond the GOV-26 leftover.

### New findings (round 3)

#### GOV-27 · minor · UI: UF "Reincidência" options are out of order ("Qualquer histórico" sits 4th)
- **URL:** http://localhost:3299/sp?ano=2021, Reincidência dropdown.
- **Actual order:** "2+ anos abaixo de 25%", "3+ …", "5+ …", **"Qualquer histórico"**, "2+ anos fora de 2020–21", "2+ nos últimos 5 anos", "2+ anos seguidos", "3+ anos seguidos".
- **Expected:** "Qualquer histórico" (the reset option) first, as in Explorer ("Todos" first).
- **Evidence:** `r3/r3.json` → `uf.recOptions`.
- **Root cause:** `web/src/components/UfDashboard.tsx` builds `REINCS` with `Object.fromEntries(Object.entries(REINC))`. JavaScript always lists integer-like keys ("2", "3", "5") before string keys, so `all` moves behind them.
- **Fix:** Pass an ordered array of `[key, label]` pairs to `FilterSelect`, or rename the keys to non-numeric ones ("n2", "n3", "n5"; keep accepting the old URL values).

#### GOV-28 · minor · UI: printing a filtered UF table prints only the first 50 rows and the filter controls
- **URL:** http://localhost:3299/sp?ano=2021&situacao=below (print to A4, 6 pages)
- **Actual:**
  - The table stops at "Mostrando 50 de 118", so an auditor printing the list of 118 municipalities below 25% gets 50.
  - The search box and filter selects are printed as empty-looking controls.
  - On continuation pages the repeated header row shows only "Situação": the sortable headers' labels (inside `<button>`) are blank.
- **Evidence:** `r3/print_sp_ano_2021_situacao_below.pdf`, `r3/print_sp_table_pages.png`
- **Root cause:**
  - Pagination (`limit`, PAGE = 50) in `web/src/components/UfDashboard.tsx` applies in print too.
  - The print stylesheet in `globals.css` does not hide the filter bar.
  - Sort buttons in a repeated `thead` lose their text in Chrome's print layout, probably because of `print:hidden` icons or sticky styles on the buttons.
- **Fix:**
  - On `beforeprint`, render all filtered rows (or add a "Imprimir lista completa" action).
  - Replace the filter bar with a one-line print summary ("Filtros: Abaixo de 25% · 2021 · 118 municípios").
  - Make the header labels plain text in print (`print:` styles on the sort button: static position, no hidden span).

#### GOV-29 · polish · content: exported chart PNG has no legend for the two median lines, and its URL shows `localhost:3000` unless `NEXT_PUBLIC_SITE_URL` is set
- **URL:** http://localhost:3299/mg/uberlandia?ano=2021 → MDE chart → "Exportar" → Imagem PNG
- **Actual:**
  - The PNG (`r3/chart_radar-mde_mg_uberlandia_mde.png`) shows a blue line, an orange dotted line and a black dotted line. The footer says only "Medianas: MG e Brasil", so on a slide nobody can tell which dotted line is MG.
  - The PNG footer and "Copiar citação" use `http://localhost:3000/mg/uberlandia?ano=2021`: wrong host, and wrong port compared with :3299. That is the documented `lib/site.ts` fallback; it is a deployment-configuration issue rather than a code bug.
- **Fix:**
  - Draw a small legend into the exported image in `buildExport` (`web/src/components/kit/chart-actions.tsx`), using the chart's series labels and colours. Or say the colours in the note: "Medianas: MG (laranja) e Brasil (preto)".
  - Make sure `NEXT_PUBLIC_SITE_URL` is set in the production environment. A build-time error, rather than only a `console.warn`, would catch this.

Everything else in the fresh pass worked:
- Chart export PNG, SVG and CSV, plus the Excel-BR CSV and the citation.
- Year picker plus print with `?ano=`.
- The "Salvar" button.
- IPCA toggle on the deficits.
- Mobile 375px layout with no horizontal overflow.

### Final summary for this persona (after 3 rounds)
- **GOV-01 to GOV-26:** 25 FIXED · 1 PARTIAL (GOV-18, raw-JSON source links). New in round 3: 3 minor or polish (GOV-27, GOV-28, GOV-29).
- **What remains is not serious:** no blocker or major issue is open for government users.
- **Biggest remaining gap for auditors:** printing a filtered UF list (GOV-28).
