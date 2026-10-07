"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const read = () => `${window.location.origin}${window.location.pathname}${window.location.search}`;

/** Print-only line under the page title: where the page lives and when it was printed (GOV-07). */
export function PrintMeta() {
  const url = useSyncExternalStore(noop, read, () => "");
  const date = useSyncExternalStore(noop, () => new Date().toLocaleDateString("pt-BR"), () => "");
  return (
    <p className="print-only mt-2 text-xs text-muted-foreground">
      Radar MDE · Brasil{url && <> — {url}</>}
      {date && <> — impresso em {date}</>}. Fonte: FNDE/SIOPE (valores declarados pelos municípios).
    </p>
  );
}
