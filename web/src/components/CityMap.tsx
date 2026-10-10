"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BINS, binColor } from "@/lib/bins";
import { MDE_MIN, pct } from "@/lib/format";
import { cityPath, ofUf } from "@/lib/geo";
import { loadIndex, type IndexEntry } from "@/lib/indice";
import Choropleth, { Legend } from "./Choropleth";

/** [IBGE id, MDE %, not declared (1)] — compact so each of the 5.570 static pages stays light. */
export type CityMapValue = [number, number | null, 0 | 1];

/** Locator map: the municipality outlined among its state's neighbours, coloured by MDE % in one year. */
export default function CityMap({
  uf,
  values,
  highlight,
  query = "",
}: {
  uf: string;
  values: CityMapValue[];
  highlight: number;
  query?: string;
}) {
  const map = useMemo(
    () => new Map(values.map(([id, v, nd]) => [id, { v, nd: nd === 1 }])),
    [values],
  );
  // names and links come from the shared index (also used by search), fetched only when the reader reaches for
  // the map (pointer, touch or focus): tooltips and clicks need them, a glance at the colours doesn't (PERF-07)
  const [names, setNames] = useState<Map<number, IndexEntry> | null>(null);
  const [failed, setFailed] = useState(false);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    loadIndex()
      .then((rows) => live && setNames(new Map(rows.map((r) => [r.id, r]))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [wanted]);
  const want = () => !wanted && setWanted(true);
  const fill = useCallback((id: number) => binColor(map.get(id)?.v), [map]);
  const hatched = useCallback((id: number) => !!map.get(id)?.nd, [map]);
  // below the minimum is outlined too, so it survives grayscale, colour-blindness and print
  const outlined = useCallback(
    (id: number) => {
      const v = map.get(id)?.v;
      return v != null && v < MDE_MIN;
    },
    [map],
  );
  const href = useCallback(
    (id: number) => {
      const n = names?.get(id);
      return n ? `${cityPath(uf, n.slug)}${query}` : null;
    },
    [names, uf, query],
  );
  return (
    <>
      <div onPointerEnter={want} onTouchStart={want} onFocusCapture={want}>
        <Choropleth
          src={uf}
          layer="mun"
          fill={fill}
          hatched={hatched}
          outlined={outlined}
          href={href}
          highlight={highlight}
          height={420}
          ariaLabel={`Mapa dos municípios ${ofUf(uf)} com o município destacado`}
          tooltip={(id) => {
            const v = map.get(id);
            return (
              <>
                <div className="text-base font-medium tnum">
                  {v?.nd ? (
                    <span className="text-critical">Não declarou</span>
                  ) : v?.v == null ? (
                    "Sem dados"
                  ) : (
                    pct(v.v)
                  )}
                </div>
                <div className="text-muted-foreground">
                  {names?.get(id)?.name ?? "…"}
                </div>
              </>
            );
          }}
        />
      </div>
      <Legend
        title="% aplicado em MDE"
        bins={BINS}
        outlined={(b) => b.key === "b1" || b.key === "b2"}
      />
      {failed && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Não foi possível carregar os nomes dos municípios; o mapa mostra só as
          cores. Recarregue a página para tentar de novo.
        </p>
      )}
    </>
  );
}
