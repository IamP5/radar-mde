# W1 data contract (fix wave 1)

Owner: W1. All changes are **additive**: no existing field is removed or retyped. Status: **all implemented**, data
regenerated (2025: 23 below 25%, median 27,12% — unchanged). The dev server caches imported JSON; values appear after the coordinator restarts it.

## 1. Municipalities that did not exist yet (ACA-01, FUN-03)

`cities.json` / `City` (server, `@/lib/data`):

- `since?: number` — IBGE installation year. Present **only** on the 6 municipalities created after 2008:
  Mojuí dos Campos/PA 1504752, Pescaria Brava/SC 4212650, Balneário Rincão/SC 4220000,
  Paraíso das Águas/MS 5006275, Pinto Bandeira/RS 4314548 (all 2013); Boa Esperança do Norte/MT 5101837 (2025).
- Years **before `since` have no record** in `years` (previously `{s:"nd"}`). `c.years[y]` is `undefined` →
  existing `mdeStatus()` returns `"nodata"`. Never render these as "não declarou".
- Helper `existedIn(c: { since?: number }, year: number): boolean` (exported from `@/lib/rows`, re-exported by `@/lib/data`).
  Use it to render a neutral "não existia" (grey) cell/label: `!existedIn(c, y)` ⇒ "Município ainda não existia".
- Boa Esperança do Norte now has a single record (2025, `{s:"nd"}`).

`Row` (client rows, `@/lib/rows`, `/data/municipios.json`, UF page inline rows):
- `since?: number` — same as above.
- `aggregate()` (Stats) now **skips rows whose `since > year`**: `n`, `missing`, `pop` are year-specific
  (Brasil 2008–2012 n = 5.564, 2013–2024 n = 5.569, 2025 n = 5.570).
- `meta.json` → `nByYear: Record<year, number>` (municipalities that existed), `coverage` unchanged meaning (count with MDE).

## 2. Atypical values (ACA-04, JOR-08, GOV-04, GOV-12)

Per-year record field (`CityYear` type in `@/lib/rows`, = `YearRecord & {...}`; `City.years` uses it):
- `atip?: ("mde" | "aluno" | "base")[]` — flags, never drops the value:
  - `"mde"`: MDE % < 18 or > 45 (same rule as `isAtypical()` in format.ts).
  - `"aluno"`: per-student (SIOPE 4.9) < 0,4× or > 2,5× the median of the same municipality's neighbouring years (±2 years).
  - `"base"`: tax-revenue base < 0,4× or > 2,5× the median of neighbouring years (±2) → R$ shortfall is suspect.
- Labels: `ATIP_LABEL[code]` in `@/lib/rows` (pt-BR, e.g. "MDE fora da faixa usual (abaixo de 18% ou acima de 45%) — possível erro de declaração").
  Suggested UI wording: "valor atípico — possível erro de declaração".

`Row`:
- `atip?: number[]` — per published year a bitmask (`1` = mde, `2` = aluno, `4` = base; 0 = none). Omitted when the
  municipality has no flag at all. Helpers in `@/lib/rows`:
  - `atipOf(r: Row, yi: number): AtipCode[]`
  - `isAtip(r: Row, yi: number, code?: AtipCode): boolean` (no code = any flag)
- `Stats` gains (aggregates are otherwise **unchanged**: medians/sums still include atypical values):
  - `belowAtip: number` — municipalities below 25% whose record is flagged `mde` or `base`
  - `shortfallAtip: number` — part of `shortfall` (R$) coming from those records ("dos quais R$ Y em valores atípicos")

## 3. Capital & year-over-year change (JOR-07)

- `Row.capital?: true` (27 rows: 26 capitals + Brasília). Absent = not a capital.
- `deltaPp(r: Row, yi: number): number | null` in `@/lib/rows` → `mde[yi] − mde[yi−1]` in p.p. (null when either is missing).
  Not transported (computed on the fly).

## 4. Other per-year record fields (ACA-07, GOV-13)

- `mdeVEst?: 1` — `mdeV` (R$ aplicado) is **estimated** by the Radar (= receita × %), not declared (SIOPE 8.2 only exists from 2020).
  Show "≈"/"estimado".
