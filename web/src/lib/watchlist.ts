"use client";

import { useSyncExternalStore } from "react";

const KEY = "radar-mde:watch";
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot() {
  const v = read();
  if (v !== cache) cache = v;
  return cache;
}

/** Entries are "uf/slug" (e.g. "sp/santo-andre"); bare slugs saved before the national version were all from SP. */
export function useWatchlist(): [string[], (id: string) => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  let list: string[] = [];
  try {
    list = (JSON.parse(raw) as string[]).map((s) => (s.includes("/") ? s : `sp/${s}`));
  } catch {}
  const toggle = (id: string) => {
    const next = list.includes(id) ? list.filter((s) => s !== id) : [...list, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    listeners.forEach((l) => l());
  };
  return [list, toggle];
}
