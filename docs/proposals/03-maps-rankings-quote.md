# Maps, rankings, and a quotable sentence

## The problem

The immersive map has four indicators, defined as `Ind` in `web/src/components/mapa/model.ts`: `mde`, `fun`, `aluno`, `rec`. The tabs a person sees are "% em educação", "Fundeb", "R$ por aluno", and "Anos abaixo". There is no creche layer, no EJA layer, and no Union-top-up layer on that map.

[#4](https://github.com/IamP5/radar-mde/pull/4) already draws who receives VAAT, in `FundebMap`, from `FundebMapPayload`. That map is the top-up view. A second one on `/mapa` would split the story.

[#6](https://github.com/IamP5/radar-mde/pull/6) lets the explorer sort by creche, ensino fundamental, and EJA. The sort tooltip still says "Ordena por gravidade: abaixo, não declarou, no limite, cumpriu". The home ranking title, in `DeficitPanel`, is "Maiores déficits acumulados". That wording judges a legal minimum. It is the wrong pattern for a per-pupil sort, where a higher real is not a better school.

A journalist or a vereador can download a chart citation. They cannot copy one neutral sentence that already contains the year, the place, the indicator, and the source.

`etapas.json` on [#6](https://github.com/IamP5/radar-mde/pull/6) is about 13.2 MB. The map today loads `/data/municipios.json` through `loadAllRows()`. Putting the stage file in the map client would repeat the eager-download problem the citizen QA report already measured on the home page.

## Personas and evidence

The journalist QA report asked for a figure with its source (JOR-04) and treated ranking headlines with small samples as unfair (JOR-09). The academic report asked for indicator codes and for per-pupil figures to be tied to a named denominator. A vereador who wants "where creche spending sits" has to leave the map and sort a table whose caption talks about gravity. A parent reading "maiores" or "piores" on a creche list will take the order as a judgment of the school system.

## Journey before

On `/mapa` the person switches among the four tabs. Creche is not one of them. On `/explorar`, after [#6](https://github.com/IamP5/radar-mde/pull/6), they can sort by "Creche". The control still describes the order as gravity. To quote a city they copy a citation string, or they rewrite the KPI by hand.

## Journey after

`/mapa` gains two tabs, "Creche" and "EJA". The caption names the year and the indicator. A year with no stage extract, including 2025 for creche, shows "sem dado" and does not reuse the previous year.

The Fundeb tab on this map stays the pay-minimum view it is today. Union top-up stays on the [#4](https://github.com/IamP5/radar-mde/pull/4) map. The Fundeb topic from [note 2](02-topic-search.md) links to `#fundeb-mapa`.

The explorer sort for creche keeps the column. The caption changes. Example:

"Ordenado pelo R$ por aluno de creche declarado em 2023. A ordem não avalia qualidade."

Do not title the list "Piores" or "Maiores". The existing deficit ranking keeps its current title. This note does not restyle that panel.

Each city stage figure gets a sentence the person can copy. For Santo André:

"Em 2023, Santo André (SP) declarou R$ 15.257 por aluno de creche ao SIOPE (indicador 4.14). Fonte: FNDE/SIOPE."

The same function feeds the WhatsApp fragment in [note 1](01-letters-share-citation.md). The button label is "Copiar frase". The clipboard is the sentence plus the page URL on the next line.

## Options

**A. Load `etapas.json` in the map and color by the raw real.**

One source of truth, and a multi-megabyte parse on a phone. Quintiles would be recomputed on the client for every year.

**B. A compact sidecar, one byte per municipality per indicator.**

The build writes a quintile digit for creche and for EJA, for the years the stage file actually has. The map fetches that sidecar the way it already fetches the municipality geometry payload. The explorer keeps using the full stage row, which it already will once [#6](https://github.com/IamP5/radar-mde/pull/6) merges. The sentence is formatted from the full value, not from the quintile.

**C. Only a ranking table, no map layer.**

Smaller, and it ignores the request for maps. The sidecar is the part that makes the map cheap enough to add.

## Recommendation

Option B for the map. Reuse the [#6](https://github.com/IamP5/radar-mde/pull/6) explorer as the ranking. Reuse `FundebMap` as the top-up map. Add `quoteSentence` as the line a journalist or a councillor pastes.

Color is a quintile of the declared real per pupil, with a legend "1º quinto" through "5º quinto" and a separate swatch for "sem dado". The legend does not say "melhor" or "pior".

## Data sources

Creche and EJA reais are SIOPE 4.14 and 4.5, from the [#6](https://github.com/IamP5/radar-mde/pull/6) extract. Live check for Santo André 2023 matches the stored integers (15257.01 and 15351.42). The sidecar is a build product of that file, not a new survey.

Union top-up is the FNDE VAAT CSV already fetched for [#4](https://github.com/IamP5/radar-mde/pull/4). This note does not re-download it into `/mapa`.

The sentence's source label is `FNDE/SIOPE` plus the indicator code. It is not the census, and it must not say "matrículas do Censo". The academic report's warning still applies. The per-pupil denominator is the enrolment the municipality typed into SIOPE.

## Types, modules, and routes

No new page. Tabs live on `/mapa`. The sentence lives on the city stage block and on the explorer row's copy control.

```ts
type MapInd = "mde" | "fun" | "aluno" | "rec" | "cre" | "eja";

type StageQuintile = {
  year: number;
  /** ibge code to a digit 1-5, omitted when the city has no value */
  cre: Record<string, 1 | 2 | 3 | 4 | 5>;
  eja: Record<string, 1 | 2 | 3 | 4 | 5>;
};
```

Build script writes `web/src/data/stage-quintile.json` (or the public path the map already uses for sidecar JSON). `quoteSentence` stays in `web/src/lib/briefing.ts` from [note 1](01-letters-share-citation.md). The map must not import `etapas.json`.

`vaat` is not added to `MapInd`. The payload on [#4](https://github.com/IamP5/radar-mde/pull/4) remains `FundebMapPayload`.

## Risks and blast radius

[#6](https://github.com/IamP5/radar-mde/pull/6) changes `build_data.py`, the CSV route, the explorer, and the city page. The sidecar should be a step in that same build once the stage file is stable, not a second parser of SIOPE.

[#4](https://github.com/IamP5/radar-mde/pull/4) adds `FundebMap` and glossary entries. Linking `#fundeb-mapa` from the topic page assumes that anchor survives review. If the anchor is renamed, the topic link breaks. Pin the id in the #4 review.

The map recipe names the four tabs inside "Indicador do mapa". Adding "Creche" and "EJA" updates `features/map.md` and the skill's tab list in `SKILL.md`.

Quintiles on a year with many missing cities will paint a thin set. The legend must show the count of cities with a value so a small-n map is not read as a full country (the same failure mode as JOR-09).

Do not sort "Creche" with the gravity comparator. A missing value sorts last, labeled "sem dado", and is not a moral category.

## Size

Medium. A build output, two map tabs, a caption, and a copy button. No new SIOPE fetch if #6 has already produced `etapas.json`.

## Acceptance criteria

- `/mapa` shows tabs "Creche" and "EJA". Choosing "Creche" does not request `etapas.json`.
- A year outside the stage extract shows "sem dado" and does not color last year's quintile.
- The Fundeb tab is unchanged. The VAAT map on the #4 page is still the only top-up map.
- Sorting the explorer by creche shows the neutral caption and does not show "gravidade" on that control.
- "Copiar frase" on Santo André (SP) 2023 yields the 4.14 sentence with R$ 15.257 and `FNDE/SIOPE`.
- The copied sentence does not contain "pior", "melhor", or "déficit".

## Verification with verify-radar-mde

Update `features/map.md`, `features/explore.md`, and `features/municipality.md`.

Map. Open `/mapa`, wait for the application whose name starts with "Mapa do Brasil", and click the tab "Creche" inside "Indicador do mapa". The legend contains "sem dado" or a quinto label, and does not contain "pior". Screenshot the map with the header. If the map hides the site header, the recipe already says so. Capture the map chrome and the tab name.

Network. `logs` or the performance entries available to the CLI must not show `etapas.json` on `/mapa`. If the CLI cannot see requests, record `http get` of the sidecar path and a note that the stage file was not the URL under test.

Explorer. Open `/explorar`, choose the creche sort, and read the caption text. It contains "não avalia qualidade".

City. Open `/sp/santo-andre`, choose "Copiar frase", read the clipboard, and confirm `4.14`.

Then `cleanup` and `evidence list`.
