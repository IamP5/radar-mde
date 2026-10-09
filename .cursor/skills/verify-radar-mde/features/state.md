# State page

A state page shows that state's municipalities for the selected year: the indicators, the map, a searchable table, a CSV of the state, and a link into the national table already filtered to that state. The Distrito Federal has no separate state table; its address opens Brasília.

## Sub-features

- `state-open` shows São Paulo and the territorial breadcrumb.
- `state-year` steps the exercise back one year.
- `state-find` narrows the municipality table to Santo André.
- `state-population` keeps only municipalities above 500 thousand people.
- `state-metric` switches the state map to Fundeb.
- `state-csv` downloads the state's CSV.
- `state-explore` opens the national table already filtered to São Paulo.
- `state-df` opens Brasília from `/df`.

## How to get to it (user POV)

- Open `/sp`, or any other state sigla in lowercase.
- Search the state name and choose it.
- From a region page or the national panel, choose the state.
- From a municipality, choose the state in the breadcrumb.
- Open `/df` to land on Brasília.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The table on the state page has finished painting. The heading `São Paulo` is a level-1 heading.

- **Open São Paulo.** Run `./scripts/control-radar-mde browser open /sp`. The URL path is `/sp`. A level-1 heading named `São Paulo` is visible. A navigation named `Navegação territorial` is visible.
- **Step the year back.** Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. The URL contains `ano=`.
- **Find Santo André.** Run `./scripts/control-radar-mde browser fill --role textbox --name "Buscar município" --value "Santo André"`. The URL contains `q=Santo`. A link named `Santo André` is visible: `./scripts/control-radar-mde browser wait --role link --name "Santo André" --within-role main`.
- **Population band.** Run `./scripts/control-radar-mde browser click --role combobox --name "População"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "Mais de 500 mil"`. The URL contains `porte=p5`.
- **Fundeb on the state map.** Run `./scripts/control-radar-mde browser click --role radio --name "Fundeb" --within-role radiogroup --within-name "Indicador do mapa"`. The URL contains `indicador=fundeb`.
- **Download the state.** Run `./scripts/control-radar-mde browser click --role link --name "Baixar CSV" --within-role main --download state/sp.csv`. `download.bytes` is greater than zero. The file's first line contains `municipio`.
- **Open the filtered national table.** Run `./scripts/control-radar-mde browser click --role link --name "Explorar" --exact --within-role main`. The URL path is `/explorar` and the query contains `uf=SP`.
- **Distrito Federal.** Run `./scripts/control-radar-mde browser open /df`. The URL path is `/df/brasilia`. A level-1 heading named `Brasília` is visible.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path state/brasilia.png` and `./scripts/control-radar-mde browser snapshot --aria --path state/brasilia.aria.txt`. The screenshot shows the Radar MDE header and `Brasília`.

## Gotchas

- The header, the footer, and the state page all expose a link named `Explorar`. Scope the state action with `--within-role main` and `--exact`.
- `Buscar município` is the table field on the state page. The header search button has a longer name. Do not fill the palette.
- `/df` does not stay on a state table. It opens Brasília, the only municipality in the Distrito Federal.
- `Ano anterior` is disabled on the first published year. The page opens on a later year, so one step back is available.
- The population option's accessible name includes a count after the label. Match `Mais de 500 mil`, not the count.
