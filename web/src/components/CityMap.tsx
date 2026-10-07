"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BINS, binColor } from "@/lib/bins";
import { pct } from "@/lib/format";
import { cityPath, ofUf } from "@/lib/geo";
import { loadIndex, type IndexEntry } from "@/lib/indice";
import Choropleth, { Legend } from "./Choropleth";

/** [IBGE id, MDE %, not declared (1)] — compact so each of the 5.570 static pages stays light. */
export type CityMapValue = [number, number | null, 0 | 1];

/** Locator map: the municipality outlined among its state's neighbours, coloured by MDE % in one year. */
export default function CityMap({ uf, values, highlight }: { uf: string; values: CityMapValue[]; highlight: number }) {
  const map = useMemo(() => new Map(values.map(([id, v, nd]) => [id, { v, nd: nd === 1 }])), [values]);
  // names and links come from the shared index (also used by search), fetched once per session
  const [names, setNames] = useState<Map<number, IndexEntry> | null>(null);
  useEffect(() => {
    let live = true;
    loadIndex()
      .then((rows) => live && setNames(new Map(rows.map((r) => [r.id, r]))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const fill = useCallback((id: number) => binColor(map.get(id)?.v), [map]);
  const hatched = useCallback((id: number) => !!map.get(id)?.nd, [map]);
  const href = useCallback((id: number) => {
    const n = names?.get(id);
    return n ? cityPath(uf, n.slug) : null;
  }, [names, uf]);
  return (
    <>
      <Choropleth
        src={uf}
        layer="mun"
        fill={fill}
        hatched={hatched}
        href={href}
        highlight={highlight}
        height={420}
        ariaLabel={`Mapa dos municípios ${ofUf(uf)} com o município destacado`}
        tooltip={(id) => {
          const v = map.get(id);
          return (
            <>
              <div className="text-base font-semibold tnum">
                {v?.nd ? <span className="text-critical">Não declarou</span> : v?.v == null ? "Sem dados" : pct(v.v)}
              </div>
              <div className="text-muted-foreground">{names?.get(id)?.name ?? "…"}</div>
            </>
          );
        }}
      />
      <Legend title="% aplicado em MDE" bins={BINS} />
    </>
  );
}
