# Proposals for five panel improvements

These notes specify five changes to Radar MDE. They do not change the panel. The open feature pull requests stay as they are. [#4](https://github.com/IamP5/radar-mde/pull/4) adds the Fundeb redistributivo view, [#5](https://github.com/IamP5/radar-mde/pull/5) adds Radar CAQM, [#6](https://github.com/IamP5/radar-mde/pull/6) adds spending by stage, and [#7](https://github.com/IamP5/radar-mde/pull/7) adds the Ficha do Conselho.

The work was read on 9 Oct 2026. `main` was `349231d`. The feature heads were `e21b836` (#4), `69e5882` (#5), `6177d2c` (#6), and `cbb3ce8` (#7). A textual merge of each branch with `main`, and of each branch with the others, produced no conflict markers. The overlap that matters is semantic and is named in each note.

Personas come from the earlier UX runs and from `qa/reports/` (citizen, journalist, government, academic). This index does not invent new quotes.

| Note | Recommendation in one line | Size |
| --- | --- | --- |
| [Letters, share text, and citation](01-letters-share-citation.md) | One `Briefing` feeds a sourced paragraph, the WhatsApp line, and a typed citation. Leave CAQM totals out of the letter. | Medium |
| [Topic search](02-topic-search.md) | A topic alias wins over a fuzzy city, and same-name cities show the state in the label. | Small |
| [Maps, rankings, and a quotable sentence](03-maps-rankings-quote.md) | Add creche and EJA as map layers from a small sidecar, reuse the Fundeb map, and attach one neutral sentence. | Medium |
| [Researcher rigor](04-researcher-rigor.md) | Add the TCE-SP committed-spending column beside SIOPE, cite Silva 2021 as a second reference, and keep the CAQM mix until the census zip downloads. | Medium, census blocked |
| [Creche waiting list](05-creche-queue.md) | Store a count in this browser and in the link. Do not add a backend. | Small |

## Sequence

Land the seams before the surfaces that depend on them.

1. Topic search can start on `main`. None of the four pull requests edit `web/src/lib/search.ts`.
2. In parallel, add the citation record from [note 1](01-letters-share-citation.md). It is a type and a formatter. [Note 4](04-researcher-rigor.md) appends Silva 2021 to that list.
3. In parallel, write the TCE-SP fetch script and check it against Santo André. Do not edit `web/src/lib/csv.ts` or the city page until [#6](https://github.com/IamP5/radar-mde/pull/6) has settled the CSV columns. [#4](https://github.com/IamP5/radar-mde/pull/4) also adds Fundeb columns in that same export.
4. Map layers and the neutral ranking caption wait for [#6](https://github.com/IamP5/radar-mde/pull/6) (stage fields) and [#4](https://github.com/IamP5/radar-mde/pull/4) (the Fundeb map). Do not build a second top-up map.
5. The letter paragraph and the WhatsApp line wait for `quoteSentence` and for [#7](https://github.com/IamP5/radar-mde/pull/7), which rewrites `web/src/lib/templates.ts`.
6. The waiting-list field waits for [#5](https://github.com/IamP5/radar-mde/pull/5), which already has the Santo André button for 7,116. The letter checkbox waits for the letter paragraph.
7. Replacing the CAQM mix waits on a machine that can unzip the INEP file. It does not block the other four notes. It sits on [#5](https://github.com/IamP5/radar-mde/pull/5).

What can run in parallel now:

- Topic search, the citation type, and the TCE-SP fetch script.
- After [#5](https://github.com/IamP5/radar-mde/pull/5) and [#6](https://github.com/IamP5/radar-mde/pull/6) merge, the waiting-list field and the map sidecar can proceed together.
- The letter paragraph and the census mix both touch the citation. The typed source list is the shared seam. They should not edit `citation()` at the same time.

## Sources checked from this machine

Downloads were issued from this VM on 9 Oct 2026. A catalog page is not treated as a downloaded file.

| Source | What happened |
| --- | --- |
| Thesis PDF, Silva 2021, UNINOVE | `https://bibliotecatede.uninove.br/bitstream/tede/2464/2/Adriana%20Zanini%20da%20Silva.pdf` returned 200, `application/pdf`, 5,614,012 bytes. |
| FNDE VAAT CSV, Portaria MEC/MF nº 5, 29 Apr 2026 | The URL in `scripts/fetch_fundeb.py` on the #4 branch returned 200, 385,776 bytes. Santo André (SP), IBGE 3547809, VAAT 13.914,20, complementação `-`, IEI 0%. Santo André (PB), IBGE 2513851, VAAT 7.259,40, complementação 507.683,95, IEI 52,09%. VAAT-MIN in that file is 8.024,31. |
| SIOPE OData | `Indicadores_Siope` for 2023, period 6, UF `SP`, `COD_MUNI` 354780 (six digits, no check digit), returned Municipal Santo André. Indicator 4.14 is 15257.01, 4.5 is 15351.42, 2.4 is 40.02. |
| TCE-SP Audesp | Catalog `https://transparencia.tce.sp.gov.br/conjunto-de-dados` returned 200. `resultado_analises_audesp.zip` returned 200, `application/zip`, 480,158 bytes. The CSV has 6,440 rows, 644 municipalities, years 2016 to 2025. IBGE 3550308 (capital) is absent. |
| INEP synopsis catalog | `https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica` returned 200 and lists `sinopse_estatistica_censo_escolar_2024.zip` (also 2023 and 2025). `download.inep.gov.br` did not complete a file transfer from this VM (`SSL_ERROR_SYSCALL`, including with certificate checks disabled). Sheet names inside the zip were not read. |
| INEP microdata catalog | `https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar` returned 200 and lists microdata zips. Those zips were not downloaded. |
| MEC Retrato da Educação | The page and the PDF URL returned an HTML challenge, not a PDF and not a CSV. |
| National creche waiting list | No municipal file downloaded. Do not cite a national total from this work. |

Panel integers for Santo André 2023 on the #6 branch match the SIOPE reais truncated to the real. Creche 15,257, pré-escola 15,759, educação infantil 15,497, ensino fundamental 16,666, EJA 15,351. Early-childhood share 40.02. Creche fields in that file stop at 2024.

Search behavior was checked by bundling `web/src/lib/search.ts` and running it on `cities.json`. `creche` returns only Frecheirinha (CE). `fila` returns Filadélfia (BA) as a prefix. `conselho` returns Bom Conselho (PE). `Fundeb` returns nothing. `eja` returns eight cities by substring. `santo andre` returns São Paulo first, then Paraíba. Two hundred forty municipality names are shared by more than one city. No city name contains `creche`.

## How these notes were shaped

The task was framed as a design deliverable. Done means these files exist, each option was compared, and every source above was fetched or recorded as a failed fetch. The runtime of the panel does not change in this pull request.

Experience-first set the journeys. Exhaust-the-design-space required two or three options in each note before a recommendation. Model-the-domain produced the types (`Briefing`, `Topic`, `Quote`, `Audesp` column, `FilaEntry`). Foundational-thinking kept a letter, a search hit, a ranking, an audit figure, and a waiting list as different objects. Blast-radius checked the four open branches. Architect placed the shared types at the seams those branches already touch. Prove-it-works is the verification section in each note, aimed at `verify-radar-mde` when the change is built. Sequence-verifiable-units is the order above.

An arena of extra models was not used to draft competing implementations. The comparison the reader needs is the options section in each note.

The decision trail is [decisions.tsv](decisions.tsv).

## Mockups

Low-fidelity screens, not the product.

- [Search for creche](mockups/search-creche.png)
- [Two cities named Santo André](mockups/search-homonyms.png)
- [Neutral ranking and quotable sentence](mockups/ranking-quote.png)
- [Waiting list and letter opt-in](mockups/fila-carta.png)
