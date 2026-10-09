# Fundeb redistribution

The Fundeb panel shows whether a municipality sits above or below the national VAAT floor, how much Union top-up it receives, the early-childhood share of that top-up, and whether the official file lists it for VAAR. The national, region, and state panels map who receives the top-up.

## Sub-features

- `fundeb-city-above` shows Santo André-SP above the floor, with no top-up.
- `fundeb-city-below` shows Santo André-PB lifted to the floor, with a top-up and an early-childhood share.
- `fundeb-missing` shows "sem dado" for an exercise the FNDE file does not cover.
- `fundeb-map` shows how many municipalities receive the top-up on the national panel.
- `fundeb-csv` downloads the Fundeb CSV and keeps the source page link on Dados.

## How to get to it (user POV)

- Open `/sp/santo-andre` and read the Fundeb panel.
- Open `/pb/santo-andre` and read the same panel.
- Open `/` and read the map "Quem recebe complementação da União".
- Open `/dados` and download Por município: piso, VAAT e complementação.
- On a city page, choose an older exercise in the page year control. The Fundeb panel says sem dado for that year.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The browser starts at 1440×900 in the light theme.

- **Santo André-SP.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. The URL path is `/sp/santo-andre`. A level-2 heading named `Fundeb: quanto há por aluno e quanto vem da União` is visible. The text `Acima do piso nacional. A União não complementa esta rede.` is visible. The text `R$ 13.914,20` is visible. Run `./scripts/control-radar-mde browser screenshot --path fundeb/sp-santo-andre.png` and `./scripts/control-radar-mde browser snapshot --aria --path fundeb/sp-santo-andre.aria.txt`.
- **Santo André-PB.** Run `./scripts/control-radar-mde browser open /pb/santo-andre`. The URL path is `/pb/santo-andre`. The same level-2 heading is visible. The text `R$ 7.259,40` is visible. The text `R$ 8.024,31` is visible. The text `R$ 507.683,95` is visible. The text `52,09%` is visible. Run `./scripts/control-radar-mde browser screenshot --path fundeb/pb-santo-andre.png` and `./scripts/control-radar-mde browser snapshot --aria --path fundeb/pb-santo-andre.aria.txt`.
- **Year without a publication.** Run `./scripts/control-radar-mde browser click --role button --name "Ano anterior"`. The URL contains `ano=`. Run `./scripts/control-radar-mde browser click --role radio --name "2024" --within-role radiogroup --within-name "Exercício do Fundeb"`. The Fundeb panel shows `sem dado`. Run `./scripts/control-radar-mde browser screenshot --path fundeb/pb-sem-dado.png`.
- **National map.** Run `./scripts/control-radar-mde browser open /`. A level-2 heading whose name starts with `Quem recebe complementação da União` is visible. The text `2.374` is visible. A link named `quem recebe complementação da União` is visible. Run `./scripts/control-radar-mde browser screenshot --path fundeb/nacional.png` and `./scripts/control-radar-mde browser snapshot --aria --path fundeb/nacional.aria.txt`.
- **CSV and source.** Run `./scripts/control-radar-mde http get /dados/csv/fundeb --save fundeb/fundeb.csv`. The status is 200. Run `./scripts/control-radar-mde browser open /dados`. A link named `Página no FNDE para 2025` is visible. Run `./scripts/control-radar-mde browser click --role link --name "Página no FNDE para 2025"`. The click's JSON `outbound` has an entry whose `url` contains `gov.br/fnde`.

## Gotchas

- Santo André exists in São Paulo and in Paraíba. The path, not the heading, tells them apart.
- The page year control and the Fundeb exercise control are different. 2026 is a Fundeb exercise and is not an MDE year. Choosing 2024 on the Fundeb control after stepping the page year is what shows sem dado. The radio name is the year.
- The national count `2.374` is municipalities with a VAAT top-up greater than zero in 2025. It matches the CSV rows for 2025 where `complementacao_vaat_rs` is greater than zero.
- The Dados links include the exercise (`Página no FNDE para 2025`) so the click matches one link. The city panel link is `Publicação no FNDE`.
- The page year radios and the Fundeb radios share year labels. The Fundeb click names the radiogroup `Exercício do Fundeb`.
