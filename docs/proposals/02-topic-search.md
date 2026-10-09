# Topic search

## The problem

Search ranks municipalities, states, and regions. A word that is not a place falls through to a fuzzy city, or to nothing.

Checked on `main` by running `web/src/lib/search.ts` against `cities.json`:

| Query | What the ranker does |
| --- | --- |
| `creche` | One hit, Frecheirinha (CE), fuzzy. Enter opens `/ce/frecheirinha`. No city name contains "creche". |
| `fila` | Filadélfia (BA) first, as a prefix, not as a fuzzy match. |
| `conselho` | Bom Conselho (PE) only, as a word prefix. |
| `Fundeb` | No rows. |
| `eja` | Eight cities by substring, including names such as Tapejara. |
| `santo andre` | São Paulo (population 782,048) then Paraíba (2,708). |
| `santo andre sp` or `santo andre pb` | The state filter already keeps one city. |
| `bom jesus` | 23 cities. |

Two hundred forty municipality names are shared. The option already carries a UF badge, and the accessible name includes `SP`, which is why `features/search.md` clicks `Santo André.*SP`. The primary label is still the bare name, and Enter selects `order[0]`, which is the largest city.

## Personas and evidence

A parent who types "creche" or "fila" is looking for the waiting list or the stage figure, not a municipality in Ceará or Bahia. A council member who types "conselho" is looking for the CACS sheet or the letter, not only Bom Conselho. A journalist who types "Fundeb" gets an empty list, so the redistributivo view on [#4](https://github.com/IamP5/radar-mde/pull/4) is unreachable from search. A vereador who types "Santo André" and presses Enter lands in São Paulo even when they meant Paraíba.

The search recipe already treats the two Santo André rows as a gotcha. This note closes the Enter path and the topic path. It does not redo city matching.

## Journey before

The palette opens from "Digite o nome da sua cidade", from "Buscar município, estado ou região", or from Ctrl+K. The person types "creche". One option appears. Enter opens Frecheirinha.

They type "santo andre" and press Enter. The URL is `/sp/santo-andre`.

On the map, the same palette flies the map. That behavior stays.

## Journey after

"creche" selects a topic row named "Creche". Under it, a quieter group "Municípios com nome parecido" still lists Frecheirinha. Enter opens the topic, not the city.

The topic page explains the figure in plain language and links to places that exist. Suggested first screen for creche:

"Creche é o gasto declarado por aluno na educação infantil em creche (SIOPE, indicador 4.14). Escolha um município para ver o número."

A second link to the explorer sort or the map layer appears only after [note 3](03-maps-rankings-quote.md) and [#6](https://github.com/IamP5/radar-mde/pull/6) exist. Until then the page does not point at a missing route.

"fila" and "fila de creche" open the waiting-list topic. The page says there is no national file on this panel, points at [note 5](05-creche-queue.md) once that field exists, and does not open Filadélfia.

"conselho" and "cacs" open a topic that explains the CACS-Fundeb letter and, after [#7](https://github.com/IamP5/radar-mde/pull/7), how to open "Ficha do conselho" from a city. "bom conselho" still opens Bom Conselho (PE), because the full query is a municipality name.

"Fundeb" opens a topic that links to the glossary and, after [#4](https://github.com/IamP5/radar-mde/pull/4), to the Fundeb map anchor `#fundeb-mapa`.

"eja" opens the EJA topic. The eight name matches stay under "Municípios com nome parecido".

For "santo andre", both rows read "Santo André (SP)" and "Santo André (PB)". A heading says "Há mais de um município com esse nome". Enter does not navigate. The person chooses a row. The state suffix they already type (`sp`, `pb`) still filters to one row, and that single row may be opened with Enter.

## Options

**A. A deny-list of words that must not fuzzy-match.**

"creche" would no longer open Frecheirinha. "Fundeb" would still show nothing. "fila" would still open Filadélfia, because that hit is a prefix, rank 1, not a fuzzy rank. The parent gets silence or the wrong city.

**B. A topic table checked before city ranking.**

Each alias has an id, a label, and a route that exists on `main`. An exact alias beats prefix, substring, and fuzzy. An exact municipality name beats an alias that is only one word inside that name. Same-name cities require a choice when more than one exact name matches.

**C. Ask a model to interpret the query.**

The panel has no account and no server round-trip for search. A remote interpreter would invent routes and would fail offline. Rejected.

## Recommendation

Option B. Topics are data, a short table in the repo, not a classifier.

Alias ids to ship first: `creche`, `fila`, `conselho`, `fundeb`, `eja`, `caqm`. `caqm` points at a topic page that describes the legal minimums. The simulator route `/{uf}/{slug}/caqm` is linked only after [#5](https://github.com/IamP5/radar-mde/pull/5).

## Data sources

No new download. Labels and explanations cite SIOPE indicator codes already used on the panel (4.14 for creche, 4.5 for EJA). The Fundeb topic cites Lei nº 14.113/2020 the way the letters already do. The queue topic must not state a national waiting-list total. The only waiting-list count verified in this repo is 7,116 for Santo André in 2019, from the thesis, and it is not the result for the word "fila".

## Types, modules, and routes

```ts
type TopicId = "creche" | "fila" | "conselho" | "fundeb" | "eja" | "caqm";

type Topic = {
  id: TopicId;
  label: string;
  aliases: string[];
  href: string;
  blurb: string;
};

type Kind = "city" | "uf" | "region" | "topic";
```

`web/src/lib/topics.ts` holds the table. `search.ts` returns topic hits before it ranks cities. `SearchPaletteDialog` renders two groups when both exist. The selected index defaults to the topic when the query is an alias.

New routes, all static copy:

- `/temas/creche`
- `/temas/fila`
- `/temas/conselho`
- `/temas/fundeb`
- `/temas/eja`
- `/temas/caqm`

Map search keeps its current contract. Choosing a topic leaves `/mapa` for `/temas/...`, because a topic is not a coordinate. Choosing a city on the map still flies to the hash, as `features/search.md` requires.

Recent searches may store a topic id. The storage key stays `radar-mde:recent-search`. A topic entry needs a distinct `id` prefix so it is not parsed as `c:uf/slug`.

## Risks and blast radius

None of #4, #5, #6, or #7 edit `search.ts`. This note can merge first.

The risk is a topic route that 404s because it deep-links into an unmerged pull request. The first version links only to `/temas/[id]`, `/explorar`, `/mapa`, `/sobre`, and `#agir` on a city the person already opened. Deep links to `/caqm`, `/conselho`, and `#fundeb-mapa` are a follow-up on those branches.

"bom conselho" must remain a city. Add that case next to the Santo André case in the search recipe.

Enter on a tied name must not call `go(order[0])`. If the implementation leaves a default highlight, the highlight should sit on the heading, which is not an option, so Enter is a no-op until a row is chosen.

Do not hide Frecheirinha. The person who meant that city still sees it under the second heading.

## Size

Small. One table, a branch in `search.ts`, a group in the dialog, and six static pages. No dataset.

## Acceptance criteria

- "creche" shows the topic as the selected row. Enter opens `/temas/creche`. Frecheirinha is visible and is not selected.
- "fila" does not open Filadélfia on Enter. Filadélfia remains available in the city group.
- "conselho" opens `/temas/conselho`. "bom conselho" opens `/pe/bom-conselho`.
- "Fundeb" shows the topic. The empty state is gone.
- "santo andre" shows "Santo André (SP)" and "Santo André (PB)" and does not navigate on Enter.
- "santo andre pb" still opens only the Paraíba city, including from the map, where the hash is the Paraíba municipality rather than a city page.
- Recent searches still record `sp/santo-andre` inside `id` and `href` after a city is chosen.

## Verification with verify-radar-mde

Update `features/search.md` and add `features/topics.md` with the four-heading contract. Register it in `features/README.md`.

Preconditions match the search recipe. `doctor` ok, no dialog open.

From `/`, open the palette, fill "Buscar" with `creche`, and wait for an option whose name matches `Creche`. Press Enter with `browser press`. The path is `/temas/creche`. A heading "Creche" is visible. Go back, search `creche` again, and click the option whose name matches `Frecheirinha`. The path is `/ce/frecheirinha`.

Search `santo andre`. Two options match `Santo André (SP)` and `Santo André (PB)`. Press Enter. The URL stays on the page that opened the dialog. Click `Santo André (PB)`. The path is `/pb/santo-andre`.

Repeat the existing map step in `search.md` for São Paulo, then the Paraíba city. The map hash must be the Paraíba id, not `/pb/santo-andre`.

Screenshot and ARIA snapshot include the dialog with both groups. Then `cleanup`.
