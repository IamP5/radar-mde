# QA report: academic researcher persona (education finance)

Persona: professor/PhD in public education finance. Checks whether the numbers can be trusted, whether the methodology is rigorous and stated, and whether the data can be reused in R/Stata.
Environment: http://localhost:3210 (dev), headless Chromium via Playwright, 1440×900. Scripts, screenshots and page text dumps are in `qa/reports/academic/`.
Date: 2026-10-07. No console errors or page errors on any route visited (/, /sobre, /dados, /explorar, /sp, /ro, /mt, /regiao/nordeste, and 12 municipality pages).

## 1. Journey

| # | Task | Result |
|---|------|--------|
| 1 | Read /sobre for definitions, sources, legal rules, limits | Mostly good. Legal rules are correct (art. 212, art. 35 III, Lei 14.113 60→70% and 5→10%, EC 119), the text says "declarado não é apurado", and the ≥85% coverage rule is explained. Gaps: it never says R$ are **nominal**, it doesn't list the SIOPE indicator codes, it doesn't define the per-student denominator, and some statements are inaccurate (ACA-05, ACA-10). |
| 2 | Verify the Santo André series against the raw data | **Succeeded.** All 18 years on the page match `cities.json` and the raw SIOPE file. I fetched the "Fonte → SIOPE" link live for 2014 and it returns `1.1 = 20.53`, as shown. I recomputed the "saldo devedor" carry-over by hand (52 → 38.5 → 37.8 → 37.7 → 26.7 → 21 → 16.5 → 34.3 → 0.9 → 0 mi) and it matches the page. The thesis comparison table (TCE − SIOPE differences) is correct and well presented. |
| 3 | São Paulo capital, Fortaleza, Teresina, a small PI city (Barras) | Pages render. SP capital correctly points to TCM-SP. Missing years in Barras appear as honest gaps in the line chart. Per-student series contain implausible jumps that are not flagged (Fortaleza 2016 R$ 3.040 between R$ 4.675 and R$ 5.641) (ACA-04). |
| 4 | Recompute national 2025 headline numbers from JSON | **Matches.** 23 municipalities below 25%, R$ 150,1 mi, 732.269 inhabitants, median 27,12%, 8 below the Fundeb minimum. |
| 5 | Move through years (Brasil → UF → município, `?ano=2014`) | **Failed at the municipality level.** The município page ignores `?ano=` (ACA-03). |
| 6 | Download data for R/Stata (/dados CSV Brasil, Explorar export) | Works: a balanced panel of 5.570 × 18 = 100.260 rows, UTF-8 with BOM, comma separator, dot decimal. Problems: `faltou_rs = 0` where it should be missing, the two exports use different schemas, there is no flag for estimated values, and some indicators are missing (ACA-06/07/08/13). |
| 7 | Data gaps, "sem dado", municipalities created after 2008 | **Failed.** Municipalities created in 2013 and 2025 are reported as "não declarou" for years before they existed (ACA-01). A municipality with no data gets a blank map, no neighbours and a template that contradicts itself (ACA-02). |
| 8 | Inflation adjustment, pandemic years, declared vs audited | Per-student is labelled nominal on the chart. Multi-year R$ sums (saldo devedor, "maiores déficits acumulados", "R$ que faltou" series) add up nominal reais across 18 years (ACA-05). EC 119 is marked on the city table and the home chart, but not on Explorar or the city chart (ACA-14). |
| 9 | Citing the tool | /dados "Como citar" asks users to cite the original sources. There is no citable reference for the Radar itself, no version and no license (ACA-11). |
| 10 | Chart honesty | Axes have units, the 25% reference line is present, missing years show as gaps, and the per-student chart says "nominal". The Y axis on the % chart doesn't start at 0, which is acceptable for a percentage with a reference line. Labels wrap when values reach 100 mil or more (ACA-12). |

## 2. Findings

