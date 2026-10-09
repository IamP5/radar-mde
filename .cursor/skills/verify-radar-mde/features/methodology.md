# Methodology

Metodologia explains where the numbers come from, how the minimum is calculated, and what the panel cannot say. A list on the side jumps to each section, and the page points at the downloadable data.

## Sub-features

- `method-open` shows the Metodologia heading.
- `method-section` jumps to Cálculos.
- `method-data` opens Dados abertos from this page.
- `method-source` shows the link to the research the panel came from.

## How to get to it (user POV)

- Choose `Metodologia` in the header. On a very narrow phone the same item is labeled `Método`.
- Choose `Metodologia` in the footer.
- Open `/sobre`.
- The side list `Nesta página` jumps to Origem, O que é medido, De onde vêm os dados, Indicadores do SIOPE, Do Brasil ao município, Cálculos, Limites, Versão e como citar, and Próximos passos.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The window is 1440×900, so the side list `Nesta página` is visible. The short header label `Método` is not.

- **Open the page.** Run `./scripts/control-radar-mde browser open /sobre`. The URL path is `/sobre`. A level-1 heading named `Metodologia` is visible.
- **Jump to Cálculos.** Run `./scripts/control-radar-mde browser click --role link --name "Cálculos" --within-role complementary --within-name "Nesta página"`. The URL hash is `#calculos`. A level-2 heading named `Cálculos` is visible.
- **Open the data page.** Run `./scripts/control-radar-mde browser click --role link --name "Baixar os dados" --within-role complementary --within-name "Nesta página"`. Run `./scripts/control-radar-mde browser wait --url-includes "/dados" --timeout 90000`. The URL path is `/dados`. A level-1 heading named `Dados abertos` is visible.
- **Research link.** Run `./scripts/control-radar-mde browser open /sobre`. Run `./scripts/control-radar-mde browser find --role link --name-regex "financiamento da Educação Básica"`. The count is 1. Do not open it; it leaves Radar MDE.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --full-page --path methodology/origem.png` and `./scripts/control-radar-mde browser snapshot --aria --path methodology/origem.aria.txt`. The screenshot shows the Radar MDE header and `Metodologia`.

## Gotchas

- The side list is hidden below the wide layout. At 1440×900 it is the region named `Nesta página`. The list itself is not a navigation with that name. Do not click a `Cálculos` link that is not inside that region.
- The header label `Método` is the same destination, shown only under 460 pixels wide. This window cannot show it. The phone-navigation recipe records that gap.
- The research PDF is on another site. `find` proves the link.
