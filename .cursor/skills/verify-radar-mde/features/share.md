# Share a link

Compartilhar on a municipality page copies a link to that city. If a year other than the opening year is selected, the link keeps that year.

## Sub-features

- `share-copy` copies the city link.
- `share-year` keeps the selected year in the copied link.

## How to get to it (user POV)

- On a city page, choose `Compartilhar`, then `Copiar link`.
- `Enviar no WhatsApp` is in the same menu.
- The explorer has its own `Copiar link` for the filtered table. The map has `Copiar o link desta visão`. Those are separate recipes.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- Start from the city's opening year, so `ano` is absent until the recipe steps back.

- **Step the year back.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. The URL contains `ano=`.
- **Copy the link.** Run `./scripts/control-radar-mde browser click --role button --name "Compartilhar"`. Run `./scripts/control-radar-mde browser click --role menuitem --name "Copiar link"`. The button is now `Link copiado`: `./scripts/control-radar-mde browser wait --role button --name "Link copiado"`.
- **Read the clipboard.** Run `./scripts/control-radar-mde browser clipboard`. The text contains `/sp/santo-andre` and `ano=`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path share/copied.png` and `./scripts/control-radar-mde browser snapshot --aria --path share/copied.aria.txt`. The screenshot shows the Radar MDE header and `Link copiado`.

## Gotchas

- `Link copiado` returns to `Compartilhar` after a short moment. Read the clipboard before that.
- `Enviar no WhatsApp` opens a chat on another site. This recipe does not follow it. There is no command that asserts a second window.
- On the opening year the copied link has no `ano`. Step back first when the year must be in the link.
- The map hides this menu. Copying a map view is the map-controls recipe.
