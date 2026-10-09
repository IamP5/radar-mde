# Explore municipalities

Explore is the national table. A person filters by name, state, and capitals, then downloads the filtered rows as CSV.

## Sub-features

- `explore-name` filters the table by municipality name and keeps the filter in the address.
- `explore-uf` restricts the table to one state.
- `explore-capital` restricts the table to state capitals.
- `explore-csv` downloads the filtered year as a standard CSV.

## How to get to it (user POV)

- Choose `Explorar` in the header.
- Choose `Explorar municípios` on the national panel.
- Open `/explorar`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The table has finished loading. After open, the page says `de` and `municípios`, not `Carregando municípios…`.

- **Open the table.** Run `./scripts/control-radar-mde browser open /explorar`. The level-1 heading is `Explorar municípios`. Wait with `./scripts/control-radar-mde browser wait --text-regex "[0-9.]+ de [0-9.]+ municípios"`.
- **Open from the panel.** Run `./scripts/control-radar-mde browser open /`. Then `./scripts/control-radar-mde browser click --role link --name "Explorar municípios"`. The URL path is `/explorar`.
- **Open from the header.** Run `./scripts/control-radar-mde browser click --role link --name "Explorar" --within-role navigation --within-name Principal`. The URL path is `/explorar`. `Explorar` is also a footer link, so the nav scope is required.
- **Filter by name.** Run `./scripts/control-radar-mde browser fill --role searchbox --name "Buscar município pelo nome" --value "Santo André"`. Then `./scripts/control-radar-mde browser wait --url-includes "q=Santo"`. The URL contains `q=Santo`. Both Santo André rows can appear until a state is chosen.
- **Choose São Paulo.** Run `./scripts/control-radar-mde browser click --role combobox --name "UF"`. Then `./scripts/control-radar-mde browser click --role option --name "São Paulo"`. The URL contains `uf=SP`. A link named `Santo André` remains. The Paraíba row does not.
- **Capitals.** Run `./scripts/control-radar-mde browser click --role button --name "Capitais"`. The URL contains `capital=1`. The button's accessible name includes the count (`Capitais 0` while the name filter excludes every capital) and its ARIA snapshot says `pressed`. Santo André drops out. `São Paulo` does not remain yet, because the name filter is still `Santo André`.
- **Clear the name, keep capitals.** Run `./scripts/control-radar-mde browser click --role button --name "Limpar busca"`. The URL keeps `uf=SP` and `capital=1` and drops `q`. A link named `São Paulo` remains. `Santo André` does not.
- **Download the year.** Run `./scripts/control-radar-mde browser click --role button --name "Exportar CSV"`. Then `./scripts/control-radar-mde browser click --role menuitem --name-regex "Só [0-9]{4} · CSV padrão" --download explore/year.csv`. The JSON `download.bytes` is greater than zero. The file is UTF-8 with a BOM, the first line starts with `ibge,municipio,uf`, and the data rows are the filtered capitals: here one row, `São Paulo`, `uf` `SP`, `capital` `1`, and no `Santo André`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path explore/capitals.png` and `./scripts/control-radar-mde browser snapshot --aria --path explore/capitals.aria.txt`.

## Gotchas

- The count line is not a heading. Wait on the text `de` … `municípios` after the numbers. While data is loading the line says `Carregando municípios…` and Exportar CSV is disabled.
- `Só <year> · CSV padrão` and `Série <start>–<end> · CSV padrão` both contain `CSV padrão`. Use the regex that starts with `Só` and a four-digit year.
- The year in that menu item is the exercise currently selected, not a fixed year. Do not hard-code it.
- Name filtering writes `q` after a short pause. `fill` can return before the URL updates. Wait for `q=Santo` before asserting the table.
- `Limpar busca` appears only while the name field is non-empty and clears only the name. `Limpar` clears every filter chip.
- With the name still set to `Santo André`, turning on capitals removes Santo André and does not reveal São Paulo. Clear the name before expecting the capital row.
- The capitals control's accessible name includes the facet count (`Capitais 1`). `--name "Capitais"` still matches.
