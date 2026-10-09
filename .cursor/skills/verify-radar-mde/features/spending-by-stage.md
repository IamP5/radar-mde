# Spending by stage

A city, a state, a region, and Brasil can show where education spending went in the selected year. The figures are per student or a share of spending. A missing figure says `sem dado`. The explorer can add three of those columns, and the data page lists the new CSV columns.

## Sub-features

- `stage-city` shows the city panel for the selected year, with nominal or IPCA values, the share bar, and the stage chart.
- `stage-thesis` adds one sentence on Santo André about Figure 39 of the Silva thesis.
- `stage-national` shows the Brasil medians on the national panel.
- `stage-region` shows the region median next to Brasil.
- `stage-state` shows the state median next to Brasil.
- `stage-explorer` adds creche, fundamental, and EJA to the table and sorts them.
- `stage-data` lists the columns in the dictionary and fills them in the CSV.

## How to get to it (user POV)

- Open `/sp/santo-andre`.
- Open the national panel `/`.
- Open a region, for example `/regiao/sudeste`.
- Open a state, for example `/sp`.
- Choose `Explorar` or open `/explorar`.
- Open `/dados` for the dictionary, or download a state CSV.
- Open `/sobre` and go to the SIOPE indicator table.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- These steps use 2023 so the creche figure is present. The page may open on a later year where creche says `sem dado`.

