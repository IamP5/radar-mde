# Region page

A region page is the national panel narrowed to one region, with a switcher for the other regions, a CSV of that region's municipalities, and a link into the national table already filtered to the region.

## Sub-features

- `region-open` shows Região Nordeste.
- `region-switch` moves to Região Norte from the region switcher.
- `region-csv` downloads that region's CSV.
- `region-explore` opens the national table filtered to the region.

## How to get to it (user POV)

- Open `/regiao/nordeste` (or `norte`, `centro-oeste`, `sudeste`, `sul`).
- On the national panel, choose a region card such as `Sudeste:`.
- On any region page, choose another name in the `Regiões` switcher.
- In the breadcrumb, choose `Trocar de região`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Open Nordeste.** Run `./scripts/control-radar-mde browser open /regiao/nordeste`. The URL path is `/regiao/nordeste`. A level-1 heading named `Região Nordeste` is visible.
- **Switch to Norte.** Run `./scripts/control-radar-mde browser click --role link --name "Norte" --exact --within-role navigation --within-name "Regiões"`. Run `./scripts/control-radar-mde browser wait --url-includes "/regiao/norte" --timeout 90000`. The URL path is `/regiao/norte`. A level-1 heading named `Região Norte` is visible.
- **Download the region.** Run `./scripts/control-radar-mde browser click --role link --name "Baixar CSV da região" --download region/norte.csv`. `download.bytes` is greater than zero. The file's first line contains `municipio`.
- **Open the filtered table.** Run `./scripts/control-radar-mde browser click --role link --name "Explorar municípios"`. Run `./scripts/control-radar-mde browser wait --url-includes "/explorar?regiao=norte" --timeout 90000`. The URL path is `/explorar` and the query contains `regiao=norte`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path region/norte-table.png` and `./scripts/control-radar-mde browser snapshot --aria --path region/norte-table.aria.txt`. The screenshot shows the Radar MDE header. The table is the explorer, with the Norte filter in the address.

## Gotchas

- Region cards on the national panel are named `Norte:` with a colon and a share. The switcher on the region page is the link whose whole name is `Norte`. Use `--exact` inside the navigation named `Regiões`.
- Opening a region from the national panel is the national-panel recipe. This recipe starts from the region address so the switcher, the CSV, and the explore link are the thing being proved.
- The year control on a region page is the same control as on the national panel. Stepping it is not part of this recipe.
