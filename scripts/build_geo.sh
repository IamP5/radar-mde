#!/usr/bin/env bash
# Simplify IBGE meshes into TopoJSON for the web app (web/public/geo/).
#   br.topo.json      objects: mun (5.570 municípios, id) + uf (27 UFs, id = IBGE UF code)
#   uf/<UF>.topo.json object: mun, finer detail for the state dashboards
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=data/raw/br
OUT=web/public/geo
MS=web/node_modules/.bin/mapshaper
mkdir -p "$OUT/uf"

$MS -i "$RAW/malha_br_mun.json" name=mun \
  -each 'id=+codarea, uf=Math.floor(id/100000)' -filter-fields id,uf \
  -simplify 12% keep-shapes \
  -dissolve uf copy-fields= + name=uf -each 'id=uf' -filter-fields id \
  -target mun -filter-fields id \
  -o "$OUT/br.topo.json" format=topojson target=* quantization=40000

for f in "$RAW"/malha_??.json; do
  uf=$(basename "$f" .json | sed 's/malha_//')
  $MS -i "$f" name=mun -each 'id=+codarea' -filter-fields id \
    -simplify 30% keep-shapes \
    -o "$OUT/uf/$uf.topo.json" format=topojson quantization=20000 2>/dev/null
done
du -sh "$OUT/br.topo.json" "$OUT/uf"