### ACA-01 · major · data — Municipalities created after 2008 are reported as "não declarou" for years before they existed
- **URL:** /mt/boa-esperanca-do-norte, /pa/mojui-dos-campos, /sc/pescaria-brava, /sc/balneario-rincao, /ms/paraiso-das-aguas, /rs/pinto-bandeira; /dados (coverage table); both CSVs.
- **Steps:** Open /pa/mojui-dos-campos.
- **Expected:** 2008–2012 shown as "município ainda não existia" (or left out), not counted as missing filings.
- **Actual:** The "Sinais de alerta" box says "Não declarou dados de MDE em 2008, 2009, 2010, 2011, 2012", and the table marks each of those years "não declarou". Boa Esperança do Norte (installed 2025) gets "O município não declarou dados de MDE … em 2008 … 2025. A falta de envio também é um sinal de alerta de transparência." The /dados "Não declararam" counts and the CSV `situacao=nao_declarou` include these rows (about 45 spurious records). The national denominator for 2008–2024 is 5.570 when it should be 5.569.
- **Evidence:** `reports/academic/shot_mt_boa-esperanca-do-norte.png`. Data check: Mojuí dos Campos nd = 2008–2012, Pescaria Brava and Paraíso das Águas nd = 2008–2013, Balneário Rincão and Pinto Bandeira nd = 2008–2012, Boa Esperança do Norte nd = 2008–2025. Reproduced from the JSON and from the rendered page.
- **Root cause:** `scripts/build_data.py` (~lines 150–167) writes `{"s": "nd"}` for every year whenever the UF file for that year was downloaded (`y in seen[uf]`). It never checks whether the municipality existed in that year. `ibge_municipios.json` has 5.571 entries; Noronha is removed, so 5.570 remain, including the 2025 municipality.
- **Fix:** Add an installation-year map (IBGE: 5101837→2025; 1504752, 4212650, 4220000, 5006275, 4314548→2013). Emit `{"s": "na"}` (not yet installed) or skip those years. Render them as "não existia" (neutral grey) and leave them out of coverage counts, alerts and CSV `nao_declarou`. Use year-specific denominators in `meta.coverage`.

### ACA-02 · major · bug — A municipality with no data at all shows a blank state map, no neighbours and a contradictory request template
- **URL:** /mt/boa-esperanca-do-norte
- **Steps:** Open the page and scroll to "Onde fica", "Vizinhos" and "O que você pode fazer".
- **Expected:** The state map coloured for the latest published year, the neighbours list (Sorriso, Lucas do Rio Verde, …), and a template that does not claim compliance.
- **Actual:** All 141 MT polygons are filled `rgb(242,242,242)` ("sem dados"). /mt/sorriso shows the same map coloured. "Sem dados de vizinhos para este ano." The LAI template says "o Município declarou ter cumprido o mínimo constitucional de 25% nos exercícios informados", followed by an empty "Percentuais declarados:" list.
- **Evidence:** `map_mt_boa-esperanca-do-norte.png` vs `map_mt_sorriso.png`; fill counts `{"rgb(242,242,242)":141}` vs coloured fills on Sorriso. Reproduced 3 times.
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx` lines 88–116: `ly = latestYear(c)` is `null`, and the map, peers (`ly && p.years[ly]`) and distribution all key off `ly`. `web/src/lib/templates.ts:28` picks the "declarou ter cumprido" sentence whenever `below.length === 0`, including when `reported.length === 0`.
- **Fix:** Use `ly ?? YEARS.at(-1)` for the map, peers and histogram. In the template, add a third branch when `reported.length === 0`: "não há declaração ao SIOPE para os exercícios consultados", and hide "Percentuais declarados".

### ACA-03 · major · bug — The município page ignores `?ano=`, which /sobre says works
- **URL:** /sp/santo-andre?ano=2014 (also ?ano=2021)
- **Steps:** Open /sp?ano=2014 (it correctly shows 2014; 50 of 56 city links carry `?ano=2014`). Click any municipality, or open /sp/santo-andre?ano=2014 directly.
- **Expected:** KPIs, "Posição em 2014", "Onde fica · 2014" and the neighbours for 2014. /sobre says: "O ano escolhido acompanha a navegação (parâmetro ?ano= no endereço), para comparar o mesmo exercício em todos os níveis."
- **Actual:** Everything shows 2025 ("MDE 2025", "Posição em 2025", "Onde fica · 2025"). The page has no year picker. Reproduced with 2014 and 2021 (`ano.mjs`).
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx` is fully static and doesn't read `searchParams` or use `YearPicker`/`useYear`. The UF and territory dashboards do (`components/UfDashboard.tsx`, `TerritoryDashboard.tsx`).
- **Fix:** Move the year-dependent blocks (KPIs, ranking, histogram, map, neighbours) into a client component that uses `useYear(initial=ly)`, and add the same `YearPicker`. Otherwise, change /sobre to say the year carries through to state level only. For a researcher, "where did Santo André rank in 2014?" is a core question.

