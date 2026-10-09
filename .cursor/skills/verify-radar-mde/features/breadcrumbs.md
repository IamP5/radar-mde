# Territorial breadcrumbs

Above a region, state, or municipality, the breadcrumb walks up to Brasil and sideways to a sibling region, state, or municipality. The selected year, when there is one, stays in the address.

## Sub-features

- `crumb-brasil` returns to the national panel from São Paulo.
- `crumb-state` swaps São Paulo for Rio de Janeiro.
- `crumb-city` swaps Santo André for Campinas inside São Paulo.

## How to get to it (user POV)

- On a state or city page, the trail is the navigation `Navegação territorial`.
- Choose `Brasil` to go up.
- Choose `Trocar de região` or `Trocar de estado` to open the sibling list.
- On a city page, choose `Trocar de município` and type the other city.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Back to Brasil.** Run `./scripts/control-radar-mde browser open /sp`. Run `./scripts/control-radar-mde browser click --role link --name "Brasil" --exact --within-role navigation --within-name "Navegação territorial"`. Run `./scripts/control-radar-mde browser wait --role heading --name "A educação recebe o que a Constituição manda?"`. The URL path is `/`.
- **Swap state.** Run `./scripts/control-radar-mde browser open /sp`. Run `./scripts/control-radar-mde browser click --role button --name "Trocar de estado"`. Run `./scripts/control-radar-mde browser click --role menuitem --name-regex "Rio de Janeiro" --timeout 90000`. The click's JSON `url` path is `/rj` and `navigated` is true. A level-1 heading named `Rio de Janeiro` is visible.
- **Swap municipality.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role button --name "Trocar de município (São Paulo)"`. Run `./scripts/control-radar-mde browser wait --role combobox --name "Buscar município em São Paulo"`. Run `./scripts/control-radar-mde browser fill --role combobox --name "Buscar município em São Paulo" --value "Campinas"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "^Campinas" --expect-nav --timeout 90000`. The click's JSON `url` path is `/sp/campinas` and `navigated` is true. A level-1 heading named `Campinas` is visible.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path breadcrumbs/campinas.png` and `./scripts/control-radar-mde browser snapshot --aria --path breadcrumbs/campinas.aria.txt`. The screenshot shows the Radar MDE header and `Campinas`.

## Gotchas

- `Brasil` also appears in the footer as `Radar MDE · Brasil` and on the map. Scope the crumb with the navigation named `Navegação territorial` and `--exact`.
- The municipality list says `Carregando municípios…` until it arrives. Wait for the combobox, then fill. `Campinas` in São Paulo is one city; the name must not be a bare `Campinas` that could match another row if the list is unfiltered. The option moves with the router, so the click passes `--expect-nav` and waits for `/sp/campinas` inside `--timeout`.
- `Trocar de município` is absent on Brasília. The Distrito Federal has no sibling municipality.
- A non-default year is kept on the crumb (`?ano=`). This recipe starts with no year in the address.
