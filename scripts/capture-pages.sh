#!/usr/bin/env bash
# Screenshot the key pages of a live verification run into one directory.
# Usage: RADAR_VERIFY_RUN_ID=<id> scripts/capture-pages.sh <absolute-out-dir>
set -euo pipefail

out=${1:?usage: capture-pages.sh <absolute-out-dir>}
: "${RADAR_VERIFY_RUN_ID:?export RADAR_VERIFY_RUN_ID from control-radar-mde launch}"
cli="$(cd "$(dirname "$0")/.." && pwd)/scripts/control-radar-mde"
mkdir -p "$out"

b() { "$cli" browser "$@" >/dev/null; }
shot() { b screenshot --path "$out/$1.png" ${2:+--full-page}; }

pages=(
  "panel /"
  "explorer /explorar"
  "map /mapa"
  "state /sp"
  "region /regiao/nordeste"
  "municipality /sp/santo-andre"
  "saved /acompanhar"
  "sobre /sobre"
  "dados /dados"
  "not-found /nao-existe"
)

b viewport --preset desktop
b storage set --key theme --value light
for entry in "${pages[@]}"; do
  read -r name path <<<"$entry"
  b open "$path"
  sleep 1.5
  shot "$name" full
done

b open /
b click --role button --name "Digite o nome da sua cidade"
b fill --role combobox --name "Buscar" --value "santo"
sleep 0.8
shot search-dialog

b open /sp/santo-andre
b click --role button --name "CACS-Fundeb: o que é?"
sleep 0.5
shot glossary-popover
b press --key Escape

b click --role link --name "O que posso fazer?"
sleep 0.5
b click --role tab --name-regex "Fiscaliza"
sleep 0.5
shot letters

b open /explorar
b click --role combobox --name "UF" --exact
sleep 0.5
shot explorer-select-open
b press --key Escape

b storage set --key theme --value dark
for entry in "panel /" "municipality /sp/santo-andre" "explorer /explorar"; do
  read -r name path <<<"$entry"
  b open "$path"
  sleep 1.5
  shot "$name-dark"
done
b storage set --key theme --value light

b viewport --preset phone
for entry in "panel /" "municipality /sp/santo-andre"; do
  read -r name path <<<"$entry"
  b open "$path"
  sleep 1.5
  shot "$name-phone"
done
b viewport --preset desktop

ls "$out"
