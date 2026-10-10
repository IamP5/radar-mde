# Table filters

Beyond the name, the state, and the capitals toggle, the national table filters by region, population, situation, and how often a city fell short, changes the exercise, sorts a column, copies the filtered address, and downloads the series or the Excel-style file. A combination that matches nobody shows an empty table.

## Sub-features

- `filters-region` keeps the Nordeste.
- `filters-population` keeps municipalities of 5 to 20 thousand people.
- `filters-situation` keeps municipalities below 25%.
- `filters-recurrence` keeps municipalities below 25% in three or more years.
- `filters-year` moves the exercise to 2020, a pandemic year.
- `filters-sort` sorts by municipality name.
- `filters-link` copies the address of that view.
- `filters-series` downloads the full series for the filtered rows.
- `filters-clear` clears the filters.
- `filters-empty` shows the empty table and clears it.

## How to get to it (user POV)

- Choose `Explorar` and use `Região`, `População`, `Situação em`, `Reincidência`, and `Exercício`.
- Choose a column heading, such as `Município`, to sort.
- Choose `Copiar link` to copy the filtered address.
- Choose `Exportar CSV`, then a series or Excel item.
- `Limpar` removes the filter chips. An empty result offers `Limpar filtros`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The table has finished loading. After open, the page says `de` and `municípios`, not `Carregando municípios…`.
- Name, UF, capitals, and the single-year standard CSV are the explore-municipalities recipe. This recipe does not repeat them.

- **Open the table.** Run `./scripts/control-radar-mde browser open /explorar`. Wait with `./scripts/control-radar-mde browser wait --text-regex "[0-9.]+ de [0-9.]+ municípios"`.
- **Region.** Run `./scripts/control-radar-mde browser click --role combobox --name "Região"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "^Nordeste"`. The URL contains `regiao=nordeste`.
- **Population.** Run `./scripts/control-radar-mde browser click --role combobox --name "População"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "^5 a 20 mil"`. The URL contains `porte=p2`.
- **Situation.** Run `./scripts/control-radar-mde browser click --role combobox --name-regex "^Situação em"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "^Abaixo de 25% \\(\\d"`. The URL contains `situacao=abaixo`.
- **Recurrence.** Run `./scripts/control-radar-mde browser click --role combobox --name "Reincidência"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "^3\\+ anos abaixo"`. The URL contains `reinc=3`.
- **Year 2020.** Run `./scripts/control-radar-mde browser click --role combobox --name "Exercício"`. Run `./scripts/control-radar-mde browser click --role option --name "2020" --exact`. The URL contains `ano=2020`. The text `2020 foi ano de pandemia` is visible.
- **Sort by name.** Run `./scripts/control-radar-mde browser click --role button --name "Município" --exact`. The URL contains `ordem=nome`.
- **Copy the view.** Run `./scripts/control-radar-mde browser click --role button --name "Copiar link"`. Run `./scripts/control-radar-mde browser wait --role button --name "Link copiado"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `regiao=nordeste`, `porte=p2`, `situacao=abaixo`, `reinc=3`, and `ano=2020`.
- **Series CSV.** Run `./scripts/control-radar-mde browser click --role button --name "Exportar CSV"`. Run `./scripts/control-radar-mde browser click --role menuitem --name-regex "Série [0-9]{4}–[0-9]{4} · CSV padrão" --download table-filters/series.csv`. `download.bytes` is greater than zero. The file's first line contains `municipio`.
- **Clear.** Run `./scripts/control-radar-mde browser click --role button --name "Limpar" --exact`. Run `./scripts/control-radar-mde browser url`. The query no longer contains `regiao=` or `porte=`.
- **Empty table.** Run `./scripts/control-radar-mde browser fill --role searchbox --name "Buscar município pelo nome" --value "xyzxyzxyz"`. Run `./scripts/control-radar-mde browser wait --text "Nenhum município com esses filtros"`. Run `./scripts/control-radar-mde browser click --role button --name "Limpar filtros"`. The count line with `municípios` is back: `./scripts/control-radar-mde browser wait --text-regex "[0-9.]+ de [0-9.]+ municípios"`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path table-filters/cleared.png` and `./scripts/control-radar-mde browser snapshot --aria --path table-filters/cleared.aria.txt`. The screenshot shows the Radar MDE header and `Explorar municípios`.

## Gotchas

- `Abaixo de 25%` is also the start of `Abaixo de 25% e Fundeb < 70%` (or `< 60%` through 2020). The option regex must require the count in parentheses right after `Abaixo de 25%`, as in `Abaixo de 25% (1.234)`.
- Option names include a count. Do not use `--exact` on `Nordeste` or `5 a 20 mil`.
- `Mais de 500 mil` together with `Abaixo de 25%` matches no municipality, and `Exportar CSV` stays disabled on an empty table. `5 a 20 mil` in the Nordeste still has rows in 2020, so the series download can run.
- `Só <year> · CSV padrão` is the explore-municipalities recipe. This recipe downloads the item that starts with `Série`.
- `Limpar` removes the filter chips. It does not reset the exercise or the sort. The empty-table button is `Limpar filtros`, a different control.
- The name filter writes `q` after a short pause. Wait for the empty sentence before clearing.
- `Link copiado` returns to `Copiar link` after a short moment. Read the clipboard in the same step.
