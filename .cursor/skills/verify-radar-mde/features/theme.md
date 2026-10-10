# Theme

The theme control switches Radar MDE between the light page, the dark page, and the system setting. The header button flips light and dark. The footer offers Sistema, Claro, and Escuro.

## Sub-features

- `theme-dark` turns the page dark from the header button.
- `theme-light` turns it light again from the footer.
- `theme-system` stores the system choice, which stays light while this browser asks for a light page.

## How to get to it (user POV)

- Use the moon or sun button at the right of the header. Its name is `Usar tema escuro` or `Usar tema claro`.
- Use the pill at the bottom of the footer labeled `Tema`: the buttons `Sistema`, `Claro`, `Escuro`. The current one is pressed.
- The choice is kept in this browser and comes back on the next page.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The browser asks for a light page, which is how this CLI opens Chromium. The header button therefore starts as `Usar tema escuro`.

- **Turn the page dark.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser click --role button --name "Usar tema escuro"`. The button is now `Usar tema claro`: `./scripts/control-radar-mde browser wait --role button --name "Usar tema claro"`. Run `./scripts/control-radar-mde browser storage get --key theme`. The value is `dark`. The footer button `Escuro` is the pressed one.
- **Proof of the dark page.** Run `./scripts/control-radar-mde browser screenshot --path theme/dark.png` and `./scripts/control-radar-mde browser snapshot --aria --path theme/dark.aria.txt`. The screenshot shows the Radar MDE header on a dark page.
- **Choose Claro.** Run `./scripts/control-radar-mde browser click --role button --name "Claro" --within-role group --within-name "Tema"`. The header button is `Usar tema escuro` again. `./scripts/control-radar-mde browser storage get --key theme` is `light`.
- **Choose Sistema.** Run `./scripts/control-radar-mde browser click --role button --name "Sistema" --within-role group --within-name "Tema"`. The stored value is `system`. The header button stays `Usar tema escuro` because the browser is asking for light.

## Gotchas

- Sistema and Claro look the same while the browser asks for a light page. Read `theme` to tell them apart. Do not treat the header label alone as proof of Sistema.
- The header button sets an explicit light or dark choice. It does not cycle through Sistema.
- The map hides the site header and footer, so these controls are not on `/mapa`. The map has its own sun and moon button; that control is part of the map, not this recipe.
