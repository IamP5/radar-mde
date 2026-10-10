# Open data

Dados abertos is the download page for the whole base: Brazil, one region, one state, an Excel-style file, a compact JSON, a column dictionary, and a ready citation.

## Sub-features

- `data-home` downloads the Brazil CSV from the national panel.
- `data-page` shows Dados abertos and downloads the Excel-style Brazil file.
- `data-state` downloads São Paulo from the state list.
- `data-json` fetches the compact JSON.
- `data-dictionary` shows the column dictionary.
- `data-cite` shows the ABNT and BibTeX citations.

## How to get to it (user POV)

- Choose `Dados` in the header or the footer.
- Open `/dados`.
- On the national panel, choose `Baixar CSV`.
- On a state page, choose `Baixar CSV`. On a region page, choose `Baixar CSV da região`.
- From Metodologia, choose `Baixar os dados`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- A downloaded CSV's first line contains `municipio`. The JSON response is status 200.

- **Home CSV.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser click --role link --name "Baixar CSV" --exact --download open-data/home.csv`. `download.bytes` is greater than zero.
- **Open the page.** Run `./scripts/control-radar-mde browser open /dados`. A level-1 heading named `Dados abertos` is visible.
- **Excel-style Brazil file.** Run `./scripts/control-radar-mde browser click --role link --name "Excel Brasil" --exact --download open-data/brasil-excel.csv`. `download.bytes` is greater than zero.
- **São Paulo.** Run `./scripts/control-radar-mde browser click --role link --name-regex "São Paulo.*Baixar CSV" --download open-data/sp.csv`. `download.bytes` is greater than zero.
- **JSON.** Run `./scripts/control-radar-mde http get /data/municipios.json --save open-data/municipios.json`. The status is 200. Run `./scripts/control-radar-mde browser find --role link --name "JSON compacto"`. The count is 1.
- **Dictionary.** Run `./scripts/control-radar-mde browser wait --role heading --name "Dicionário"`. The text `municipio` is visible.
- **Citation.** Run `./scripts/control-radar-mde browser open /dados#citar`. A level-2 heading named `Como citar` is visible. The text `ABNT` is visible and the text `BibTeX` is visible.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path open-data/citar.png` and `./scripts/control-radar-mde browser snapshot --aria --path open-data/citar.aria.txt`. The screenshot shows the Radar MDE header and `Como citar`.

## Gotchas

- `JSON compacto` opens the JSON in the browser instead of saving a spreadsheet. Prove the file with `http get`, and use `find` for the link.
- `Baixar CSV` on the national panel is the Brazil file. A state page has its own `Baixar CSV` for that state. This recipe uses the panel link and the São Paulo card on `/dados`.
- The explorer's `Exportar CSV` is a different menu (the filtered rows). It is not this page.
- Region files on `/dados` are named `Região Norte` and so on, with a separate `Excel` link whose name ends in `CSV para Excel Brasil`. That is why the header link `Excel Brasil` is clicked with `--exact`. The region-page recipe covers the link `Baixar CSV da região`.
