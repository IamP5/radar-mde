# Search

Search opens a municipality, state, or region from a name. Choosing a result lands on that place's page.

## Sub-features

- `search-home` opens the palette from the home field.
- `search-header` opens the palette from the header button.
- `search-keyboard` opens the palette with Ctrl+K.
- `search-city` opens Santo André in São Paulo, not the Santo André in Paraíba.

## How to get to it (user POV)

- Choose `Digite o nome da sua cidade` on the national panel.
- Choose the header button `Buscar município, estado ou região`.
- Press Ctrl+K, or `/` while focus is outside a field.
- On the map, choose the same header button. The map flies to the place instead of leaving `/mapa`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- No dialog is open. Run `./scripts/control-radar-mde browser open /` if the current URL is unknown.

- **Open from the home field.** Run `./scripts/control-radar-mde browser click --role button --name "Digite o nome da sua cidade"`. Then `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. The dialog's description says to type, use the arrows, and press Enter.
- **Type a city.** Run `./scripts/control-radar-mde browser fill --role combobox --name "Buscar" --value "santo andre"`. Options include two municipalities named Santo André.
- **Choose São Paulo.** Run `./scripts/control-radar-mde browser click --role option --name-regex "Santo André.*SP"`. The URL path is `/sp/santo-andre`. A level-1 heading named `Santo André` is visible.
- **Header entry.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser click --role button --name "Buscar município, estado ou região"`. The same dialog appears.
- **Keyboard entry.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser press --key Control+k`. The same dialog appears.
- **Map entry stays on the map.** Run `./scripts/control-radar-mde browser open /mapa`, wait for the application, then open the same header button and choose `Santo André.*SP`. The URL stays on `/mapa` and the hash is `#sp-3547809`. It is not `/sp/santo-andre`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path search/santo-andre.png` and `./scripts/control-radar-mde browser snapshot --aria --path search/santo-andre.aria.txt` on `/sp/santo-andre`. Recent searches are `./scripts/control-radar-mde browser storage get --key radar-mde:recent-search` and include `sp/santo-andre`.

## Gotchas

- Santo André exists in Paraíba (`/pb/santo-andre`) and São Paulo (`/sp/santo-andre`). An option name of only `Santo André` matches both and the click is refused. The São Paulo row's accessible name contains `SP`.
- Typing is accent-insensitive. `santo andre` finds `Santo André`.
- `/` typed while the combobox is focused goes into the query. Use Ctrl+K, or press `/` only when no field is focused.
- The dialog is not in the first paint. Wait for the dialog after the click before filling the combobox.
- On `/mapa`, choosing a result updates the map hash instead of navigating to the city page. Assert a city page only after search started from a page other than the map. The map hides the site header; its own search button has the same accessible name.
- The city heading's accessible name is `Santo André (São Paulo) SP`, not only `Santo André`. `--name "Santo André"` matches it. `--exact` does not.
- Recent searches are stored as JSON objects. `sp/santo-andre` is inside `id` (`c:sp/santo-andre`) and `href`, not as a bare string in the array.
