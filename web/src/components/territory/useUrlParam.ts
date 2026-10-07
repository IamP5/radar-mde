"use client";

import { useEffect, useState } from "react";

/**
 * A small piece of view state mirrored to one query parameter (JOR-26: `?valores=ipca`, `?serie=faltou`,
 * `?mapa=municipios`…). Read after mount so the prerendered HTML stays static; written with replaceState
 * (no history entries); the default value removes the parameter.
 */
export function useUrlParam<T extends string>(key: string, values: Record<T, string>, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    const hit = (Object.keys(values) as T[]).find((k) => values[k] === raw);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is only readable after hydration
    if (hit && hit !== initial) setValue(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once
  }, []);
  const set = (v: T) => {
    setValue(v);
    const u = new URL(window.location.href);
    if (v === initial) u.searchParams.delete(key);
    else u.searchParams.set(key, values[v]);
    window.history.replaceState(window.history.state, "", u);
  };
  return [value, set] as const;
}
