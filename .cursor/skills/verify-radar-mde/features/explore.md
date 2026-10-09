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
- **Filter by name.** Run `./scripts/control-radar-mde browser fill --role searchbox --name "Buscar município pelo nome" --value "Santo André"`. The URL contains `q=Santo`. Both Santo André rows can appear until a state is chosen.
- **Choose São Paulo.** Run `./scripts/control-radar-mde browser click --role combobox --name "UF"`. Then `./scripts/control-radar-mde browser click --role option --name "São Paulo"`. The URL contains `uf=SP`. A link named `Santo André` remains. The Paraíba row does not.
- **Capitals.** Run `./scripts/control-radar-mde browser click --role button --name "Capitais"`. The URL contains `capital=1`. The button reports pressed. Santo André drops out because it is not a capital. `São Paulo` remains.
- **Download the year.** Run `./scripts/control-radar-mde browser click --role button --name "Exportar CSV"`. Then `./scripts/control-radar-mde browser click --role menuitem --name-regex "Só [0-9]{4} · CSV padrão" --download explore/year.csv`. The JSON `download.bytes` is greater than zero. The file's first line is a header.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path explore/capitals.png` and `./scripts/control-radar-mde browser snapshot --aria --path explore/capitals.aria.txt`.

## Gotchas

- The count line is not a heading. Wait on the text `de` … `municípios` after the numbers. While data is loading the line says `Carregando municípios…` and Exportar CSV is disabled.
- `Só <year> · CSV padrão` and `Série <start>–<end> · CSV padrão` both contain `CSV padrão`. Use the regex that starts with `Só` and a four-digit year.
- The year in that menu item is the exercise currently selected, not a fixed year. Do not hard-code it.
- Name filtering writes `q` after a short pause. Wait for `q=Santo` in the URL before asserting the table.
- `Limpar busca` appears only while the name field is non-empty. `Limpar` clears every filter chip.