### ACA-04 · major · data — The per-student indicator has many implausible values and none are flagged
- **URL:** /sp/adamantina, /rs/uniao-da-serra, /ce/fortaleza (also the KPI tile "Por aluno", Explorar column "R$ por aluno", state "Mediana por aluno")
- **Steps:** Open /sp/adamantina and look at "Investimento por aluno".
- **Expected:** Plausible values, or atypical values marked.
- **Actual:** Adamantina: 9.351 (2020) → 36.241 → 41.043 → **95.343 (2023)** → 51.980. MDE applied in 2023 was R$ 38,1 mi, which implies only about 400 students for a city of 35.673 people. União da Serra reaches 140.362 in 2023. Fortaleza falls to 3.040 in 2016 between 4.675 and 5.641. Across the dataset, **374 city-year transitions jump more than 2,5× year over year**. The pipeline drops only values outside R$100–200 mil.
- **Evidence:** `chart_sp_adamantina_Investim.png`, `chart_rs_uniao-da-serra_Investim.png`, `chart_ce_fortaleza_Investim.png`.
- **Root cause:** SIOPE indicator 4.9 ("Investimento educacional por aluno") depends on the enrolment count each municipality typed into SIOPE. `scripts/build_data.py:128` keeps any value in [100, 200000]. /sobre never names the indicator or its denominator. Its "Próximos passos" lists "Gasto por aluno (com matrículas do Censo Escolar/INEP)", which makes it look as if per-student isn't shown yet.
- **Fix:** (a) Flag `perAluno` as atypical when it is more than 2,5× or less than 0,4× the municipality's own median, or outside the UF's p1–p99 band, then show a dotted marker and tooltip and exclude it from medians. (b) Add a cross-check: `mdeV / matrículas (Censo Escolar, rede municipal)`. (c) In /sobre, state "indicador SIOPE 4.9; denominador = matrículas declaradas pelo ente ao SIOPE". (d) Apply the same outlier flag to MDE % (for example Piaçabuçu/AL 2025 5,63% with Fundeb 48,55%, Cametá/PA 2017 64,05%, Cabo Frio/RJ 2016 4,34%), labelled "possível erro de preenchimento".

### ACA-05 · major · content/data — Nominal reais are summed and compared across 18 years, and /sobre never says values are nominal
- **URL:** / ("Maiores déficits acumulados", Evolução → "R$ que faltou para 25%"), /sp/santo-andre ("Saldo devedor", "Déficit não compensado"), /sobre
- **Steps:** Read /sobre → Cálculos, then look at Santo André's saldo devedor and the home page "Maiores déficits acumulados".
- **Expected:** Either deflated values (for example IPCA to Dec/2025 reais) or an explicit warning wherever multi-year sums appear.
- **Actual:** The saldo devedor offsets a 2014 shortfall (R$ 52 mi in 2014 reais) with 2015–2022 surpluses in nominal reais. Cumulative IPCA 2014→2022 is about 60%, so the offset is overstated. Rankings such as "Porto Alegre R$ 674 mi" mix years. The only "nominal" disclaimers are on the per-student chart, the UF tile and the /dados dictionary. /sobre never mentions inflation.
- **Root cause:** `web/src/lib/data.ts` (carry-over around line 121) and the home page aggregations use raw `base`/`mdeV`.
- **Fix:** Add an IPCA annual deflator table (`web/src/data/ipca.json`) and a "R$ nominais / R$ de 2025 (IPCA)" toggle. Compute the saldo devedor and the cumulative rankings in constant reais by default. Add a "Valores monetários" paragraph to /sobre → Cálculos. Add `ipca_fator_2025` or real-value columns to the CSV.

