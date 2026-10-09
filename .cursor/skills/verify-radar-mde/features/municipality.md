# Municipality page

A municipality page is one city's education spending: the selected year, the indicators, the long series, where the city ranks, the neighbors, the source file for that year, and, for Santo André, the note that compares the page with the research it came from.

## Sub-features

- `city-open` shows Santo André and the state in the breadcrumb.
- `city-year` steps back one year and then returns to the latest exercise.
- `city-indicators` shows the four figures for that year.
- `city-series` shows the MDE series and the city's position.
- `city-place` shows where the city sits in the state and who the neighbors are.
- `city-alerts` shows the alert list for the whole series.
- `city-source` records the raw-file link for the selected year without leaving the page.
- `city-thesis` shows the research comparison on Santo André.
- `city-council` opens the council sheet for the selected year.

## How to get to it (user POV)

- Open `/sp/santo-andre`.
- Search the city and choose the São Paulo row.
- From the state table, choose the city's name.
- From Salvos, choose the city.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- Do not choose `Salvar`. Saving is the save-a-municipality recipe.

- **Open Santo André.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. The URL path is `/sp/santo-andre`. A level-1 heading named `Santo André` is visible. The navigation `Navegação territorial` contains `São Paulo`.
- **Step back, then return.** Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. The URL contains `ano=`. A button whose name starts with `Voltar para` is visible: `./scripts/control-radar-mde browser wait --role button --name-regex "Voltar para [0-9]{4}"`. Run `./scripts/control-radar-mde browser click --role button --name-regex "Voltar para [0-9]{4}"`. The URL no longer contains `ano=`.
- **Indicators.** Run `./scripts/control-radar-mde browser wait --role region --name-regex "Indicadores de [0-9]{4}"`. The region is visible.
- **Series and rank.** A level-2 heading whose name contains `aplicado em educação` is visible. A level-2 heading whose name starts with `Posição em` is visible: `./scripts/control-radar-mde browser wait --role heading --name-regex "Posição em [0-9]{4}"`.
- **Place and neighbors.** Run `./scripts/control-radar-mde browser wait --role heading --name-regex "Onde fica"`. Run `./scripts/control-radar-mde browser wait --role heading --name "Vizinhos"`.
- **Alerts.** Run `./scripts/control-radar-mde browser wait --role heading --name "Sinais de alerta"`.
- **Raw file.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Dados brutos de [0-9]{4} no SIOPE"`. The click's JSON `outbound` has an entry whose `kind` is `link` and whose `url` contains `fnde.gov.br`. Run `./scripts/control-radar-mde browser outbound`. That url is in `entries`. Run `./scripts/control-radar-mde browser url`. The path is still `/sp/santo-andre`.
- **Research note.** Run `./scripts/control-radar-mde browser wait --role heading --name "Comparação com a pesquisa"`.
- **Council sheet.** Run `./scripts/control-radar-mde browser click --role link --name "Ficha para o conselho" --exact`. The URL path is `/sp/santo-andre/conselho`. Run `./scripts/control-radar-mde browser wait --role heading --name "Ficha para o conselho"`. Run `./scripts/control-radar-mde browser open /sp/santo-andre` to come back for the proof.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path municipality/santo-andre.png` and `./scripts/control-radar-mde browser snapshot --aria --path municipality/santo-andre.aria.txt`. The screenshot shows the Radar MDE header and `Santo André`.

## Gotchas

- `Voltar para` followed by the year appears only after the selected year is not the one the page opened on. On the opening year the line says the charts show the whole series, and `Próximo ano` is disabled.
- `Salvar` sits next to `Compartilhar`. This recipe does not press it.
- `Simular o custo da qualidade` opens the municipal quality-cost simulation. That flow is the Radar CAQM recipe.
- `Comparação com a pesquisa` is on Santo André because that is the city in the research. Another city does not show that heading.
- The header control for the selected year is a button (`Dados brutos de <year> no SIOPE`). The click stays on the city page. `outbound` records the `fnde.gov.br` url. The year-by-year table repeats a link of a similar name for every year, so a link search is not one match. Those table links are not this step.
- Two cities are named Santo André. This recipe uses the address `/sp/santo-andre`.