- **Open Santo André in 2023.** Run `./scripts/control-radar-mde browser open "/sp/santo-andre?ano=2023#etapas"`. The URL path is `/sp/santo-andre`. Run `./scripts/control-radar-mde browser wait --role heading --name "Para onde vai o dinheiro"`. The heading is visible. Run `./scripts/control-radar-mde browser wait --role region --name "Para onde vai o dinheiro"`. The panel region is named. Run `./scripts/control-radar-mde browser wait --text-regex "15[.]257"`. The text `15.257` is visible. The text `16.666` is visible. The text `15.351` is visible. The text `sem dado` is visible. The text `Demais etapas` is visible. The text `Parte do gasto com educação` is visible. The text `mediana de São Paulo` is visible. The text `40,02%` is visible. The text `valor distante do padrão deste município, confirme na fonte` is visible. The text `Figura 39` is visible. A link named `Ler a tese` is visible. A link named `Creche, pré-escola e as outras etapas` is visible.
- **Nominal is the default.** Run `./scripts/control-radar-mde browser find --role radio --name "Da época"`. The count is 1. The radio is checked.
- **Correct by IPCA.** Run `./scripts/control-radar-mde browser click --role radio --name "Corrigido pelo IPCA"`. The radio is checked. Run `./scripts/control-radar-mde browser wait --text-regex "16[.]722"`. The text `16.722` is visible. Run `./scripts/control-radar-mde browser click --role radio --name "Da época"`. Run `./scripts/control-radar-mde browser wait --text-regex "15[.]257"`. The text `15.257` is visible again.
- **Chart export.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Exportar: Gasto por etapa"`. Then `./scripts/control-radar-mde browser click --role menuitem --name "Dados em CSV" --exact --download spending/etapas.csv`. `download.bytes` is greater than zero. The file's first line contains `ano,por_aluno_creche_rs` (a byte-order mark may sit in front of `ano`). A line that starts with `2023` contains `15257`. The name is exact because `Dados em CSV (Excel Brasil)` is a second item.
- **National medians.** Run `./scripts/control-radar-mde browser open "/?ano=2023"`. Run `./scripts/control-radar-mde browser wait --role heading --name "Para onde vai o dinheiro"`. Run `./scripts/control-radar-mde browser wait --role radiogroup --name "Valores por etapa"`. The text `10.409` is visible. The text `não é uma cidade` is visible.
- **Region next to Brasil.** Run `./scripts/control-radar-mde browser open "/regiao/sudeste?ano=2023"`. A level-1 heading named `Região Sudeste` is visible. The heading `Para onde vai o dinheiro` is visible. The text `11.150` is visible. The text `mediana do Brasil` is visible. The text `10.409` is visible.
- **São Paulo next to Brasil.** Run `./scripts/control-radar-mde browser open "/sp?ano=2023"`. A level-1 heading named `São Paulo` is visible. The heading `Para onde vai o dinheiro` is visible. The text `14.092` is visible. The text `10.409` is visible.
- **Explorer columns.** Run `./scripts/control-radar-mde browser open "/explorar?ano=2023&uf=SP&q=Santo%20André"`. Run `./scripts/control-radar-mde browser wait --text-regex "[0-9.]+ de [0-9.]+ municípios"`. Run `./scripts/control-radar-mde browser wait --url-includes "uf=SP"`. Run `./scripts/control-radar-mde browser click --role button --name "Mostrar gasto por etapa"`. The button is pressed. Run `./scripts/control-radar-mde browser wait --role button --name "Creche"`. A column button named `Fundamental` is visible. A column button named `EJA` is visible. Run `./scripts/control-radar-mde browser wait --text-regex "15[.]257"`. The text `15.257` is visible. Run `./scripts/control-radar-mde browser click --role button --name "Creche"`. The column header's ARIA sort is `descending`.
- **Phone.** Run `./scripts/control-radar-mde browser viewport --preset phone`. A link named `Santo André` is visible. Run `./scripts/control-radar-mde browser find --role button --name "Creche" --include-hidden`. The count is 1. Run `./scripts/control-radar-mde browser viewport --preset desktop`. The width is 1440 and the height is 900.
- **Dictionary.** Run `./scripts/control-radar-mde browser open /dados`. Run `./scripts/control-radar-mde browser wait --role heading --name "Dicionário"`. The text `por_aluno_creche_rs` is visible. The text `O 0 é tratado como ausente` is visible.
- **State CSV.** Run `./scripts/control-radar-mde http get /dados/csv/sp --save spending/sp.csv`. The status is 200. The saved file's first line contains `por_aluno_creche_rs` and `educacao_infantil_pct`. A line that contains `3547809` and `2023` contains `15257`.
- **Methodology.** Run `./scripts/control-radar-mde browser open /sobre`. Run `./scripts/control-radar-mde browser wait --role heading --name "Indicadores do SIOPE usados"`. The text `4.14` is visible. The text `de 2011 a 2024` is visible. The text `de 2011 a 2025` is visible. The text `Censo Escolar` is visible.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path spending/sobre.png` and `./scripts/control-radar-mde browser snapshot --aria --path spending/sobre.aria.txt`. The screenshot shows the Radar MDE header and `Indicadores do SIOPE usados`.

## Gotchas

- `sem dado` is the missing value. When either share is missing, or the two shares sum past 100, the panel shows `sem dado` and leaves the bar out. `Demais etapas` can be 0%.
- `Da época` is the nominal default. `Corrigido pelo IPCA` changes the money figures. Percents stay as declared.
- Creche and pré-escola are absent from the earliest years. In the current base, 4.14 occurs from 2011 to 2024 and 4.15 from 2011 to 2025.
- `Para onde vai o dinheiro` is the heading on the city, the national panel, the region, and the state. The radiogroup is `Valores por etapa`.
- The thesis sentence and `Ler a tese` are on Santo André only. Two cities are named Santo André. This recipe uses `/sp/santo-andre`.
- `valor distante do padrão deste município, confirme na fonte` on Santo André in 2023 sits on material didático. The figure stays on the page. The comparison line says `mediana de São Paulo` and `mediana do Brasil`, with `(acima)` or `(abaixo)` when both numbers exist.
- `Da época` is the radio. The panel also says that those are the reais of that year, and that `Corrigido pelo IPCA` does not change percents. In the latest year the two money figures match.
- A missing year keeps the words `sem dado` and adds the last year that has a figure, when one exists. Creche in 2025 names that last year.
- The explorer columns stay out of the table until `Mostrar gasto por etapa` is pressed. The first press loads them. Pressing it again hides the columns and keeps what was loaded.
- On a phone the three columns sit in the scrolling table. The municipality name stays. This recipe returns the window to 1440×900.
- The Distrito Federal state address redirects to the Brasília city page. The state step uses `/sp`.
- A missing stage in the CSV is an empty cell.
