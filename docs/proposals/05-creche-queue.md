# Creche waiting list

## The problem

The only waiting-list count in the product is 7,116. [#5](https://github.com/IamP5/radar-mde/pull/5) stores it as `THESIS_CRECHE_QUEUE` and offers, on Santo André only, "Somar a fila de creche de 2019". [#7](https://github.com/IamP5/radar-mde/pull/7) asks "Quantas crianças estão na fila de espera por vaga em creche, e qual é o plano para atendê-las?" and answers "Esta ficha não traz esse número."

A parent or a council member who knows today's queue cannot type it. The panel has no database and no account. Saved cities already live in `localStorage` under `radar-mde:watch`. Recent searches use `radar-mde:recent-search`.

A national municipal waiting-list file was not found from this VM. The MEC Retrato page returned an HTML challenge, not a table. A local spreadsheet from one city, seen only as a search result, is not a source. This note does not cite a national total.

## Personas and evidence

The parent wants to set today's number next to the 2019 thesis figure, then show it to the council. The council member wants that number in the meeting, and may want it in the letter. The education secretary must not receive a letter that presents a typed count as a SIOPE declaration. The researcher must still see 7,116 as a 2019 figure from Silva, not as a live administrative record.

The journalist can quote 7,116 only with the year and the study. They should not quote a browser-local count as official.

## Journey before

On the CAQM page for Santo André, the person can add 7,116. They cannot replace it with the queue they counted this month. On any other city there is no control. The council sheet says the number is absent. The letter does not mention a queue.

## Journey after

The CAQM page, and the council sheet once [#7](https://github.com/IamP5/radar-mde/pull/7) is in, show a number field.

Label: "Fila de creche informada por você".

Help text: "Este número fica só neste navegador. O Radar não envia e não guarda em servidor."

The field accepts a non-negative integer. It does not ask for names, CPF, school, or phone.

On Santo André a second control remains, relabeled so it cannot be confused with today:

"Usar 7.116, a fila de 2019 citada na pesquisa de Santo André. Não é a fila de hoje."

Choosing it fills the field and marks the value as the thesis preset. Clearing the field forgets it. Another city does not offer 7,116.

"Copiar link" on that panel adds `?fila=` with the count, so a council member can send the number without an account. The recipient sees the count as part of the link, labeled as informed by the sender, not as a Radar measurement. If the query is missing or not an integer, the field stays empty.

The letter gains a checkbox, default off:

"Incluir na carta a fila que eu informei (não é dado oficial)".

When it is on, one sentence is appended, with the count and the label "número informado por quem escreve". When it is off, the letter does not mention a queue. The 2019 preset is included only if the person both applied the preset and checked the box, and the sentence then says 2019 and cites the dissertation.

## Options

**A. A small backend that stores the count by IBGE code.**

Any two visitors would see the same number, which is what a council wants in a meeting. It also collects a figure the project cannot verify, with no login to correct abuse, and it contradicts the current rule that user state is `localStorage` only. A public write endpoint becomes a ranking of unverified queues. Not justified by the request as it stands.

**B. `localStorage` plus a query parameter.**

The count stays on the device. A shared link carries the count in the URL, which the sender chooses to copy. No name is stored. This matches `radar-mde:watch`.

**C. Ask the person to keep the number in the letter by typing it themselves, and ship no field.**

The council sheet would still say the ficha has no number, and the CAQM button would still offer only 7,116. The parent asked for a place to put the current count.

## Recommendation

Option B. No backend until a verified official file exists, or until a signed-in council workflow is a separate project. Neither is true now.

The link is the share mechanism. It is not a database. Two parents in the same city can hold two counts. The label must say so.

## Data sources

The thesis preset is the 7,116 already in [#5](https://github.com/IamP5/radar-mde/pull/5), from Silva 2021, Santo André, 2019. The PDF download returned 200. Do not scrape a new figure out of the PDF in the client.

There is no national source to sync. Do not add a fetch script for the queue.

SIOPE does not publish this queue. Do not derive it from indicator 4.14.

## Types, modules, and routes

The route stays `/{uf}/{slug}/caqm` from [#5](https://github.com/IamP5/radar-mde/pull/5). The council route `/{uf}/{slug}/conselho` reads the same stored count so the sheet's creche question can show it under the question, still labeled as informed by the reader.

```ts
type FilaEntry = {
  ibge: string;
  count: number;
  /** thesis-2019 is only legal for IBGE 3547809 */
  origin: "reader" | "thesis-2019";
  storedAt: string;
};

const FILA_KEY = "radar-mde:fila";
```

`web/src/lib/fila.ts` reads and writes a map of IBGE code to `FilaEntry`. The parser rejects negative numbers, fractions, and strings. `?fila=1200` hydrates the field for the city in the URL and does not write other cities. Writing happens when the person leaves the field, the same way a watch toggle writes `radar-mde:watch`.

The letter checkbox is a boolean in component state, default `false`, not a second database. It uses `letterParagraph` only when checked ([note 1](01-letters-share-citation.md)).

## Risks and blast radius

[#5](https://github.com/IamP5/radar-mde/pull/5) owns the simulator and the 7,116 button. Replace that button's label in that branch rather than adding a second control.

[#7](https://github.com/IamP5/radar-mde/pull/7) owns the creche question. The sheet should keep the sentence "Esta ficha não traz esse número." and add the reader field under it. Deleting that sentence would imply the ficha now has an official count.

The letter checkbox waits until [note 1](01-letters-share-citation.md) has a single paragraph hook. Otherwise [#7](https://github.com/IamP5/radar-mde/pull/7) and this note both edit `templates.ts`.

`?fila=` must not be copied into the ordinary "Copiar link" of the city header unless the person is on the queue control. A parent sharing the 25% page should not leak a count they typed earlier. The queue panel has its own copy control.

A shared computer keeps the count in that browser profile. The help text covers that. Do not add a name field "so we know who typed it".

Very large integers are rejected above a stated cap (for example one million) so a stray paste cannot render as a national total. The cap is a guard, not a statistic.

## Size

Small. One `localStorage` map, one numeric field, one preset on a single IBGE code, one query parameter, one checkbox. No server, no new dependency.

## Acceptance criteria

- Santo André can apply 7,116. The visible text says 2019 and that it is not today's queue.
- The person can replace it with 1200. Reload shows 1200. `radar-mde:fila` contains IBGE `3547809` and does not contain a name.
- Opening the same URL with `?fila=900` shows 900 for that city and does not change a different city already stored.
- `?fila=abc` leaves the field empty.
- Another municipality has the field and does not have the 7,116 preset.
- The letter omits the queue until the checkbox is on. With the checkbox on, the letter says the number was informed by the writer.
- No request to a Radar route carries the count. The only copy that includes it is the link the person copies on that panel.

## Verification with verify-radar-mde

Add `features/caqm.md` if [#5](https://github.com/IamP5/radar-mde/pull/5) has not already added it, and extend `features/letters.md` for the checkbox. Follow the four-heading contract. The skill's localStorage list in `SKILL.md` gains `radar-mde:fila` when the key ships.

Preconditions. `doctor` ok. Start from a fresh profile so the key is absent. `browser storage get --key radar-mde:fila` is empty.

Preset. Open `/sp/santo-andre/caqm`. Choose the 2019 control. The field value is `7116`. The nearby text contains "2019" and "Não é a fila de hoje".

Replace. Fill the field with `1200`. Read the storage key. It includes `3547809` and `1200`. Reload the page. The field is still `1200`.

Link. Choose the queue panel's copy control. The clipboard contains `fila=1200`. Open that URL in the same run. The field shows `1200`.

Isolation. Open a second city CAQM page. Its field is empty. Storage still has only the first IBGE code until the person types there.

Letter. Open `#agir`. Copy "Pedir dados" with the box off. The clipboard does not contain `1200`. Turn the box on, copy again, and confirm the clipboard contains `1200` and "não é dado oficial" (or the exact opt-in sentence).

Screenshot the field and the checkbox. ARIA snapshot includes the label "Fila de creche informada por você". Then `cleanup` and `evidence list`.

Do not assert a national queue figure anywhere in the recipe.