### ACA-06 · major · data — CSV `faltou_rs` is 0 when it should be missing
- **URL:** /dados/csv/brasil (and per UF)
- **Steps:** `curl -s localhost:3210/dados/csv/brasil > br.csv`, then filter `situacao=nao_declarou`, then filter `mde_pct<25 & receita_impostos_rs==""`.
- **Expected:** Empty `faltou_rs` (NA) when nothing was declared or the base is unknown.
- **Actual:** All **626** `nao_declarou` rows have `faltou_rs=0`. Barra do Choça/BA 2021 (21,74%, no base) also has `faltou_rs=0`. In R/Stata, `0` reads as "met the minimum", which biases any analysis. The Explorar export gets the second case right (empty) but also puts `0` on nd rows.
- **Root cause:** `web/src/app/dados/csv/[uf]/route.ts`: `Math.round(shortfall(r)) || 0`, where `shortfall()` returns 0 when `mde`/`base` is null (`lib/format.ts:60`). `components/Explorer.tsx` export uses `row.short`, which is null only for the no-base case.
- **Fix:** Emit `""` when `r.s === "nd"`, or when `mde < 25 && base == null`. Use the same helper in both exports. Update the dictionary: "vazio = não estimável".

### ACA-07 · minor · content — "Declarado"/"apurado" labels don't match what is shown; pre-2020 R$ figures are estimates without a flag
- **URL:** /sp/santo-andre ("Ano a ano: Todos os valores declarados"), /dados dictionary (`mde_aplicado_rs: "Valor apurado em MDE"`)
- **Actual:** For 2008–2019 (66.249 CSV rows), `mde_aplicado_rs` is `base_reconstruída × %`. That is computed by the Radar, not declared. Raw SIOPE has no 8.2 before 2020 (verified for Santo André). "Apurado" is also the word /sobre reserves for Tribunal de Contas figures ("Declarado não é apurado").
- **Fix:** Rename the dictionary entry to "valor aplicado em MDE (declarado desde 2020; estimado = receita × % antes)". Add CSV columns `base_origem` (`siope_8.1` | `receitas_siope_somadas` | `siconfi`) and `aplicado_estimado` (0/1). Mark estimated cells in the city table (for example with a tooltip "≈").

### ACA-08 · minor · data — The two CSV exports differ and some indicators are left out
- **URL:** /dados/csv/brasil vs /explorar → "Exportar CSV"
- **Actual:** /dados has 19 columns with `situacao ∈ {declarou, nao_declarou}`. Explorar has 11 columns with `situacao ∈ {cumpriu, no limite, abaixo do mínimo, não declarou}` (accents and spaces). Neither exports `eduShare` (SIOPE 2.8, which is in the JSON), `alt` (SICONFI divergent %), a pandemic flag, or the per-year Fundeb leftover limit. There is no CSV for the **state governments** (`states.json`).
- **Fix:** One shared row builder in `lib/` used by both routes. ASCII snake_case codes (`cumpriu|limite|abaixo|nao_declarou|nao_existia`). Add `educacao_pct_despesa_total`, `mde_pct_siconfi`, `pandemia_ec119`, `fundeb_nao_usado_max_pct`, `aplicado_estimado`. Add `/dados/csv/estados`.

### ACA-09 · minor · content — Population is a single 2026 figure applied to every year
- **URL:** / ("Moram nesses municípios", for any year), /explorar (population filter), CSV `populacao`
- **Actual:** `pop` comes from SICONFI `entes` (`exercicio: 2026`) and is reused for 2008–2025. "Moram nesses municípios" for 2008 uses 2026 population. Population bands also shift over 18 years. The year is not documented anywhere.
- **Fix:** Document "população: SICONFI/IBGE, estimativa de 2026" in /sobre and the dictionary. Ideally add yearly IBGE estimates (`pop` per year) and use the matching year in aggregates and the CSV.

### ACA-10 · minor · content — /sobre statements that a reviewer would challenge
- **URL:** /sobre
- **Issues:**
  1. It lists "participação da educação no gasto total" as an indicator in use, but `eduShare` is never displayed anywhere (`grep eduShare` shows it only in the type definition).
  2. "O SICONFI também fornece o % aplicado em saúde (desde 2015)". Actual coverage is SP only and sparse: 2025: 283 municipalities, 2016: 111, other years 3–23. Every page outside SP still shows an all-"—" "Saúde" column (e.g. /ce/fortaleza).
  3. "Checagem cruzada **e anos anteriores**: SICONFI" is ambiguous. SICONFI is not used for earlier years.
  4. SIOPE indicator codes are not listed. Researchers need 1.1, 1.2, 1.4, 2.8, 4.9, 8.1 and 8.2 to replicate the series. I confirmed these codes and names live via the API.
  5. The mdeV/% consistency tolerance is 1 p.p. (`build_data.py:130`). 97 city-years show "Aplicado"/"Receita" that imply a % 0,5–1 p.p. away from the % displayed (e.g. Afonso Cunha/MA 2021 29,43% vs 30,01%).
