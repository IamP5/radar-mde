# National panel

The national panel shows whether Brazilian municipalities applied at least 25% of tax revenue to education, for the selected year, and lets a person move to a region.

## Sub-features

- `panel-open` shows the Brasil heading and the Radar MDE header.
- `panel-year` moves the selected exercise back one year and keeps it in the address.
- `panel-region` opens a region from the region card.

## How to get to it (user POV)

- Open the site root.
- Choose `Painel` in the header.
- Choose `Radar MDE` in the header.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The browser profile has no saved municipalities.

- **Open the panel.** Run `./scripts/control-radar-mde browser open /`. The URL path is `/`. A heading named `A educação recebe o que a Constituição manda?` is visible. The header link `Radar MDE BR` is visible.
- **Header Painel.** From another page, run `./scripts/control-radar-mde browser click --role link --name "Painel" --within-role navigation --within-name Principal`. The URL path is `/`.
- **Header logo.** Run `./scripts/control-radar-mde browser click --role link --name "Radar MDE BR"`. The URL path is `/`. The same level-1 heading is visible.
- **Step the year back.** Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. The URL contains `?ano=`. The region named `Indicadores de` followed by that year is visible: `./scripts/control-radar-mde browser wait --role region --name-regex "Indicadores de [0-9]{4}"`.
- **Open Sudeste.** Run `./scripts/control-radar-mde browser click --role link --name "Sudeste:"`. The click's JSON `url` path is `/regiao/sudeste`. A level-1 heading named `Região Sudeste` is visible.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path panel/sudeste.png` and `./scripts/control-radar-mde browser snapshot --aria --path panel/sudeste.aria.txt`. The screenshot shows the Radar MDE header and `Região Sudeste`.

## Gotchas

- `Ano anterior` is disabled on the first published year. The panel opens on the latest year with broad coverage, so one step back is available.
- The selected year is the default when `ano` is absent. After one step back the query is `?ano=` plus the year.
- Region cards are links whose accessible name starts with the region, a colon, and the share below 25% (`Sudeste:`). Match the colon so the link is not confused with a sentence that merely contains the word.
- Phone and desktop header bars are both in the page. At 1440×900 the phone bar is not visible and is not clicked.
- `Painel` is also a footer link. Without `--within-role navigation --within-name Principal` the click is refused because two links match.
- The header logo's accessible name is `Radar MDE BR` (the BR badge is part of the name). The footer link is `Radar MDE · Brasil`. `--name "Radar MDE"` matches both and is refused.
- The first visit to `/regiao/sudeste` compiles. The click waits for that navigation and returns the destination URL.