- `baseSrc?: "receita" | "8.2" | "siconfi"` — how `base` was obtained; **omitted = SIOPE indicator 8.1** (the usual case,
  omitted to keep cities.json small); receita = sum of SIOPE revenue lines; 8.2 = R$ aplicado ÷ %; siconfi = Treasury annex 14.
- `inter`/`imediata`: IBGE typo "Juíz de Fora" fixed to "Juiz de Fora" (JOR-15).
- GOV-13: when the declared R$ applied (8.2) contradicts the declared % by > 1 p.p., `mdeV` is now the estimate
  `base × % / 100` flagged `mdeVEst: 1` (previously the field was dropped).

## 5. Meta (footer, /dados, /sobre) — `@/lib/data`

`export const META` (server) with:
- `version: string` — data version, e.g. `"2026-10-07.ab12cd34"` (build date + content hash).
- `updated: string` (ISO date of build; same as `UPDATED`), `extracted: string` (ISO date the raw SIOPE files were downloaded).
- `popYear: number` (2026 — population is one SICONFI/IBGE estimate applied to all years), `popSource: string`.
- `license: "CC BY 4.0"`, `licenseUrl`.
- `nByYear`, `coverage` (see §1).
- `dateBR(iso)` helper → "07/10/2026".
Footer suggestion: "Dados: SIOPE/FNDE extraídos em {extracted} · versão {version}". Also `web/src/data/version.json` = `{ "v": version }` (tiny, client-safe import).

## 6. CSV — one schema (`web/src/lib/csv.ts`, client-safe) (FUN-08/09/10, ACA-06/08/13, GOV-08/09, JOR-11)

- `CSV_COLUMNS: { key: string; label: string }[]` — full ordered dictionary (used by /dados).
- `cityCsvRecords(c: City, years: number[]): CsvRecord[]` (server, full data) — used by `/dados/csv/*`.
- `rowCsvRecord(r: Row, yi: number, years: number[]): CsvRecord` (client, from `Row`) — the **same column names and
  vocabulary**; columns that `Row` doesn't carry (receita, aplicado, Fundeb não usado, saúde, fonte…) are simply
  absent → use `ROW_CSV_COLUMNS` (ordered subset) as header for Explorer exports.
- `toCsv(columns: string[], records: CsvRecord[], opts?: { excel?: boolean }): string` — UTF-8 BOM included;
  `excel: true` ⇒ `;` separator and decimal comma ("Excel Brasil").
- `downloadCsv(filename, text)` (client helper: Blob + anchor).
- `csvFilename(parts: (string | number | null | undefined | false)[], excel?: boolean)` → `radar-mde_SP_2021_abaixo25.csv`.
- Vocabulary: `envio` = `declarou | nao_declarou`; `situacao_mde` = `cumpriu | limite | abaixo | nao_declarou | sem_dado`;
  `faltou_rs` **empty** when unknown (not declared, or below 25% with no tax base); `pandemia_ec119` 0/1; `capital` 0/1;
  `atipico` = codes joined by `|` (`mde|base`); `aplicado_estimado` 0/1; `delta_mde_pp`.
- The old /dados column `situacao` is renamed `envio` (it meant declared/not declared). Years before installation are absent.

Routes (`/dados/csv/[id]`):
- `brasil`, `<uf>` (as before), **new** `regiao-<slug>` (`regiao-norte|nordeste|centro-oeste|sudeste|sul`) and `estados`
  (state governments, 27 × years).
- Append `-excel` to any id for the Excel-Brasil variant: `/dados/csv/sp-excel`, `/dados/csv/regiao-sul-excel`.
- Helper `csvHref(id: string, excel?: boolean)` in `@/lib/csv`.
- The CSV route is now rendered on request and served gzip/br-compressed, memoised per process (Brasil: 17 MB → 3,2 MB br).
- `STATE_CSV_COLUMNS`, `stateCsvRecords(s, years)` for state governments.

## 7. `/data/*.json` transport (PERF-01/08)

- `/data/municipios.json`: same packed format; positions 0–10 unchanged, **appended** optional positions:
  11 `capital` (0/1), 12 `since` (0 = none), 13 `atip` (array of bitmasks or 0). `unpackRows` handles both old and new.
  `inter` is unchanged.
- Both routes now respond compressed (gzip/br by `Accept-Encoding`, memoised) with `ETag`;
  `loadAllRows()`/`loadIndex()` request `?v=<version>`, which is served `immutable` for a year.