- **Fix:** Add a "Indicadores SIOPE usados" table (code, official name, use in the panel). Correct the health sentence ("apenas municípios de SP, anos com RREO baixado: …") and hide the Saúde column when the municipality has no values. Either show eduShare or remove it from the text. Tighten the tolerance to 0,1 p.p. or show both figures.

### ACA-11 · minor · content — Nothing to cite: no reference for the Radar, no version, no license
- **URL:** /dados ("Como citar"), /sobre
- **Actual:** The page only says to cite the original sources "e, se quiser, o Radar MDE". It gives no author, year, URL, data version (the `updated` date exists in `meta.json`), licence or changelog.
- **Fix:** Add a ready-made ABNT reference and a BibTeX block, for example: `RADAR MDE · Brasil. Base de dados, versão 2026-10-07. Disponível em: <url>. Acesso em: …`. State a licence (e.g. CC BY 4.0 for derived data). Keep `meta.updated` plus the SIOPE extraction date per year. Publish a short CHANGELOG of data corrections.

### ACA-12 · minor · UI — Y-axis tick labels wrap or clip at 100 mil and above
- **URL:** /sp/adamantina, /rs/uniao-da-serra (per-student chart)
- **Actual:** "125 mil" is cut at the left edge; "100 mil", "150 mil" and "200 mil" wrap onto two lines. Reproduced on 2 cities.
- **Evidence:** `chart_sp_adamantina_Investim.png`, `chart_rs_uniao-da-serra_Investim.png`
- **Root cause:** `web/src/components/TrendChart.tsx:87` uses a fixed `width={unit === "%" ? 44 : 52}`.
- **Fix:** Compute the width from the longest formatted tick (`max(label.length) * 7 + 8`), or use a compact format ("100k"/"R$ 100 mil" with `tick={{ width: 70 }}`).

### ACA-13 · polish · data — CSV "abrem direto no Excel" is not true for Brazilian-locale Excel
- **URL:** /dados
- **Actual:** The files use comma separators and dot decimals, which is right for R/Stata/pandas. Excel with pt-BR settings expects `;` and decimal commas, so the claim on the page is misleading. This is standard Excel behaviour; I did not test it in Excel here. The BOM also makes base-R `read.csv` name the first column `X.U.FEFF.ibge` unless `fileEncoding="UTF-8-BOM"` is set.
- **Fix:** Reword the note: "vírgula como separador e ponto decimal (padrão internacional; no Excel em português use Dados → De texto/CSV)". Optionally add an `?formato=excel-br` variant with `;` and decimal commas. Add a one-line R and Stata import snippet (`readr::read_csv(...)`, `import delimited ..., encoding(utf8)`).

### ACA-14 · polish · content — EC 119 pandemic context is missing on Explorar and on the city MDE chart
- **URL:** /explorar?ano=2021, /sp/santo-andre (MDE chart)
- **Actual:** In 2021, 1.090 municipalities (20%) show a red "Abaixo" with no note. The city chart has no 2020–21 band, although the home "Evolução" chart has one.
- **Evidence:** `explorar_2021.png`
- **Fix:** When the selected year is 2020/2021, add a banner on Explorar: "EC 119/2022: sem punição se compensado até 2023". Add the same shaded band to `TrendChart` for MDE. In Explorar, show an "abaixo (EC 119)" status that is distinct from a plain shortfall.

### ACA-15 · polish · a11y — Critical badge contrast is 4,27:1
- **URL:** /sp/santo-andre (ranking panel badges "−4,0 p.p.")
- **Actual:** axe `color-contrast` (serious) on 2 nodes: `#da2f35` on `#fff0f0`.
- **Fix:** Darken `--critical` text inside soft badges (e.g. `#c4252b`) to reach at least 4,5:1.

### ACA-16 · polish · UI/content — Small text issues
- "Região imediata: **região imediata** São Paulo" duplicates the label (city header).
- In the home ranking, "R$/aluno (mediana)" shows half-real decimals ("R$ 14.173,5"); round to whole reais.
- "Fundeb pago aos profissionais" can exceed 100% (Rio Branco/AC 2023 103,65%; 113 city-years). Add a tooltip explaining why: spending of the previous year's leftover or own resources counted in the numerator.

