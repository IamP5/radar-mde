# Radar MDE verification map

This directory is the maintained source for verifying the user-facing behavior of Radar MDE. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch Radar MDE with `./scripts/control-radar-mde launch` from the repo root and export `RADAR_VERIFY_RUN_ID` from the JSON `runId`.
- The server listens on `http://127.0.0.1:<port>` (search starts at 4173). One checkout runs one server because `web/.next` is shared.
- The browser profile starts empty. Saved municipalities are not in a database. Seed them with `./scripts/control-radar-mde seed watch add --id <uf/slug>` only when a recipe says so.
- Run `./scripts/control-radar-mde doctor` and require `checks.process`, `checks.port`, `checks.http`, and `checks.revision`. `auth` is `none`.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
- Treat every command as literal. Run them from the repo root with `RADAR_VERIFY_RUN_ID` set.
- Run browser actions through `./scripts/control-radar-mde browser`.
- The viewport starts at 1440×900. Commands skip controls that are not visible. A recipe that calls `browser viewport` sets `--preset desktop` again before it ends.
- Restore a seeded watchlist after a mutation. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with Radar MDE visible in the header.
- Mutation proof includes a second user-facing view and a read of `radar-mde:watch`.
- HTTP or CSV proof includes the status and the saved body.
- Record the feature id and the entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.
- After `cleanup`, `./scripts/control-radar-mde evidence list` must still show the files.

## Feature entry contract

H1 title + one paragraph, then exactly four H2s: `Sub-features` (short IDs, one line each), `How to get to it (user POV)` (every entry point), `Driving it with control-radar-mde` (starts with `Preconditions:`, labeled bullets pairing action + exact command + observable result), `Gotchas`. Keep implementation details out of the map.

## Features

- [National panel](./panel.md) covers the Brasil home page, the year control, and opening a region.
- [Search](./search.md) covers the header palette, the home field, and the keyboard shortcut.
- [Explore municipalities](./explore.md) covers the national table, UF filter, capitals, and CSV export.
- [Immersive map](./map.md) covers indicator tabs, the year playback, and opening a state.
- [Save a municipality](./save-municipality.md) covers saving from a city page and seeing it under Salvos.
- [Theme](./theme.md) covers the header light/dark toggle and the footer Sistema, Claro, and Escuro choices.
- [Recent searches](./recent-searches.md) covers the Recentes group in the search palette and a query with no match.
- [State page](./state.md) covers a state's year, municipality search, map indicator, CSV, and the Distrito Federal redirect.
- [Region page](./region.md) covers switching region, the region CSV, and opening that region's table.
- [Municipality page](./municipality.md) covers a city's year, indicators, charts, rank, neighbors, source link, and the Santo André research note.
- [Action letters](./letters.md) covers the four ready-to-send letters, the signature fields, and copying the text.
- [Glossary](./glossary.md) covers the dotted terms that open a short definition.
- [Share a link](./share.md) covers Compartilhar and Copiar link, including the selected year.
- [Chart export](./chart-export.md) covers PNG, CSV, and the citation on a chart.
- [Open data](./open-data.md) covers the Dados page, the home CSV, per-state files, JSON, the dictionary, and the citation.
- [Methodology](./methodology.md) covers /sobre, the section list, and the link to the data page.
- [Page not found](./not-found.md) covers an unknown address, an unknown municipality, and an unknown region.
- [Territorial breadcrumbs](./breadcrumbs.md) covers Brasil, swapping state, and swapping municipality.
- [Series indicator](./series.md) covers the national chart's three indicators.
- [Period balance](./balance.md) covers nominal versus IPCA, the grouping, the sort, and opening a region from the list.
- [Table filters](./table-filters.md) covers the explorer filters beyond name, UF, and capitals, plus copy link, the other CSV formats, and the empty table.
- [Map controls](./map-controls.md) covers zoom, state view, the legend, copying the map link, the pandemic count, and a city detail.
- [Footer and skip link](./chrome.md) covers the footer section links, the license, and Pular para o conteúdo.
- [Phone navigation](./phone-nav.md) covers the second header bar and the short Método label.
- [Saved year strip](./saved-series.md) covers the year cells on Salvos and Adicionar.
- [Spending by stage](./spending-by-stage.md) covers where education spending goes on a city, on Brasil, on a region, on a state, in the explorer, and in the data dictionary.
