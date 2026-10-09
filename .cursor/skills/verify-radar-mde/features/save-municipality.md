# Save a municipality

Save a municipality keeps Santo André (São Paulo) in this browser and shows it again under Salvos.

## Sub-features

- `save-find` reaches the city page from the home search field.
- `save-add` marks the city saved.
- `save-list` shows the city on the Salvos page.
- `save-remove` drops it so the list is empty again.

## How to get to it (user POV)

- Search for the city and open it, then choose `Salvar`.
- Open `/sp/santo-andre` and choose `Salvar`.
- Choose `Salvos` in the header to see the list.
- On the list, choose `Remover Santo André dos salvos`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- `./scripts/control-radar-mde seed watch list` reports `ids` as an empty array. A fresh launch already does. If it does not, run `./scripts/control-radar-mde seed watch clear`.

- **Open search from the panel.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser click --role button --name "Digite o nome da sua cidade"`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`.
- **Find Santo André in São Paulo.** Run `./scripts/control-radar-mde browser fill --role combobox --name "Buscar" --value "santo andre"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "Santo André.*SP"`. The URL path is `/sp/santo-andre`. Wait with `./scripts/control-radar-mde browser wait --role heading --name "Santo André" --level 1`.
- **Save it.** Run `./scripts/control-radar-mde browser click --role button --name "Salvar"`. The button name becomes `Salvo`: `./scripts/control-radar-mde browser wait --role button --name "Salvo"`. A status contains `Salvo em Municípios salvos`: `./scripts/control-radar-mde browser wait --role status --name "Salvo em Municípios salvos"`.
- **Capture the action.** Run `./scripts/control-radar-mde browser screenshot --path save-municipality/saved-city.png` and `./scripts/control-radar-mde browser snapshot --aria --path save-municipality/saved-city.aria.txt`.
- **Open the second view.** Run `./scripts/control-radar-mde browser click --role link --name "Salvos" --within-role navigation --within-name Principal`. The URL path is `/acompanhar`. A heading named `1 município` is visible. A link named `Santo André` is visible.
- **Read the stored list.** Run `./scripts/control-radar-mde browser storage get --key radar-mde:watch`. The value contains `sp/santo-andre`.
- **Proof of the list.** Run `./scripts/control-radar-mde browser screenshot --full-page --path save-municipality/list.png` and `./scripts/control-radar-mde browser snapshot --aria --path save-municipality/list.aria.txt`.
- **Dry-run does not clear.** Run `./scripts/control-radar-mde seed watch clear --dry-run`. `wrote` is false and `to` is `[]`. Run `./scripts/control-radar-mde seed watch list`. `ids` still contains `sp/santo-andre`.
- **Remove the fixture.** Run `./scripts/control-radar-mde browser click --role button --name "Remover Santo André dos salvos"`. The page shows `Nenhum município salvo`. `./scripts/control-radar-mde browser storage get --key radar-mde:watch` is `[]`.

## Gotchas

- The header and the footer both expose a link named `Salvos`. Scope the click with `--within-role navigation --within-name Principal`.
- Saving writes this browser profile only. Another run, or a person's own browser, stays empty. Assert `radar-mde:watch`, not a server row.
- The status text is `Salvo em Municípios salvos (só neste navegador).` Match the shorter name `Salvo em Municípios salvos`.
- Take the screenshots before `Remover`. Removal restores the empty baseline; it is not the proof of the save.
- Two cities are named Santo André. The option regex must require `SP`.
