# Radar CAQM

A municipality page opens a citizen simulation of a municipal quality cost. The school community changes a parameter and the cost moves. The proposal is on the same page for printing.

## Sub-features

- `caqm-open` opens the simulation from Santo André and shows the cost seeded from that city's declared spending.
- `caqm-edit` changes students per creche class and updates the cost.
- `caqm-small` opens the same simulation for Serra da Saudade, a municipality of under a thousand residents.
- `caqm-print` shows the proposal, including the chosen parameters, in the print layout.

## How to get to it (user POV)

- On `/sp/santo-andre`, choose `Simular o CAQM`.
- Open `/sp/santo-andre/caqm`.
- Open `/mg/serra-da-saudade/caqm`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Open from the city.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role button --name "Simular o CAQM"`. The URL path is `/sp/santo-andre/caqm`. A level-1 heading named `CAQM de Santo André` is visible.
- **Seeded cost.** Run `./scripts/control-radar-mde browser wait --text "311.202.603"`. The result region `Resultado da simulação` is visible.
- **Change a parameter.** Run `./scripts/control-radar-mde browser fill --role textbox --name "Alunos por turma na creche" --value "12"`. Run `./scripts/control-radar-mde browser wait --text "366.794.866"`. The address contains `cc=12`.
- **Proof of the edit.** Run `./scripts/control-radar-mde browser screenshot --path caqm/santo-andre.png` and `./scripts/control-radar-mde browser snapshot --aria --path caqm/santo-andre.aria.txt`.
- **Proposal.** Run `./scripts/control-radar-mde browser wait --role heading --name "Proposta para a revisão do PME"`. A button named `Imprimir proposta` is visible.
- **Small municipality.** Run `./scripts/control-radar-mde browser open /mg/serra-da-saudade/caqm`. A level-1 heading named `CAQM de Serra da Saudade` is visible. Run `./scripts/control-radar-mde browser wait --text "1.874.436"`.
- **Proof of the small city.** Run `./scripts/control-radar-mde browser screenshot --full-page --path caqm/serra-da-saudade.png` and `./scripts/control-radar-mde browser snapshot --aria --path caqm/serra-da-saudade.aria.txt`.
- **Phone.** Run `./scripts/control-radar-mde browser viewport --preset phone`. Run `./scripts/control-radar-mde browser screenshot --path caqm/serra-phone.png`. Run `./scripts/control-radar-mde browser viewport --preset desktop`.

## Gotchas

- The cost is a simulation. The page says it is not the official CAQ. The recipe checks the figure, not a legal determination.
- Two cities are named Santo André. This recipe uses `/sp/santo-andre` and the heading `CAQM de Santo André`.
- `311.202.603` is the default cost for Santo André in the latest exercise with data. `366.794.866` is the same scenario with 12 students per creche class. A rebuilt dataset can move the implicit enrolment and these figures.
- The creche field is a text box. Fill replaces the whole value.
- `Simular o CAQM` is an anchor. Base UI exposes it as a button, and the click still follows the href.
- Print hides the parameter fields and the buttons. The proposal heading and the parameter list stay. The print screenshot is taken with the browser in print media, outside this click path, and saved next to these files.
