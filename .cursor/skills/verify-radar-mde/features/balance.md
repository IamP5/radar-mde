# Period balance

Saldo no período adds up, across the published years, what was applied above the 25% minimum and what fell short. The person can read it in reais of the time or in reais corrected by IPCA, group it by region or by state, sort it, and open a place from the list.

## Sub-features

- `balance-ipca` switches the figures to reais corrected by IPCA.
- `balance-group` lists states instead of regions.
- `balance-sort` sorts the list from A to Z.
- `balance-help` opens the explanation of the sum.
- `balance-open` opens Nordeste from the region list.

## How to get to it (user POV)

- On the national panel, scroll to `Saldo no período`.
- The same block is on a region page and on a state page (there the rows are municipalities).
- `Nominal` and `Corrigido (IPCA)` are the value switch. `Regiões` and `Estados` are the grouping on the national panel. `Pior saldo`, `Maior saldo`, and `A–Z` are the order.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- Start from the national panel so the groups are Regiões and Estados.

- **Open the block.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser wait --role heading --name-regex "Saldo no período"`.
- **Corrected reais.** Run `./scripts/control-radar-mde browser click --role radio --name "Corrigido (IPCA)" --within-role radiogroup --within-name "Valores do saldo"`. The URL contains `valores=ipca`.
- **States, then back to regions.** Run `./scripts/control-radar-mde browser click --role radio --name "Estados" --within-role radiogroup --within-name "Nível" --within-exact`. Run `./scripts/control-radar-mde browser click --role radio --name "Regiões" --within-role radiogroup --within-name "Nível" --within-exact`.
- **Sort A–Z.** Run `./scripts/control-radar-mde browser click --role radio --name "A–Z" --within-role radiogroup --within-name "Ordem"`.
- **Read the explanation.** Run `./scripts/control-radar-mde browser click --role button --name "Como o saldo é calculado"`. Run `./scripts/control-radar-mde browser wait --text "Para cada município e cada ano"`. Run `./scripts/control-radar-mde browser press --key Escape`.
- **Open Nordeste.** Run `./scripts/control-radar-mde browser click --role link --name "Nordeste" --within-role list --within-name "Regiões: saldo"`. Run `./scripts/control-radar-mde browser wait --url-includes "/regiao/nordeste" --timeout 90000`. The URL path is `/regiao/nordeste`. Run `./scripts/control-radar-mde browser wait --role heading --name "Região Nordeste" --exact --level 1`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path balance/nordeste.png` and `./scripts/control-radar-mde browser snapshot --aria --path balance/nordeste.aria.txt`. The screenshot shows the Radar MDE header and `Região Nordeste`.

## Gotchas

- Region cards higher on the panel are links whose names start with `Nordeste:`. The balance row is a link named `Nordeste` inside the list whose name starts with `Regiões: saldo`. Scope the click to that list.
- The map also has a radiogroup whose name starts with `Nível` (`Nível do mapa`) and a radio named `Estados`. `--within-name "Nível"` matches both. `--within-exact` keeps the balance group, whose whole name is `Nível`. That flag is accepted by the CLI and is missing from `browser --help`.
- `Corrigido (IPCA)` writes `valores=ipca` into the address. `Nominal` removes it.
- On a state page the rows are municipalities and there is no Regiões / Estados switch. This recipe uses the national panel.
- The sort and the group are not written into the address. The proof is the selected radio and the list that follows.
- A heading named `Região Nordeste` also appears as `Mapa · Região Nordeste`. The page title is the level-1 heading. Use `--exact --level 1`.
