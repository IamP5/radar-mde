# Letters, share text, and citation

## The problem

The city page now knows more than the text a person can send.

On `main`, `buildTemplates` in `web/src/lib/templates.ts` fills four letters (access-to-information, CACS-Fundeb, chamber, audit court). `cityFacts` covers the 25% minimum, years below that minimum, the Fundeb pay minimum, Fundeb leftover, and EC 119/2022. It does not mention reais per creche pupil, reais per EJA pupil, the early-childhood share, Union top-up, a CAQM reading, or the council sheet.

`summary()` in `web/src/app/[uf]/[slug]/verdict.ts` is the sentence `HeaderShare` puts on WhatsApp. For a city that declared, that sentence is the 25% result. The citizen QA report records the shape of that text for Conceição do Almeida (BA). The chart citation in `web/src/components/kit/chart-actions.tsx` is one string, `Radar MDE (year). title. url. Fonte: FNDE/SIOPE. Acesso em date.` The Dados page cites FNDE/SIOPE, SICONFI, and IBGE. It does not name Silva 2021.

[#6](https://github.com/IamP5/radar-mde/pull/6) stores stage figures. [#4](https://github.com/IamP5/radar-mde/pull/4) stores VAAT and already has `fundebSentence()`. [#5](https://github.com/IamP5/radar-mde/pull/5) simulates CAQM. [#7](https://github.com/IamP5/radar-mde/pull/7) adds a council sheet whose creche question says the sheet does not bring the waiting-list number. None of those figures reach the letter, the share line, or the citation.

## Personas and evidence

A parent forwarding a city on WhatsApp gets only the 25% line (`qa/reports/citizen.md`, the Conceição do Almeida share text). A CACS member or legislative aide copies a letter that now mentions Fundeb pay and leftover (the gap in `qa/reports/government.md`, GOV-03, is closed on `main`) and still cannot attach creche reais or the Union complement. A journalist copying a citation gets a title and `FNDE/SIOPE`, with no indicator code (`qa/reports/journalist.md`, JOR-04, still open for a KPI citation). A researcher cannot attach Silva 2021 beside the data citation (`qa/reports/academic.md` asked for a citable methodology).

The education secretary is the constraint. A letter that states a simulated CAQM total as if the municipality had declared it would be a false official request. The government QA report already caught a letter that said the city had met 25% when it had not declared.

## Journey before

The person opens Santo André (SP), chooses "O que posso fazer?", and copies "Pedir dados". The letter names the 25% series and, when they fail, the Fundeb pay minimum and the leftover. It does not say that 2023 creche spending was R$ 15,257 per pupil.

They choose "Compartilhar", then "Enviar no WhatsApp". The text is the verdict plus the URL.

They export a chart and choose "Copiar citação". The source is `FNDE/SIOPE` even when the chart is a stage indicator.

## Journey after

The same letter gains one paragraph, built from the same `Briefing` as the share line. For Santo André (SP), with stage data from [#6](https://github.com/IamP5/radar-mde/pull/6) and Fundeb from [#4](https://github.com/IamP5/radar-mde/pull/4), the paragraph can read:

"Em 2023, o município declarou ao SIOPE R$ 15.257 por aluno de creche (indicador 4.14) e R$ 15.351 por aluno da EJA (indicador 4.5). A educação infantil foi 40,0% da despesa com educação (indicador 2.4)."

"No Fundeb de 2025, o VAAT de Santo André (SP) foi R$ 13.914,20, acima do VAAT-MIN de R$ 8.024,31. A União não complementa esta rede nessa publicação (Portaria MEC/MF nº 5, de 29/04/2026)."

Years stay attached to the publication they come from. Creche reais are 2023. The VAAT file is the 2025 Fundeb publication. The paragraph is omitted when every figure is missing, the same way a missing declaration is already omitted rather than described as compliance.

WhatsApp from the city header can read:

"Santo André (SP), 2023: 25,99% da receita em educação. Creche: R$ 15.257 por aluno (SIOPE 4.14). Fundeb 2025: acima do piso, sem complementação da União. Veja no Radar MDE:"

The citation for that creche figure can read:

"Radar MDE (2026). Creche, R$ por aluno, Santo André (SP), 2023. URL. Fonte: FNDE/SIOPE, indicador 4.14. Acesso em 09/10/2026."

CAQM scenario totals do not enter this paragraph. A council-sheet line enters only as a question already printed on the sheet, for example the creche waiting-list question on [#7](https://github.com/IamP5/radar-mde/pull/7), and only after that pull request is merged. The letter does not gain a count the reader typed. The sheet already says it does not bring that number, and the panel does not collect one.

## Options

**A. Paste every new number into each of the four letter templates.**

The person sees the figures, but the templates drift apart. [#7](https://github.com/IamP5/radar-mde/pull/7) already rewrites this file. A second edit of the same strings will collide. Simulated CAQM reais would be easy to paste by mistake.

**B. One `Briefing` value, and three formatters.**

`quoteSentence` writes the WhatsApp fragment and the journalist sentence in [note 3](03-maps-rankings-quote.md). `letterParagraph` writes one sourced block for all four letters. `citation` becomes a record with a source list. Missing figures are dropped, not written as zero.

**C. A new "resumo para encaminhar" page, leaving the letters untouched.**

Share and citation improve, and the legal letters stay narrow. The council member who already copies a letter still sends the 25% text. That misses the request.

## Recommendation

Option B. Letters stay requests. They gain one paragraph from published figures. The share line and the citation use the same figures so the number in the letter matches the number in the chart footer.

Use the integers already stored for the panel (15,257) rather than a second rounding of the live SIOPE value 15257.01.

## Data sources

Stage reais and the early-childhood share come from SIOPE indicators already checked live for Santo André 2023 (4.14, 4.5, 2.4). [#6](https://github.com/IamP5/radar-mde/pull/6) is the panel copy of that extract. Union top-up comes from the FNDE VAAT CSV cited in the index, through `fundebSentence()` on [#4](https://github.com/IamP5/radar-mde/pull/4). Council questions come from the static sheet on [#7](https://github.com/IamP5/radar-mde/pull/7). No new download is required for this note.

CAQM is not a source for the letter. The 18/16/61/5 mix is an assumption ([note 4](04-researcher-rigor.md)).

## Types, modules, and routes

No new route. The city page, `#agir`, the share menu, and "Copiar citação" stay where they are.

```ts
type Figure =
  | { kind: "stage"; year: number; code: "4.14" | "4.5" | "2.4"; label: string; value: number | null }
  | { kind: "topup"; year: number; vaat: number | null; floor: number | null; complement: number | null }
  | { kind: "sheet"; year: number; question: string };

type Briefing = { cityId: string; year: number; figures: Figure[] };

type CitationSource = { name: string; detail?: string };
type Citation = { title: string; url: string; sources: CitationSource[]; accessed: string };
```

`web/src/lib/briefing.ts` builds a `Briefing` from the year record plus, when those modules exist, the stage row and the Fundeb cell. `quoteSentence(figure)` returns `string | null`. `letterParagraph(briefing)` joins the non-null sentences. `formatCitation(citation)` replaces the current one-argument `citation()` and keeps the same visible order (tool, year, title, URL, source, access date). Callers that only have FNDE/SIOPE pass a one-item `sources` list, so current charts do not change wording except for the indicator code when the chart has one.

`buildTemplates` appends `letterParagraph` once. It does not grow a fifth template.

## Risks and blast radius

[#7](https://github.com/IamP5/radar-mde/pull/7) moves `tribunal` and `listYears` and rewrites the pandemic sentence in `templates.ts`. Land the paragraph after that rewrite, or add it in one place.

`verdict.ts` is also touched by [#7](https://github.com/IamP5/radar-mde/pull/7). Keep `summary()` as the legal verdict. Put the extra figures in a separate string so the badge logic stays put. The share menu concatenates them.

`citation()` is not edited by any of the four branches. Changing its signature still touches every chart export and the Dados page. Do that in the first slice, before Silva 2021 is appended.

The letter must not state a complement of zero when the CSV cell is `-`. For Santo André (SP) the sentence is "A União não complementa esta rede nessa publicação", which matches a dash, not a zero-real transfer.

A city with no stage row gets no stage sentence. Creche coverage on [#6](https://github.com/IamP5/radar-mde/pull/6) ends in 2024.

## Size

Medium. One new module, a paragraph in the four letters, the share string, and a citation type. The data already exists once #4 and #6 are merged. The citation type can land earlier, on `main`.

## Acceptance criteria

- On Santo André (SP) 2023, after #4 and #6, the copied "Pedir dados" letter contains the 4.14 sentence with R$ 15.257 and does not contain a CAQM total.
- The same letter for a year with no stage row does not invent a creche figure.
- WhatsApp from "Compartilhar" contains the 25% verdict and the creche fragment, and the click stays on the city page.
- "Copiar citação" on the creche chart names indicador 4.14.
- A chart that is still the MDE series still cites FNDE/SIOPE and does not gain an empty extra source.
- The four letter tabs still share one typed name, and "Desfazer edições" still restores the generated text.

## Verification with verify-radar-mde

Update `.cursor/skills/verify-radar-mde/features/letters.md`, `share.md`, and `chart-export.md` in the same change. Keep each file to one opening paragraph and the four required headings in `features/README.md`.

Launch with `./scripts/control-radar-mde launch`, export `RADAR_VERIFY_RUN_ID`, and require `doctor` ok.

Letters. Open `/sp/santo-andre`, choose "O que posso fazer?", fill "Seu nome", copy "Pedir dados", and read `browser clipboard`. The text contains the name, `Santo André`, `4.14`, and `15.257` when the stage panel is on. Switch to "Fiscalização" and copy again. The same paragraph is present. Edit the letter, undo, and confirm the generated paragraph returned.

Share. Follow `share.md` for the year query. Open "Enviar no WhatsApp" and read `outbound`. The `wa.me` text contains `4.14` and the URL. The path is still `/sp/santo-andre`.

Citation. On the creche chart, choose "Copiar citação" and read the clipboard. It contains `4.14` and `FNDE/SIOPE`.

Screenshot and ARIA snapshot go under the run evidence directory, with the Radar MDE header visible. Then `cleanup`, then `evidence list`.
