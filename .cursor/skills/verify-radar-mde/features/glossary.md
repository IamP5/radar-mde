# Glossary

Dotted words on a municipality page open a short definition. The definition stays on the page until it is dismissed.

## Sub-features

- `glossary-cacs` opens the definition of CACS-Fundeb.
- `glossary-esic` opens the definition of e-SIC.
- `glossary-dismiss` closes the definition with Escape.

## How to get to it (user POV)

- On a city page, choose a dotted word. Each one is named with `: o que é?`.
- The letters section uses `e-SIC`, `CACS-Fundeb`, and `Tribunal de Contas`.
- The indicators use `MDE`, `Fundeb`, `Mediana`, and `Déficit`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Open CACS-Fundeb.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role button --name "CACS-Fundeb: o que é?"`. The text `Conselho de Acompanhamento e Controle Social do Fundeb` is visible: `./scripts/control-radar-mde browser wait --text "Conselho de Acompanhamento e Controle Social do Fundeb"`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path glossary/cacs.png` and `./scripts/control-radar-mde browser snapshot --aria --path glossary/cacs.aria.txt`. The screenshot shows the Radar MDE header and the definition.
- **Close it.** Run `./scripts/control-radar-mde browser press --key Escape`.
- **Open e-SIC.** Run `./scripts/control-radar-mde browser click --role button --name "e-SIC: o que é?"`. Run `./scripts/control-radar-mde browser wait --text "Lei de Acesso à Informação"`.

## Gotchas

- `MDE: o que é?` is on the page more than once. A click with that name is refused. Use a name that occurs once, such as `CACS-Fundeb: o que é?` or `e-SIC: o que é?`.
- The definition is a popover, not a new page. Escape closes it. The city heading does not change.
- Terms in the letters section sit far down the page. The click scrolls them into view.
