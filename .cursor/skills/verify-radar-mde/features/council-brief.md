# Council sheet

The council sheet (Ficha para o conselho) is one printable page per municipality and exercise for a member of the education council or the Câmara. It lists each legal rule with every source's figure side by side, where the money went, five exercises of context, and questions to take to the next meeting.

## Sub-features

- `council-open` opens the sheet from the city page on the selected year.
- `council-sources` shows the declared SIOPE figure and the audited TCE-SP figure on the same MDE line, each with its own badge.
- `council-money` keeps the money block on the declared percent and names the other source.
- `council-questions` lists 8 to 10 questions, the ones from the data first.
- `council-year` changes the exercise with the year control and keeps it in the address.
- `council-nd` shows a whole sheet for a year the municipality did not declare.
- `council-saved` opens the sheet from Salvos.

## How to get to it (user POV)

- On a city page, in `O que você pode fazer`, choose `Ficha para o conselho`. A year other than the opening year carries over.
- On Salvos, choose the clipboard icon on the city's row (`Ficha para o conselho de <city>`).
- Open `/<uf>/<slug>/conselho`, with `?ano=<year>` for an exercise other than the latest.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The saved list is empty, as after a fresh launch. The Salvos step seeds one city and clears it again.

- **Open from the city page.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. Run `./scripts/control-radar-mde browser click --role link --name "Ficha para o conselho" --exact`. The URL path is `/sp/santo-andre/conselho` and contains `ano=`. Run `./scripts/control-radar-mde browser wait --role heading --name "Ficha para o conselho"`.
- **Two sources on one line.** Run `./scripts/control-radar-mde browser open "/sp/santo-andre/conselho?ano=2016"`. Run `./scripts/control-radar-mde browser wait --text "Exercício de 2016"`. Run `./scripts/control-radar-mde browser text --role listitem --name "Aplicação mínima em educação (MDE)"`. The text contains `SIOPE 25,05% No limite (25–26%)` and `TCE-SP 21,87% Abaixo do mínimo`. It does not contain `SIOPE 25,05% Abaixo do mínimo`.
- **Money stays on the declared figure.** Run `./scripts/control-radar-mde browser text --role region --name "Para onde vai o dinheiro"`. The text contains `≈ R$ 325,8 mi` and `TCE-SP indica 21,87% para este ano. Confirme na fonte.` It does not contain `Abaixo do mínimo`.
- **Questions.** Run `./scripts/control-radar-mde browser text --role region --name "Perguntas para a próxima reunião"`. The text contains `Em 2012, 2014 e 2016` and `compensar essa diferença`. Run `./scripts/control-radar-mde browser find --role listitem --within-role region --within-name "Perguntas para a próxima reunião"`. `count` is 10.
- **Change the exercise.** Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. The URL contains `ano=2015`. Run `./scripts/control-radar-mde browser wait --text "Exercício de 2015"`.
- **A year not declared.** Run `./scripts/control-radar-mde browser open "/sp/paulinia/conselho?ano=2025"`. Run `./scripts/control-radar-mde browser wait --text "Exercício de 2025"`. Run `./scripts/control-radar-mde browser text --role listitem --name "Aplicação mínima em educação (MDE)"`. The text contains `SIOPE sem dado Não declarou`. Run `./scripts/control-radar-mde browser text --role region --name "Para onde vai o dinheiro"`. The text contains `Aplicado em MDE Não declarou`. Run `./scripts/control-radar-mde browser wait --role heading --name "Fontes"`. The last section is there.
- **From Salvos.** Run `./scripts/control-radar-mde seed watch add --id sp/santo-andre`. Run `./scripts/control-radar-mde browser open /acompanhar`. Run `./scripts/control-radar-mde browser click --role link --name "Ficha para o conselho de Santo André"`. The URL path is `/sp/santo-andre/conselho`. Run `./scripts/control-radar-mde seed watch clear`.
- **Proof.** Run `./scripts/control-radar-mde browser open "/sp/santo-andre/conselho?ano=2016"` and `./scripts/control-radar-mde browser wait --text "Exercício de 2016"`. Run `./scripts/control-radar-mde browser screenshot --full-page --path council-brief/santo-andre-2016.png` and `./scripts/control-radar-mde browser snapshot --aria --path council-brief/santo-andre-2016.aria.txt`. The screenshot shows the Radar MDE header and `Ficha para o conselho`.

## Gotchas

- `?ano=` is applied after the page loads. Wait for `Exercício de <year>` before reading text, or the sheet may still show the latest exercise.
- `Ficha para o conselho` on the city page is a link. `O que posso fazer?` and `Dados brutos de …` in the city header are buttons.
- The sheet does not choose between SIOPE and TCE-SP. `Abaixo do mínimo` on the TCE-SP reading is expected. The same words on the SIOPE reading or in the money block are a failure.
- Only Santo André SP has the TCE-SP reading. Santo André PB (`/pb/santo-andre/conselho`) has one reading per line.
- The Salvos link has no `ano=`, so the sheet opens on the city's latest exercise.
- `Imprimir` opens the browser's print dialog, which this CLI does not drive.
