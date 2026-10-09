# Recent searches

After a person opens a place from search, that place is offered again at the top of the palette under Recentes, until they type a new query.

## Sub-features

- `recent-store` keeps Santo André (São Paulo) in this browser after it is chosen.
- `recent-open` opens that city again from Recentes, with the field empty.
- `recent-hide` hides Recentes as soon as the field has text.
- `search-miss` says there is no match for a name that is not a place.

## How to get to it (user POV)

- Search once, close the palette, and open it again from the header, from `Digite o nome da sua cidade`, or with Ctrl+K.
- With the field empty, the first group is `Recentes`.
- Type anything and Recentes leaves. A name that matches nothing shows `Nenhum resultado`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- No dialog is open. Run `./scripts/control-radar-mde browser open /` first.

- **Choose Santo André in São Paulo.** Run `./scripts/control-radar-mde browser click --role button --name "Digite o nome da sua cidade"`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser fill --role combobox --name "Buscar" --value "santo andre"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "Santo André.*SP" --timeout 90000`. The click's JSON `url` path is `/sp/santo-andre` and `navigated` is true.
- **Read the stored recent.** Run `./scripts/control-radar-mde browser storage get --key radar-mde:recent-search`. The value contains `sp/santo-andre`.
- **Open Recentes.** Run `./scripts/control-radar-mde browser press --key Control+k`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser wait --text "Recentes"`. An option whose name contains `Santo André` and `SP` is visible.
- **Open it again.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser press --key Control+k`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "Santo André.*SP" --timeout 90000`. The click's JSON `url` path is `/sp/santo-andre` and `navigated` is true.
- **Hide Recentes and miss.** Run `./scripts/control-radar-mde browser press --key Control+k`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser fill --role combobox --name "Buscar" --value "xyzxyzxyz"`. Run `./scripts/control-radar-mde browser wait --text-regex "Nenhum resultado para"`. Run `./scripts/control-radar-mde browser find --role option --name-regex "Santo André"`. The count is 0.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path recent-searches/no-match.png` and `./scripts/control-radar-mde browser snapshot --aria --path recent-searches/no-match.aria.txt`. The screenshot shows the Radar MDE header behind the dialog and the text `Nenhum resultado`.

## Gotchas

- Recentes is drawn only while the field is empty. Filling the field before the click removes the recent option, and the click is refused.
- Santo André also exists in Paraíba. The option name must contain `SP`.
- A short query can fuzzy-match a real city (`Você quis dizer…`) instead of showing `Nenhum resultado`. `xyzxyzxyz` does not match a municipality.
- Choosing a place from the map search flies the map and still stores a recent. Assert the city page only when search started away from `/mapa`.
- Opening the recent city from the page that is already that city does not change the URL. Start `recent-open` from another page, such as `/`, so `navigated` is true.