## 3. Top 5 recommendations for this persona (prioritized)

1. **Fix gaps and missing values so the panel is clean for analysis** (ACA-01, ACA-06, ACA-02). Add a "não existia" status, use empty values instead of 0 for unknown shortfall, and use year-specific denominators. These silently bias any regression or count a researcher runs on the CSV.
2. **Add an inflation-adjusted view** (ACA-05). Add an IPCA deflator and a nominal/real toggle, compute saldo devedor and the cumulative rankings in constant 2025 reais, and add real-value CSV columns. Without this, every multi-year R$ figure is open to challenge.
3. **Flag atypical values instead of treating them as fact** (ACA-04). Use per-municipality outlier detection for per-student and MDE %, a visible "possível erro de preenchimento" marker, exclusion from medians, and a cross-check of per-student against Censo Escolar enrolments.
4. **Make the methodology replicable and citable** (ACA-07, ACA-10, ACA-11, ACA-09). List the SIOPE indicator codes, give the provenance of each R$ figure (declared or estimated), the population year, an ABNT/BibTeX citation, a licence and a data version/changelog. Use one documented CSV schema for both exports, plus a state-government CSV (ACA-08).
5. **Make year selection work all the way down to the municipality** (ACA-03), with a year picker on the city page. Add a comparison view (2–5 municipalities or states on one MDE/Fundeb/per-student chart, with export). This is the most common research task and currently means opening tabs side by side.

Artifacts: scripts `tour.mjs`, `map.mjs`, `charts.mjs`, `explorar.mjs`, `ano.mjs`, `ano2.mjs`, `misc.mjs`, `dados.mjs` and all screenshots in `qa/reports/academic/`.

## Round 2: re-validation (commit ff4a309, production build on :3299)

Method: same journeys on the production build at :3299. Scripts and screenshots are in `qa/reports/academic/r2/` (`tour.mjs`, `ano.mjs`, `checks.mjs`). I downloaded and parsed `/dados/csv/{brasil,sp-excel,estados,regiao-sul}` and the Explorar export. axe (wcag2a/aa) reports no violations on /sobre, /dados, /explorar, /sp/adamantina and /pa/mojui-dos-campos?ano=2010. No console or page errors.

### Status of round-1 findings

