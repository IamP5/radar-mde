# Page not found

An address Radar MDE does not know shows Página não encontrada, with search and shortcuts back to the panel, the table, the data, and the methodology. An unknown city or region uses the same page.

## Sub-features

- `missing-path` shows the page for a path that is not a section.
- `missing-city` shows it for a municipality that does not exist.
- `missing-region` shows it for a region that does not exist.
- `missing-shortcut` opens Explorar from the shortcut on that page.
- `missing-status` answers the unknown path with status 404.

## How to get to it (user POV)

- Open an address that is not a page, such as `/caminho-inexistente`.
- Open a city slug that is not in that state, such as `/sp/nao-existe-cidade`.
- Open a region slug that is not one of the five, such as `/regiao/atlantida`.
- From the page, search, or choose Painel, Explorar, Dados abertos, or Metodologia.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Unknown path.** Run `./scripts/control-radar-mde browser open /caminho-inexistente`. A level-1 heading named `Página não encontrada` is visible. The text `404` is visible.
- **Shortcut.** Run `./scripts/control-radar-mde browser click --role link --name-regex "Tabela com os 5.570"`. The URL path is `/explorar`. A level-1 heading named `Explorar municípios` is visible.
- **Unknown city.** Run `./scripts/control-radar-mde browser open /sp/nao-existe-cidade`. A level-1 heading named `Página não encontrada` is visible.
- **Unknown region.** Run `./scripts/control-radar-mde browser open /regiao/atlantida`. A level-1 heading named `Página não encontrada` is visible.
- **Status.** Run `./scripts/control-radar-mde http get /caminho-inexistente --save not-found/body.html`. The status is 404.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path not-found/region.png` and `./scripts/control-radar-mde browser snapshot --aria --path not-found/region.aria.txt`. The screenshot shows the Radar MDE header and `Página não encontrada`.

## Gotchas

- The header link `Explorar` and the shortcut on this page are different. The shortcut's name contains `Tabela com os 5.570 municípios`. Matching only `Explorar` hits the header or the footer as well.
- Search from this page uses the same palette as the header. A query with no match is the recent-searches recipe (`search-miss`), not this one.
- `/df` is not a missing page. It opens Brasília.
