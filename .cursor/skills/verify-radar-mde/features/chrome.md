# Footer and skip link

The footer repeats the six sections and links the license. The first stop on the keyboard is Pular para o conteúdo, which moves to the main area.

## Sub-features

- `footer-dados` opens Dados abertos from the footer, not from the header.
- `footer-license` shows the CC BY 4.0 link.
- `skip-link` reveals Pular para o conteúdo and moves to the content.

## How to get to it (user POV)

- At the bottom of any page except the map, choose Painel, Mapa, Explorar, Salvos, Dados, or Metodologia.
- Choose `CC BY 4.0` for the license, which opens in a new tab.
- Press Tab once from the top of the page. `Pular para o conteúdo` appears. Activate it to reach the content.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The map hides the footer and the skip target's header. Start on the national panel.

- **Footer Dados.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser click --role link --name "Dados" --exact --within-role contentinfo`. Run `./scripts/control-radar-mde browser wait --url-includes "/dados" --timeout 90000`. The URL path is `/dados`. A level-1 heading named `Dados abertos` is visible.
- **License.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser find --role link --name "CC BY 4.0" --within-role contentinfo`. The count is 1. Do not open it; it leaves Radar MDE.
- **Skip link.** Run `./scripts/control-radar-mde browser press --key Tab`. Run `./scripts/control-radar-mde browser wait --role link --name "Pular para o conteúdo"`. Run `./scripts/control-radar-mde browser screenshot --path chrome/skip.png` and `./scripts/control-radar-mde browser snapshot --aria --path chrome/skip.aria.txt`. The screenshot shows the Radar MDE header and `Pular para o conteúdo`.
- **Activate it.** Run `./scripts/control-radar-mde browser click --role link --name "Pular para o conteúdo"`. The URL contains `#conteudo`.

## Gotchas

- `Dados` is in the header navigation and in the footer. Scope the footer with `--within-role contentinfo`. The header navigation is named `Principal`.
- The license link navigates to Creative Commons. `find` proves it. Following it is not part of the recipe.
- `Pular para o conteúdo` is hidden until it receives focus. Tab once from a freshly opened page. A later Tab starts from wherever focus already is.
- The map does not show the site footer. These controls are on the other pages.
