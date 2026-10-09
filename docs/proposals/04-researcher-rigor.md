# Researcher rigor

## The problem

Three gaps show up when a researcher tries to defend a number.

The CSV on `main` has `mde_pct_siconfi` for São Paulo when that Treasury series differs from SIOPE by at least one percentage point. That column is not the audit court. The city page can show the thesis comparison for Santo André only, from `web/src/lib/thesis.ts`. [#7](https://github.com/IamP5/radar-mde/pull/7) draws an audit map for IBGE 3547809 and labels the source "TCE-SP, apuração citada em Silva (2021), UNINOVE, Figura 42". There is no column a person can download for the other São Paulo municipalities.

The Dados citation names FNDE/SIOPE, SICONFI, and IBGE. Silva 2021 is the study this panel is built from. It is not in the reference list.

[#5](https://github.com/IamP5/radar-mde/pull/5) splits CAQM with a fixed mix, creche 18, pré-escola 16, ensino fundamental 61, EJA 5. The screen already says the enrolment is not the census. The academic QA report asked for a cross-check against Censo Escolar. The INEP zip that would supply enrolment did not download from this VM.

## Personas and evidence

The academic report recomputed the Santo André thesis table and asked for indicator codes, a citation, and a census denominator (ACA recommendations on methodology and on per-pupil cross-check). A researcher who exports the CSV today can compare SIOPE with SICONFI for some São Paulo rows and cannot compare SIOPE with TCE-SP.

The thesis series and the Audesp file are not the same series. For Santo André, "Despesa Empenhada Ensino (%)" in the Audesp CSV is 0.25875 in 2016 (25.88%), 0.25827 in 2017 (25.83%), 0.26378 in 2018 (26.38%), and 0.25923 in 2019 (25.92%). `thesis.ts` has 21.87, 25.25, 26.37, and 25.92 for those years. 2019 matches at two decimals. 2018 differs by one hundredth (26.38 against 26.37). 2017 and 2016 do not match. Fundeb professionals in the same Audesp file are 80.62% in 2016, the same number `thesis.ts` stores for figure 40. That thesis field is commented as SIOPE/Inep, not as the audit court, so the match is a shared number, not a shared label. The education column must not be labeled figure 42. The SIOPE percent on the city page is a third series. In `cities.json`, Santo André 2019 is 25.35 and 2023 is 25.99.

The journalist needs the citation to name the study when the chart is the thesis comparison, and to keep FNDE as the source when the chart is SIOPE.

## Journey before

The researcher opens `/dados`, copies the ABNT block, and exports a CSV. The court series is missing. On Santo André they can read the thesis note. On any other São Paulo city they cannot.

On the CAQM screen they see a mix labeled as an assumption. They cannot replace it with census enrolment, because this project has not unpacked that file.

## Journey after

The CSV gains `mde_pct_tce_sp`. It is filled for São Paulo municipalities present in the Audesp file and left empty otherwise. The city page, next to the declared SIOPE percent, shows "TCE-SP, despesa empenhada com ensino" and the percent. The capital shows "sem dado (TCM-SP, não está neste arquivo)". Other states show nothing in that slot, not a zero.

On Santo André the page shows both numbers where both exist. The thesis line keeps the figure-42 label already used on [#7](https://github.com/IamP5/radar-mde/pull/7). The Audesp line uses the file's own column name. A short note can read "Em 2016, o arquivo do TCE-SP traz 25,88% e a série da dissertação traz 21,87%. São séries diferentes." The note does not assert that one series is liquidated expenditure. The zip did not include a dictionary that names the denominator. That limit stays visible.

The citation record from [note 1](01-letters-share-citation.md) gains a second source on pages that use the thesis:

"Silva, Adriana Zanini da (2021). Dissertação (Mestrado). Universidade Nove de Julho."

SIOPE charts keep FNDE/SIOPE as the first source. Silva does not replace it.

CAQM keeps 18/16/61/5 and the sentence "Não é o Censo." until a build machine downloads and unpacks the synopsis zip. The type below fails closed to that mix.

## Options

**A. Publish the thesis table as if it were the state-wide TCE column.**

It is one municipality, and several years disagree with the bulk file. A researcher would treat 21.87 and 25.88 as one fact.

**B. Add the Audesp column under its own name, and cite Silva beside it.**

The file downloaded. The coverage is explicit (644 municipalities, 2016 to 2025, capital absent). The thesis remains a cited study of Santo André.

**C. Wait for a TCE data dictionary, and ship nothing.**

The dictionary was not in the zip. Waiting blocks a column whose limits can be written next to the number. The label "despesa empenhada com ensino" is the header in the file, not a reconstruction of figure 42.

For the census mix, the options are narrower.

**D. Replace 18/16/61/5 with shares inferred from `mdeV / perAluno`.**

That ratio is the enrolment SIOPE already used. The academic report says so. It is not Censo Escolar. Labeling it as INEP would be false.

**E. Keep the assumption until the zip is unpacked, behind a type that refuses a silent fallback.**

This is the recommendation. A later change fills `EnrolmentByStage` from the synopsis. If the parse fails, the simulator shows the assumption and does not invent a municipal share.

## Recommendation

Option B for the court column and the citation. Option E for the mix.

The fetch script may land before the CSV edit. The column lands after both [#4](https://github.com/IamP5/radar-mde/pull/4) and [#6](https://github.com/IamP5/radar-mde/pull/6) have stopped moving `csv.ts`.

## Data sources

Audesp file, fetched 9 Oct 2026.

`https://transparencia.tce.sp.gov.br/conjunto-de-dados` returned 200. `https://transparencia.tce.sp.gov.br/sites/default/files/conjunto-dados/resultado_analises_audesp.zip` returned 200, `application/zip`, 480,158 bytes, last-modified 1 Oct 2026. The CSV is semicolon-separated, latin-1. Column "Despesa Empenhada Ensino (%)" is a fraction. 6,440 rows, 644 municipalities, years 2016 to 2025. IBGE 3550308 has zero rows.

Thesis PDF returned 200, 5,614,012 bytes, from the UNINOVE URL in the index. Use it as the bibliographic item. Do not retype tables out of the PDF into the repo. The Santo André series already lives in `thesis.ts`.

INEP synopsis catalog returned 200 and lists `https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_2024.zip` plus the 2023 and 2025 zips. The host did not complete a transfer from this VM. Do not name worksheets, columns, or a municipal enrolment figure from that zip.

SICONFI remains `mde_pct_siconfi`. Do not merge it into the TCE column.

## Types, modules, and routes

No new route. The column appears in `/dados` exports and on the city page beside the SIOPE percent.

```ts
/** Empty outside the Audesp file. Never 0 when unknown. */
type TceSpMde = { ibge: string; year: number; committedEducationPct: number | null };

type EnrolmentByStage = {
  source: "censo-escolar";
  year: number;
  ibge: string;
  shares: { creche: number; pre: number; ef: number; eja: number };
};

type StageMix = EnrolmentByStage | { source: "assumption"; shares: { creche: 0.18; pre: 0.16; ef: 0.61; eja: 0.05 } };
```

`scripts/fetch_tce_sp.py` downloads the zip and writes a small JSON keyed by IBGE and year. The build copies `committedEducationPct` into the CSV as `mde_pct_tce_sp`. Cities outside the file get an empty cell.

`StageMix` is what the CAQM simulator reads. Today every city is the assumption arm. The UI string stays "Não é o Censo." When `source` is `censo-escolar`, that string is replaced with the INEP year and the file name. There is no third arm that guesses.

Citation sources, using the record in [note 1](01-letters-share-citation.md):

```ts
const silva2021 = {
  name: "Silva, Adriana Zanini da (2021)",
  detail: "Dissertação (Mestrado), Universidade Nove de Julho",
};
```

Append `silva2021` only when the view quotes `thesis.ts` or the council sheet's figure-42 series.

## Risks and blast radius

[#4](https://github.com/IamP5/radar-mde/pull/4) and [#6](https://github.com/IamP5/radar-mde/pull/6) both extend the CSV schema, `build_data.py`, the Dados page, and the city header. Add `mde_pct_tce_sp` only after both have merged. A third edit of `CSV_COLUMNS` while either branch is still open will drop a column.

[#7](https://github.com/IamP5/radar-mde/pull/7) must keep the figure-42 label on the thesis series. This column is a different measurement. Showing only the Audesp number on Santo André would hide the series the thesis discusses.

[#5](https://github.com/IamP5/radar-mde/pull/5) owns `STAGES`, `DEFAULT_MIX`, and the "Não é o Censo." label. The mix change belongs on that branch. Do not start it until the zip has been unpacked on a machine where `download.inep.gov.br` works.

The fraction uses a comma in the file (`0,25875`). Parse it as a percent only after reading the comma. Writing 0.26 into a column named `mde_pct_tce_sp` would disagree with `mde_pct_siconfi`, which is already on a 0 to 100 scale. Store 25.88, not 0.2588.

São Paulo has 645 municipalities in IBGE and 644 rows in this file. The missing capital must be "sem dado", not dropped from the CSV.

## Size

Medium for the column and the city-page pair. Small for the Silva line, once the citation record exists. The census replacement is large if someone later ingests microdata, and it is blocked now. The synopsis, not the microdata, is the first file to try, because the catalog already points at a yearly zip. Microdata is out of scope until the synopsis is proven insufficient.

## Acceptance criteria

- The São Paulo CSV contains `mde_pct_tce_sp`. For Santo André 2019 the cell is 25.92, or 25,92 in the Brazilian Excel variant. For 2016 it is 25.88, not 21.87.
- The capital's cell is empty. The city page says TCM-SP.
- A non-São Paulo CSV has the column and every cell empty.
- The Santo André page shows the Audesp percent and the thesis percent as two labeled series.
- The Dados citation on a thesis view names Silva 2021 and still names FNDE/SIOPE for the declared series.
- The CAQM screen still shows the assumption and "Não é o Censo." No census share is hard-coded.

## Verification with verify-radar-mde

Update `features/open-data.md` and `features/municipality.md`. When #5 is merged, update the CAQM recipe the branch adds. Do not add a census assertion to that recipe in this change.

CSV. `./scripts/control-radar-mde http get /dados/csv/sp --save sp.csv`. The header contains `mde_pct_tce_sp`. The Santo André row matches the 2016 and 2019 values above. `http get /dados/csv/ba --save ba.csv` has the column and an empty cell on the first data row.

City. Open `/sp/santo-andre`. The accessible text contains "despesa empenhada com ensino" and the thesis figure. Open `/sp/sao-paulo`. The text contains "TCM-SP". Screenshot both.

Citation. On `/dados`, read the ABNT block after a thesis source is included. It contains `Silva` and `FNDE/SIOPE`.

CAQM, only if that route is on the branch under test. Open the Santo André CAQM page and confirm the visible text contains "Não é o Censo."

Then `cleanup` and `evidence list`.
