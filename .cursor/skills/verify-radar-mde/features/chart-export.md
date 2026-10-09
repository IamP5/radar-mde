# Chart export

Each chart has an export menu: a PNG of the chart, a CSV of its rows, an Excel-style CSV, and a citation that names the chart and the page.

## Sub-features

- `chart-png` downloads a PNG of Santo André's MDE series.
- `chart-csv` downloads the rows behind that chart.
- `chart-cite` copies a citation that names Santo André.

## How to get to it (user POV)

- On a chart, choose the button whose name starts with `Exportar:`.
- The menu offers `Imagem PNG`, `Imagem SVG (editável)`, `Dados em CSV`, `Dados em CSV (Excel Brasil)`, and `Copiar citação`.
- The same menu is on the national, region, and state charts.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- Use Santo André's MDE chart so the button name contains `aplicado em MDE` and `Santo André`.

- **Open the chart.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser wait --role heading --name-regex "aplicado em educação"`.
- **Download the PNG.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Exportar: % da receita de impostos aplicado em MDE"`. Run `./scripts/control-radar-mde browser click --role menuitem --name "Imagem PNG" --exact --download chart-export/mde.png`. `download.bytes` is greater than zero. The status `PNG baixado` is visible: `./scripts/control-radar-mde browser wait --text "PNG baixado"`.
- **Download the CSV.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Exportar: % da receita de impostos aplicado em MDE"`. Run `./scripts/control-radar-mde browser click --role menuitem --name "Dados em CSV" --exact --download chart-export/mde.csv`. `download.bytes` is greater than zero. The file's first line contains `ano`.
- **Copy the citation.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Exportar: % da receita de impostos aplicado em MDE"`. Run `./scripts/control-radar-mde browser click --role menuitem --name "Copiar citação"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Radar MDE` and `Santo André`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path chart-export/cited.png` and `./scripts/control-radar-mde browser snapshot --aria --path chart-export/cited.aria.txt`. The screenshot shows the Radar MDE header and the MDE chart.

## Gotchas

- Several charts on the city page have an `Exportar:` button. The MDE one is the button whose name starts with `Exportar: % da receita de impostos aplicado em MDE`.
- `Dados em CSV` is also the start of `Dados em CSV (Excel Brasil)`. Use `--exact` on `Dados em CSV`.
- `PNG baixado` and `Citação copiada` are cleared after a short moment. Wait for the status in the same step as the click.
- `Compartilhar imagem…` is only offered on a phone that can share a file. At 1440×900 it is not in the menu.
- SVG is in the same menu. This recipe proves PNG, CSV, and the citation.
