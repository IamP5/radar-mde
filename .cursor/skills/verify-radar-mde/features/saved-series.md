# Saved year strip

Salvos lists each saved municipality with one cell per year and a way to add another city. The cells name the year and the percent. This recipe starts from a city that is already saved and leaves the list empty again.

## Sub-features

- `saved-cells` shows Santo André's year cells.
- `saved-add` opens search from Adicionar.
- `saved-empty` returns to the empty list.

## How to get to it (user POV)

- Save a city, then choose `Salvos`.
- Each year is a cell named with the year and the percent, or with `não declarou` or `sem dados`.
- `Adicionar` opens search.
- With nothing saved, the page says `Nenhum município salvo` and offers `Explorar a lista`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- `./scripts/control-radar-mde seed watch list` reports `ids` as an empty array. Then run `./scripts/control-radar-mde seed watch add --id sp/santo-andre`. Saving from the city button is the save-a-municipality recipe. This recipe starts after that save.

- **Open Salvos.** Run `./scripts/control-radar-mde browser open /acompanhar`. A heading named `1 município` is visible. A link named `Santo André` is visible.
- **Year cells.** Run `./scripts/control-radar-mde browser snapshot --aria --path saved-series/cells.aria.txt`. The snapshot contains a name that starts with `2024:`.
- **Add.** Run `./scripts/control-radar-mde browser click --role button --name "Adicionar"`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser press --key Escape`.
- **Empty the list.** Run `./scripts/control-radar-mde browser click --role button --name "Remover Santo André dos salvos"`. The page shows `Nenhum município salvo`. A link named `Explorar a lista` is visible.
- **Proof of the empty list.** Run `./scripts/control-radar-mde browser screenshot --path saved-series/empty.png` and `./scripts/control-radar-mde browser snapshot --aria --path saved-series/empty.aria.txt`. The screenshot shows the Radar MDE header and `Nenhum município salvo`.
- **Stored list.** Run `./scripts/control-radar-mde browser storage get --key radar-mde:watch`. The value is `[]`.

## Gotchas

- The year cells are not buttons. Their names are in the ARIA snapshot (`2024:` and a percent, or a phrase such as `não declarou`). There is no role that targets a single cell.
- On a narrow window the same cities are cards instead of the wide table. At 1440×900 the wide table is the one on screen. The cards are not driven.
- `Adicionar` and the empty state's `Buscar município` both open the palette. Closing with Escape does not save a second city.
- Take the year-cell snapshot before `Remover`. The empty list is the restored baseline, not the proof of the cells.
- The header and the footer both link to Salvos. This recipe opens `/acompanhar` directly.