| ID | Status | Evidence |
|----|--------|----------|
| ACA-01 not-yet-existing municipalities | **FIXED** | Mojuí dos Campos ?ano=2010 shows the "Não existia em 2010" badge, "Sem posição em 2010: o município ainda não existia", and its table stops at 2013 with "instalado em 2013" (`r2/ano_pa_mojui-dos-campos_ano_2010.png`). In the CSV, `nao_declarou` falls from 626 to 584 rows. Rows per year: 5.564 (2008–12), 5.569 (2013–24), 5.570 (2025). /sobre lists the 6 municipalities. |
| ACA-02 no-data municipality | **FIXED** | Boa Esperança do Norte: neighbours list (Sorriso…, "1 sem dado neste ano"). The map explains the municipality is missing from the IBGE mesh. The template now says there is no record of filing and makes no compliance claim. |
| ACA-03 `?ano=` on município | **FIXED** | /sp/santo-andre?ano=2014 shows "MDE em 2014 20,53%", "Posição em 2014 (643º de 644)", "Onde fica · 2014", the year picker, and "Voltar para 2025". Clicking 2014 updates the URL. Invalid `?ano=1999`/`abc` falls back to 2025 (`r2/ano_sp_santo-andre_ano_2014.png`). |
| ACA-04 atypical values | **PARTIAL** | Data flags exist: mde 263, aluno 135, base 26. Adamantina 2021/23/24 and União da Serra 2023 get ⚠ in the table; Piaçabuçu, Cametá and Cabo Frio get "mde"; Explorar shows ⚠. Gaps: (a) the per-student **chart** has no marker on flagged points (`r2/chart_adamantina_aluno.png`). (b) Adamantina's "Sinais de alerta" leaves out its 3 atypical per-student years; Mojuí lists its MDE one. (c) 298 year-over-year per-student jumps of more than 2,5× are still unflagged, e.g. Rio Branco/AC 2022→2023 R$ 12.679 → R$ 34.493 and Corumbiara/RO R$ 18.472 → R$ 52.701. The rule compares to the municipality's median relative to the national median, so a one-off doubling inside the band passes. (d) The CONTRACT ("±2 neighbouring years") and /sobre / build_data ("relative to national median, own median") describe different rules. Align them. |
| ACA-05 nominal R$ | **PARTIAL** | /sobre now has "Valores monetários são nominais…" with an IPCA magnitude of about 2,6× for 2008–2025; I checked that figure against the yearly IPCA and it is right. Tables, KPIs and the dictionary say "R$ da época". No deflated view exists yet; it is on the roadmap. Saldo devedor and the cumulative rankings still sum nominal values. |
| ACA-06 `faltou_rs` 0 vs missing | **FIXED** | All 584 nd rows have empty `faltou_rs`. Barra do Choça 2021 is empty in both /dados and Explorar exports. |
| ACA-07 estimated "aplicado" | **FIXED** | "≈ R$ 239 mi aplicados (estimado)" on the KPI and ≈ in the table before 2020. CSV has `aplicado_estimado` (66.249 rows =1 before 2020, 516 after) and `base_origem`. |
| ACA-08 CSV schemas | **FIXED** | One vocabulary (`envio`, `situacao_mde`, `atipico`, `pandemia_ec119`, `educacao_pct_despesa_total`, `mde_pct_siconfi`…). The Explorar export uses a subset of the same column names. New `estados`, `regiao-*` and `-excel` variants. A new issue in the Explorar export is ACA-19. |
| ACA-09 population year | **PARTIAL** (documented) | /sobre and /dados now state "exercício 2026, a mesma para todos os anos". Population is still not yearly. |
| ACA-10 /sobre accuracy | **PARTIAL** | Fixed: SIOPE indicator table (1.1, 1.2, 1.4, 2.8, 4.9, 8.1, 8.2), the health sentence (325 SP municipalities, irregular), the per-student denominator, and 2.8 marked "só no CSV". Not fixed: municipality pages outside SP (e.g. /ce/fortaleza) still render an all-"—" **Saúde** column. |
| ACA-11 citation/licence/version | **PARTIAL** | Version `2026-10-07.586603bb`, extraction date, CC BY 4.0, and ABNT and BibTeX blocks are added. However, both references contain the literal placeholder **"[endereço do Radar MDE]"** and "Acesso em: dd mmm. aaaa." (ACA-18). |
| ACA-12 axis label clipping | **FIXED** | "125 mil" and "100 mil" fit on one line (`r2/chart_adamantina_aluno.png`). |
| ACA-13 Excel-BR / BOM | **FIXED** | `-excel` variant uses `;` and decimal commas (`25,68`). /dados gives R (`readr`), Stata and pandas (`utf-8-sig`) snippets. |
| ACA-14 EC 119 context | **FIXED** | Explorar 2021 banner "2021 foi ano de pandemia…" (`r2/explorar_2021.png`). The city MDE chart has a grey "EC 119" band. The 2020 alert says whether the gap was compensated by 2023. |
| ACA-15 badge contrast | **FIXED** | axe is clean on the city pages tested. |
| ACA-16 small text | **FIXED** | "Região imediata de São Paulo". No "R$ x,5" medians on the home page. Fundeb >100% is explained in the chart description and KPI. |
| ACA-17 (found in round 2, see below) | **FIXED** (re-verified after rebuild) | After the coordinator's fix (case handling in `proxy.ts`, clean rebuild): `/AC/Xapuri`, `/ac/Xapuri`, `/MG` and `/SP/Santo-Andre` return 308 **with a Location** to the lowercase URL. Afterwards `/sp/santo-andre`, `/mg`, `/rj`, `/ac/xapuri`, `/ac/feijo`, `/rr/caroebe` and `/rr/uiramuta` all return 200 (checked twice). In the browser, `/SP/Santo-Andre` lands on the right page (200), and `?ano=2014` renders 2014. |

Totals: **12 FIXED** (ACA-01, 02, 03, 06, 07, 08, 12, 13, 14, 15, 16, 17), **5 PARTIAL** (ACA-04, 05, 09, 10, 11), 0 NOT FIXED, 0 REGRESSED.

### New findings (round 2)

