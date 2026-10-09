# Immersive map

The map is a full-screen view of the same indicators. A person switches indicator, plays the years, and opens a state.

## Sub-features

- `map-open` shows the map application and the Radar MDE title.
- `map-indicator` switches the indicator to Fundeb and keeps it in the address.
- `map-play` plays the years and then pauses.
- `map-state` opens Rio de Janeiro from its callout chip.

## How to get to it (user POV)

- Choose `Mapa` in the header.
- Choose `Mapa interativo` on the national panel.
- Open `/mapa`.
- Open a shared link such as `/mapa#sp` or `/mapa?i=fun`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The window is 1440×900 so the desktop indicator tabs are the visible ones.

- **Open the map.** Run `./scripts/control-radar-mde browser open /mapa`. Wait with `./scripts/control-radar-mde browser wait --role application --name-regex "Mapa do Brasil"`. The title `Radar MDE` is visible.
- **Switch to Fundeb.** Run `./scripts/control-radar-mde browser click --role tab --name "Fundeb"`. The URL contains `i=fun`. The tab `Fundeb` is selected.
- **Play the years.** Run `./scripts/control-radar-mde browser click --role button --name "Reproduzir a evolução ano a ano"`. A status says `Reproduzindo a evolução ano a ano.` Then `./scripts/control-radar-mde browser click --role button --name "Pausar a animação dos anos"`.
- **Open Rio de Janeiro.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Rio de Janeiro.*Aproximar"`. The URL hash contains `#rj`.
- **Shared-link entry.** Run `./scripts/control-radar-mde browser open "/mapa#sp"`. The URL hash is `#sp`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path map/sao-paulo.png` and `./scripts/control-radar-mde browser snapshot --aria --path map/sao-paulo.aria.txt`.

## Gotchas

- Two tab lists are named `Indicador do mapa` (desktop and phone). At 1440×900 only the desktop list is visible. Do not pass `--include-hidden`.
- State labels for large states, including São Paulo, do not take pointer hits. The clickable chips are the small-state callouts: Rio Grande do Norte, Paraíba, Pernambuco, Alagoas, Sergipe, Espírito Santo, and Rio de Janeiro. Their accessible names end with `Aproximar`.
- A shared hash is a real entry. `/mapa#sp` opens São Paulo. `/mapa#sp-3547809` opens Santo André. Assert the hash, not a city-page heading.
- Search started on the map flies the map and does not open `/sp/santo-andre`. Use the search recipe from the panel when the goal is the city page.
- The play control's name is `Reproduzir a evolução ano a ano` and, while playing, `Pausar a animação dos anos`.
