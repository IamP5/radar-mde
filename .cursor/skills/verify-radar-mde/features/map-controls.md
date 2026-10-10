# Map controls

Around the map itself, a person zooms, frames the country again, colors states instead of municipalities, highlights one band in the legend, copies the link of that view, counts the pandemic years or not, and opens a city's detail.

## Sub-features

- `map-zoom` zooms in and then returns to the country frame.
- `map-states` colors states, then switches the state measure to the median.
- `map-legend` highlights the 22–25% band.
- `map-link` copies the link of that view.
- `map-pandemic` stops counting 2020–21 on the years-below indicator.
- `map-city` opens Santo André's detail from search and closes it.
- `map-fullscreen` enters fullscreen and leaves it.
- `map-brasil` returns the map to the whole country.

## How to get to it (user POV)

- Open `/mapa`.
- `Aproximar`, `Afastar`, and `Voltar ao enquadramento` sit on the map.
- `Ver o mapa por` offers `Municípios` and `Estados`. On states, `Medida por estado` offers `% abaixo de 25%`, `Mediana`, and `Governo estadual`.
- The legend buttons are named with `Destacar no mapa`.
- `Copiar o link desta visão` copies the address.
- The indicator `Anos abaixo` shows `Contar 2020–21 (pandemia)`.
- Search on the map opens a city's detail. `Fechar detalhes` dismisses it. `Brasil` in `Navegação no mapa` zooms back out.
- `Tela cheia` on the map bar enters fullscreen and becomes `Sair da tela cheia`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The window is 1440×900 so the desktop legend is the visible one.
- Switching the indicator to Fundeb, year playback, and opening a state chip are the immersive-map recipe. This recipe does not repeat them.

- **Open the map.** Run `./scripts/control-radar-mde browser open /mapa`. Wait with `./scripts/control-radar-mde browser wait --role application --name-regex "Mapa do Brasil"`. The words `Radar MDE` are visible.
- **Zoom and frame.** Run `./scripts/control-radar-mde browser click --role button --name "Aproximar" --exact`. Run `./scripts/control-radar-mde browser wait --role button --name "Voltar ao enquadramento"`. Run `./scripts/control-radar-mde browser click --role button --name "Voltar ao enquadramento"`.
- **Highlight a band.** Run `./scripts/control-radar-mde browser wait --role button --name-regex "22–25%:.*Destacar no mapa"`. Run `./scripts/control-radar-mde browser click --role button --name-regex "22–25%:.*Destacar no mapa"`.
- **States and median.** Run `./scripts/control-radar-mde browser click --role button --name "Estados" --within-role group --within-name "Ver o mapa por"`. The URL contains `nivel=estados`. Run `./scripts/control-radar-mde browser click --role button --name "Mediana" --within-role group --within-name "Medida por estado"`. The URL contains `medida=median`.
- **Copy the view.** Run `./scripts/control-radar-mde browser click --role button --name "Copiar o link desta visão"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `/mapa` and `nivel=estados`.
- **Pandemic years.** Run `./scripts/control-radar-mde browser click --role button --name "Anos abaixo" --within-role group --within-name "Indicador do mapa"`. The URL contains `i=rec`. Run `./scripts/control-radar-mde browser click --role button --name "Contar 2020–21 (pandemia)"`. The URL contains `pandemia=0`.
- **City detail.** Run `./scripts/control-radar-mde browser click --role button --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser wait --role dialog --name "Buscar município, estado ou região"`. Run `./scripts/control-radar-mde browser fill --role combobox --name "Buscar" --value "santo andre"`. Run `./scripts/control-radar-mde browser click --role option --name-regex "Santo André.*SP" --timeout 90000`. The click's JSON `url` contains `#sp-` and `navigated` is true. Run `./scripts/control-radar-mde browser wait --role complementary --name "Detalhes de Santo André"`.
- **Close and return.** Run `./scripts/control-radar-mde browser click --role button --name "Fechar detalhes"`. Run `./scripts/control-radar-mde browser find --role complementary --name "Detalhes de Santo André"`. The count is 0. Run `./scripts/control-radar-mde browser click --role button --name "Brasil" --exact --within-role navigation --within-name "Navegação no mapa"`. Run `./scripts/control-radar-mde browser url`. The URL has no `#sp-`.
- **Fullscreen.** Run `./scripts/control-radar-mde browser click --role button --name "Tela cheia" --exact`. The button is now `Sair da tela cheia`: `./scripts/control-radar-mde browser wait --role button --name "Sair da tela cheia"`. Run `./scripts/control-radar-mde browser click --role button --name "Sair da tela cheia" --exact`. The button is `Tela cheia` again: `./scripts/control-radar-mde browser wait --role button --name "Tela cheia" --exact`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path map-controls/brasil.png` and `./scripts/control-radar-mde browser snapshot --aria --path map-controls/brasil.aria.txt`. The screenshot shows `Radar MDE` in the map bar.

## Gotchas

- State callouts are also named with `Aproximar` at the end (`Rio de Janeiro… Aproximar`). The zoom button's whole name is `Aproximar`. Use `--exact`.
- `22–25%` uses an en dash, the same dash as on the legend, not a hyphen. That band is on the municipal MDE legend. After `Mediana`, the state legend uses `< 25%` and `25–26%` instead, so highlight the band before switching the measure.
- `Indicador do mapa`, `Ver o mapa por`, and `Medida por estado` are segmented controls: role `group`, with role `button` options marked `[pressed]` when chosen. They are not tabs or radios. `Anos abaixo` is in `Indicador do mapa`.
- Search started on the map does not open `/sp/santo-andre`. It moves the map and opens the detail. Assert `#sp-` and `Detalhes de Santo André`. The option click waits for that hash inside `--timeout`.
- `Tela cheia` is hidden below the small breakpoint (`max-sm`). At 1440×900 the click enters fullscreen and the button is renamed `Sair da tela cheia`. Click that name to leave before the proof.
- `Afastar` is the paired zoom-out button. The frame button is the proof that zoom changed the view.