#### ACA-17 · blocker (local/self-hosted) · bug — Case-variant URLs poisoned the route cache and blanked canonical pages (**FIXED during round 2**)
- **URL:** :3299 `/sp/santo-andre`, `/mg` (also `/rj`, `/ac/xapuri`, `/ac/feijo`, `/rr/caroebe`, `/rr/uiramuta`)
- **Steps (before fix):** Request `/AC/Xapuri` or `/MG` once. Then GET `/ac/xapuri` or `/mg`, immediately or after the in-memory cache is evicted or the server restarts.
- **Expected:** The canonical page stays 200.
- **Actual:** The canonical URL answers **308 with no Location header**, and the body is a `__next_error__` shell containing `NEXT_REDIRECT;replace;/sp/santo-andre;308`. In the browser it showed a blank page titled "Página não encontrada" (`r2/santo-andre-308.png`). This affected the thesis's own city page.
- **Root cause:** The pages called `permanentRedirect()` for case variants (`app/[uf]/[slug]/page.tsx:95`, `app/[uf]/page.tsx:36`, `app/regiao/[slug]/page.tsx:37`). The 308 render was then persisted to `.next-prod/server/route-cache/APP_PAGE/<hash>/$/AC/Xapuri.meta`. macOS APFS is case-insensitive, so that is the same file as `ac/xapuri.meta`; found entries included `SP.meta`, `mg.meta`, `rj.meta`, `sp/santo-andre.meta` and `ac/xapuri.meta`, all with status 308.
- **Fix applied by coordinator:** Case normalisation now happens in `web/src/proxy.ts` and the page-level redirects are removed. **Re-verified FIXED** (see table). Suggested regression test: request `/MG` then `/mg` after a restart and expect 200.

#### ACA-18 · minor · content — The citation contains a placeholder URL and access date
- **URL:** /dados → "Como citar"
- **Actual:** ABNT reads "Disponível em: [endereço do Radar MDE]/dados. Acesso em: dd mmm. aaaa."; BibTeX reads `howpublished = {\url{[endereço do Radar MDE]/dados}}`. Meanwhile canonical/OG/sitemap fall back to `http://localhost:3210` (`lib/site.ts`), so the two fallbacks also differ.
- **Root cause:** `web/src/app/dados/page.tsx:22` uses its own `NEXT_PUBLIC_SITE_URL ?? "[endereço do Radar MDE]"` instead of `SITE_URL` from `lib/site.ts`.
- **Fix:** Import `SITE_URL` from `lib/site.ts`. Fill "Acesso em" with today's date formatted in pt-BR (client-side), or leave it out of the copyable block. Fail the production build, or warn, when `NEXT_PUBLIC_SITE_URL` is unset, so canonical/OG don't ship as localhost (currently `og:url`/`canonical` = `http://localhost:3210/...` on the :3299 build).

#### ACA-19 · minor · data — Explorar treats Boa Esperança do Norte as existing in 2008–2024
- **URL:** /explorar?ano=2021 → "Exportar CSV" → "Só 2021 · CSV padrão"
- **Actual:** The export has 5.570 rows, including `5101837,Boa Esperança do Norte,…,2021,,sem_dado,…`. The counter shows "5.570 de 5.570 municípios", while the KPI tile beside it says "5.569 todos os que existiam em 2021". /dados correctly omits the row.
- **Fix:** In `components/Explorer.tsx`, filter rows with `!existedIn(r, year)` out of the table, counter and export for the selected year. For the full-series export, skip years before `since`, matching `cityCsvRecords`.

#### ACA-20 · polish · UI — The OG image bar chart does not start at zero
- **URL:** `/sp/adamantina/opengraph-image` (`r2/og_adamantina.png`)
- **Actual:** The bars start from a non-zero floor, so 31,89% looks about 1,4× as tall as 25,68% when the real ratio is 1,24×. That exaggerates differences in a share card.
- **Fix:** Start bars at 0% (with the 25% dashed line), or draw a line or dots instead of bars when using a truncated range.

#### ACA-21 · polish · UI — Atypical values are not shown on the city charts or counted in alerts
(Detail of ACA-04 partial, logged so it can be tracked.) Flagged per-student points (Adamantina 2021, 2023, 2024) look the same as normal points on "Investimento por aluno", and "Sinais de alerta" leaves them out. **Fix:** In `TrendChart`, draw a hollow ⚠ dot with a tooltip "valor atípico — possível erro de declaração" for any year whose `atip` includes the metric. Add an alert line "Valor por aluno atípico em …" in `page.tsx`.
