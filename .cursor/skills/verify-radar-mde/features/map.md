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

- **Open from the panel.** Run `./scripts/control-radar-mde browser open /`. Then `./scripts/control-radar-mde browser click --role link --name "Mapa interativo"`. The URL path is `/mapa`.
- **Open from the header.** Run `./scripts/control-radar-mde browser open /explorar`. Then `./scripts/control-radar-mde browser click --role link --name "Mapa" --within-role navigation --within-name Principal`. The click's JSON `url` path is `/mapa` and `navigated` is true. `Mapa` is also a footer link, so the nav scope is required.
- **Open the map.** Run `./scripts/control-radar-mde browser open /mapa`. Wait with `./scripts/control-radar-mde browser wait --role application --name-regex "Mapa do Brasil"`. The title `Radar MDE` is visible.
- **Switch to Fundeb.** Run `./scripts/control-radar-mde browser click --role tab --name "Fundeb"`. The URL contains `i=fun`. The tab snapshot says `tab "Fundeb" [selected]`. A shared link does the same: `./scripts/control-radar-mde browser open "/mapa?i=fun"`, then wait for the application. The URL contains `i=fun`.
- **Play the years.** Run `./scripts/control-radar-mde browser click --role button --name "Reproduzir a evolução ano a ano"`. The URL gains `ano=` at the first published year. `./scripts/control-radar-mde browser snapshot --aria --path map/playing.aria.txt` contains `status: Reproduzindo a evolução ano a ano.` and `button "Pausar a animação dos anos"`. Then `./scripts/control-radar-mde browser click --role button --name "Pausar a animação dos anos"`. The year in the URL stops advancing and the button name returns to `Reproduzir a evolução ano a ano`.
- **Open Rio de Janeiro.** Run `./scripts/control-radar-mde browser click --role button --name-regex "Rio de Janeiro.*Aproximar"`. The URL hash contains `#rj`. The document title starts with `Rio de Janeiro`.
- **Shared-link entry.** Run `./scripts/control-radar-mde browser open "/mapa#sp"`, then wait for the application. The URL hash is `#sp` and the document title starts with `São Paulo`. The page is not a city-page heading.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path map/sao-paulo.png` and `./scripts/control-radar-mde browser snapshot --aria --path map/sao-paulo.aria.txt`.

## Gotchas

- Two tab lists are named `Indicador do mapa` (desktop and phone). At 1440×900 only the desktop list is visible. Do not pass `--include-hidden`.
- State labels for large states, including São Paulo, do not take pointer hits. The clickable chips are the small-state callouts: Rio Grande do Norte, Paraíba, Pernambuco, Alagoas, Sergipe, Espírito Santo, and Rio de Janeiro. Their accessible names end with `Aproximar`.
- A shared hash is a real entry. `/mapa#sp` opens São Paulo. `/mapa#sp-3547809` opens Santo André. Assert the hash, not a city-page heading.
- Search started on the map flies the map and does not open `/sp/santo-andre`. Use the search recipe from the panel when the goal is the city page.
- `/mapa` has no site header and no footer, so there is no navigation named `Principal` there. Header clicks must start from another page, such as `/explorar`.
- The play control's name is `Reproduzir a evolução ano a ano` and, while playing, `Pausar a animação dos anos`. The playback sentence is announced to screen readers only: it appears as `status:` in the page ARIA snapshot, not on screen. `browser find --role status` lists that text while playback is running. Once paused, the status holds the year summary instead, so a `--name` filter for the sentence no longer matches.
- The document title for `/mapa#sp` changes to São Paulo only after the map application appears. Wait for the application before reading the title. The address already ends in `#sp` before that.
