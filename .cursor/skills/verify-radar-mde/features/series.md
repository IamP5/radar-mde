# Series indicator

On the national panel the long chart can show three indicators: the share of municipalities below 25%, the reais that fell short, and the median MDE. The choice is the same in the bar above the page and in the tabs on the chart.

## Sub-features

- `series-shortfall` shows the reais that fell short.
- `series-median` shows the median MDE.
- `series-share` returns to the share below 25%.

## How to get to it (user POV)

- On the national panel or a region page, use the control named `Indicador da série` in the bar (`% abaixo de 25%`, `R$ que faltou`, `MDE mediana`).
- Or choose the matching tab on the chart `Evolução`.
- The selected year still comes from the year control. Changing the indicator does not change the year.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The window is 1440×900, so the bar of radios and the chart tabs are both visible.

- **Open the panel.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser wait --role heading --name-regex "Evolução [0-9]{4}"`.
- **Reais that fell short.** Run `./scripts/control-radar-mde browser click --role radio --name "R$ que faltou" --within-role radiogroup --within-name "Indicador da série"`. The export button for that chart is named with `R$ que faltou`: `./scripts/control-radar-mde browser wait --role button --name-regex "Exportar: R. que faltou"`.
- **Median.** Run `./scripts/control-radar-mde browser click --role tab --name-regex "MDE mediana"`. Run `./scripts/control-radar-mde browser wait --role button --name-regex "Exportar: MDE mediana"`.
- **Share below 25%.** Run `./scripts/control-radar-mde browser click --role radio --name "% abaixo de 25%" --within-role radiogroup --within-name "Indicador da série"`. Run `./scripts/control-radar-mde browser wait --role button --name-regex "Exportar: % de municípios abaixo de 25%"`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path series/share.png` and `./scripts/control-radar-mde browser snapshot --aria --path series/share.aria.txt`. The screenshot shows the Radar MDE header and the evolução chart.

## Gotchas

- Two controls are named `Indicador da série`: a radiogroup in the bar and a tablist on the chart. The short labels (`R$ que faltou`, `MDE mediana`, `% abaixo de 25%`) are the radios. The tabs use the longer names (`MDE mediana (%)`, `% de municípios abaixo de 25%`).
- The indicator is not written into the address. The proof is the export button's name, which follows the selected indicator.
- Stepping the year is the national-panel recipe. This recipe does not press `Ano anterior`.
