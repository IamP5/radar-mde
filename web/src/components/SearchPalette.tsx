"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Clock, Globe2, Landmark, Loader2, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { int, norm } from "@/lib/format";
import { REGIONS, UFS, cityPath, getRegion, getUf, regionPath, ufPath } from "@/lib/geo";
import type { RegionKey } from "@/lib/geo";
import { loadIndex as loadCityIndex } from "@/lib/indice";
import { cn } from "@/lib/utils";

/* ---------- data ---------- */

type City = { name: string; uf: string; slug: string; pop: number; key: string };

/** Lowercase, accent-free, punctuation → space. Length-preserving for NFC input, so indices map back to the name. */
const keyOf = (s: string) => norm(s.normalize("NFC")).replace(/[^a-z0-9]/g, " ");

let indexPromise: Promise<City[]> | null = null;

function loadIndex(): Promise<City[]> {
  indexPromise ??= loadCityIndex()
    .then((rows) => rows.map(({ name, uf, slug, pop }) => ({ name, uf, slug, pop, key: keyOf(name) })))
    .catch((e: unknown) => {
      indexPromise = null; // allow retry
      throw e;
    });
  return indexPromise;
}

type IndexState = { status: "idle" | "loading" | "error" } | { status: "ready"; cities: City[] };

/* ---------- matching ---------- */

type Filter = { uf?: string; region?: RegionKey };
type Reading = { text: string; filter: Filter };

const UF_NAMES = UFS.map((u) => ({ key: keyOf(u.name).split(/\s+/), filter: { uf: u.uf } as Filter }));
const REGION_NAMES = REGIONS.map((r) => ({ key: keyOf(r.name).split(/\s+/), filter: { region: r.key } as Filter }));
// Longest first so "rio grande do sul" wins over "sul"
const PLACE_NAMES = [...UF_NAMES, ...REGION_NAMES].sort((a, b) => b.key.length - a.key.length);

const startsWithSeq = (tokens: string[], seq: string[], at: number) => seq.every((t, i) => tokens[at + i] === t);

/** Possible interpretations of the query: as-is, plus with a UF/region filter pulled out. */
function readings(tokens: string[]): Reading[] {
  const out: Reading[] = [{ text: tokens.join(" "), filter: {} }];
  // UF sigla anywhere ("sp santo", "andre - sp")
  const i = tokens.findIndex((t) => t.length === 2 && getUf(t));
  if (i >= 0) {
    out.push({ text: tokens.filter((_, j) => j !== i).join(" "), filter: { uf: tokens[i].toUpperCase() } });
  }
  // UF/region full name at the start or end, only when something else remains
  for (const p of PLACE_NAMES) {
    const n = p.key.length;
    if (tokens.length <= n) continue;
    if (startsWithSeq(tokens, p.key, tokens.length - n)) {
      out.push({ text: tokens.slice(0, -n).join(" "), filter: p.filter });
      break;
    }
    if (startsWithSeq(tokens, p.key, 0)) {
      out.push({ text: tokens.slice(n).join(" "), filter: p.filter });
      break;
    }
  }
  return out;
}

/** 0 exact, 1 prefix, 2 word-prefix, 3 substring, 4 all words present; -1 no match. */
function rankName(key: string, q: string): number {
  if (!q) return 2;
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if (` ${key}`.includes(` ${q}`)) return 2;
  if (key.includes(q)) return 3;
  const words = q.split(" ");
  return words.length > 1 && words.every((w) => key.includes(w)) ? 4 : -1;
}

const passes = (c: City, f: Filter) =>
  (!f.uf || c.uf === f.uf) && (!f.region || getUf(c.uf)?.region === f.region);

type Kind = "region" | "uf" | "city";

type Option = {
  /** lowercase, unique: also the cmdk item value */
  id: string;
  kind: Kind;
  href: string;
  label: string;
  sub: string;
  uf?: string;
  pop?: number;
  hl?: [number, number];
};

function searchCities(cities: City[], tokens: string[], limit: number): Option[] {
  const rs = readings(tokens).filter((r) => r.text || r.filter.uf || r.filter.region);
  const hits: { c: City; rank: number; q: string }[] = [];
  for (const c of cities) {
    let best = -1;
    let bestQ = "";
    for (const r of rs) {
      if (!passes(c, r.filter)) continue;
      const rank = rankName(c.key, r.text);
      if (rank >= 0 && (best < 0 || rank < best)) {
        best = rank;
        bestQ = r.text;
      }
    }
    if (best >= 0) hits.push({ c, rank: best, q: bestQ });
  }
  hits.sort((a, b) => a.rank - b.rank || b.c.pop - a.c.pop);
  return hits.slice(0, limit).map(({ c, q }) => {
    const at = q ? c.key.indexOf(q) : -1;
    return {
      id: `c:${c.uf.toLowerCase()}/${c.slug}`,
      kind: "city",
      href: cityPath(c.uf, c.slug),
      label: c.name,
      sub: getRegion(getUf(c.uf)!.region).name,
      uf: c.uf,
      pop: c.pop,
      hl: at >= 0 && c.key.length === c.name.length ? [at, at + q.length] : undefined,
    };
  });
}

const regionOption = (r: (typeof REGIONS)[number]): Option => ({
  id: `r:${r.key.toLowerCase()}`,
  kind: "region",
  href: regionPath(r.key),
  label: `Região ${r.name}`,
  sub: `${r.ufs.length} estados`,
});
const ufOption = (u: (typeof UFS)[number]): Option => ({
  id: `u:${u.uf.toLowerCase()}`,
  kind: "uf",
  href: ufPath(u.uf),
  label: u.name,
  sub: `Região ${getRegion(u.region).name}`,
  uf: u.uf,
});
const BRASIL: Option = { id: "br", kind: "region", href: "/", label: "Brasil", sub: "País · 27 UFs" };
const collator = new Intl.Collator("pt-BR");
const ALL_UFS = [...UFS].sort((a, b) => collator.compare(a.name, b.name)).map(ufOption);

function searchTerritories(tokens: string[]): Option[] {
  const q = tokens.join(" ");
  const out: Option[] = [];
  const hit = (name: string) => ` ${keyOf(name)}`.includes(` ${q}`);
  if (hit("Brasil")) out.push(BRASIL);
  for (const r of REGIONS) if (hit(r.name) || hit(`Região ${r.name}`)) out.push(regionOption(r));
  for (const u of UFS) if (u.uf.toLowerCase() === q || hit(u.name)) out.push(ufOption(u));
  return out.slice(0, 6);
}

/* ---------- recent selections (this browser only) ---------- */

const RECENT_KEY = "radar-mde:recent-search";
const RECENT_MAX = 5;

function readRecent(): Option[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Option[];
    return Array.isArray(v) ? v.filter((o) => o && typeof o.id === "string" && typeof o.href === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(o: Option) {
  try {
    const rest = readRecent().filter((r) => r.id !== o.id);
    const { hl: _hl, ...clean } = o;
    void _hl;
    localStorage.setItem(RECENT_KEY, JSON.stringify([clean, ...rest].slice(0, RECENT_MAX)));
  } catch {}
}

/* ---------- platform hint + external open ---------- */

const noopSubscribe = () => () => {};
const isMacClient = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
const isMacServer = () => true;

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

const OPEN_EVENT = "radar:open-search";

/** Opens the header palette from anywhere (empty states, 404). */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Button that opens the search palette; for CTAs outside the header. */
export function SearchButton({ children = "Buscar município", className, variant = "outline" }: { children?: ReactNode; className?: string; variant?: "outline" | "default" | "secondary" }) {
  return (
    <Button type="button" variant={variant} className={className} onClick={openSearch}>
      <Search data-icon="inline-start" />
      {children}
    </Button>
  );
}

/* ---------- component ---------- */

function Highlighted({ text, range }: { text: string; range?: [number, number] }) {
  if (!range) return <>{text}</>;
  const [a, b] = range;
  return (
    <>
      {text.slice(0, a)}
      <mark className="bg-transparent font-semibold text-foreground">{text.slice(a, b)}</mark>
      {text.slice(b)}
    </>
  );
}

const ICON: Record<Kind, typeof MapPin> = { region: Globe2, uf: Landmark, city: MapPin };

function Row({ o, onSelect, recent }: { o: Option; onSelect: (o: Option) => void; recent?: boolean }) {
  const Icon = recent ? Clock : ICON[o.kind];
  return (
    <CommandItem
      value={recent ? `recent:${o.id}` : o.id}
      onSelect={() => onSelect(o)}
      className="h-10 cursor-pointer gap-3 px-2.5 [&>svg:last-child]:hidden"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">
          <Highlighted text={o.label} range={o.hl} />
        </span>
        <span className="ml-2 text-[13px] text-muted-foreground max-sm:hidden">{o.sub}</span>
      </span>
      {o.uf && o.kind === "city" && (
        <span className="rounded-sm border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{o.uf}</span>
      )}
      {o.pop != null ? (
        <span className="w-[5.5rem] shrink-0 text-right text-xs text-muted-foreground tnum">{int(o.pop)} hab.</span>
      ) : o.kind === "uf" && o.uf ? (
        <span className="rounded-sm border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{o.uf}</span>
      ) : null}
    </CommandItem>
  );
}

export default function SearchPalette() {
  const router = useRouter();
  const isMac = useSyncExternalStore(noopSubscribe, isMacClient, isMacServer);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<Option[]>([]);
  const [index, setIndex] = useState<IndexState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setIndex({ status: "loading" });
    loadIndex().then(
      (cities) => setIndex({ status: "ready", cities }),
      () => setIndex({ status: "error" }),
    );
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setValue("");
    setRecent(readRecent());
    if (index.status === "idle" || index.status === "error") load();
  }, [index.status, load]);

  // Global shortcuts: ⌘K / Ctrl+K toggles, "/" opens outside text fields; custom event from CTAs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "/" && !open && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target)) {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, openPalette);
    };
  }, [open, openPalette]);

  const tokens = useMemo(() => keyOf(query).split(/\s+/).filter(Boolean), [query]);
  const cities = index.status === "ready" ? index.cities : null;
  const hasQuery = tokens.length > 0;

  const groups = useMemo(() => {
    if (!hasQuery) {
      return {
        regions: [BRASIL, ...REGIONS.map(regionOption)],
        ufs: ALL_UFS,
        cities: [] as Option[],
      };
    }
    const t = searchTerritories(tokens);
    return {
      regions: t.filter((o) => o.kind === "region"),
      ufs: t.filter((o) => o.kind === "uf"),
      cities: cities ? searchCities(cities, tokens, 8) : [],
    };
  }, [tokens, hasQuery, cities]);

  const shownRecent = hasQuery ? [] : recent;
  const order = [
    ...shownRecent.map((o) => `recent:${o.id}`),
    ...(hasQuery ? [...groups.cities, ...groups.ufs, ...groups.regions] : [...groups.regions, ...groups.ufs]).map((o) => o.id),
  ];
  // Keep the highlight on a visible row; default to the first one
  const selected = order.includes(value) ? value : (order[0] ?? "");
  const total = order.length;

  const go = (o: Option) => {
    saveRecent(o);
    setOpen(false);
    router.push(o.href);
  };

  const loading = hasQuery && (index.status === "loading" || index.status === "idle");
  const noResults = hasQuery && !!cities && total === 0;

  const cityGroup = groups.cities.length > 0 && (
    <CommandGroup heading="Municípios">
      {groups.cities.map((o) => <Row key={o.id} o={o} onSelect={go} />)}
    </CommandGroup>
  );
  const ufGroup = groups.ufs.length > 0 && (
    <CommandGroup heading="Estados">
      {groups.ufs.map((o) => <Row key={o.id} o={o} onSelect={go} />)}
    </CommandGroup>
  );
  const regionGroup = groups.regions.length > 0 && (
    <CommandGroup heading="Brasil e regiões">
      {groups.regions.map((o) => <Row key={o.id} o={o} onSelect={go} />)}
    </CommandGroup>
  );

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Buscar município, estado ou região"
        aria-haspopup="dialog"
        className="inline-flex h-8 w-8 items-center justify-center gap-2 rounded-md border bg-background text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground sm:w-56 sm:justify-start sm:pr-1 sm:pl-2.5 md:w-8 md:justify-center md:px-0 lg:w-60 lg:justify-start lg:pr-1 lg:pl-2.5 dark:bg-muted/40"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-left sm:inline md:hidden lg:inline">Buscar município…</span>
        <Kbd className="hidden h-5 border bg-background font-mono text-[11px] sm:inline-flex md:hidden lg:inline-flex">{isMac ? "⌘K" : "Ctrl K"}</Kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          initialFocus={inputRef}
          className="top-[12vh] block max-w-[calc(100%-2rem)] translate-y-0 overflow-hidden rounded-xl! p-0 shadow-pop ring-0 sm:max-w-[560px]"
        >
          <DialogTitle className="sr-only">Buscar município, estado ou região</DialogTitle>
          <DialogDescription className="sr-only">Digite para filtrar; use as setas para navegar e Enter para abrir.</DialogDescription>
          <Command shouldFilter={false} loop value={selected} onValueChange={setValue} label="Buscar" className="rounded-none! p-0">
            <div className="flex h-12 items-center gap-2.5 border-b px-4">
              {loading ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="size-4 shrink-0 text-muted-foreground" />
              )}
              <CommandPrimitive.Input
                ref={inputRef}
                value={query}
                onValueChange={(v) => {
                  setQuery(v);
                  setValue("");
                }}
                placeholder="Buscar município, estado ou região…"
                autoComplete="off"
                spellCheck={false}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[15px]"
              />
              <Kbd className="h-5 border bg-background font-mono text-[11px]">Esc</Kbd>
            </div>

            <CommandList className="max-h-[min(60vh,440px)] scroll-py-2 p-1.5">
              {shownRecent.length > 0 && (
                <CommandGroup heading="Recentes">
                  {shownRecent.map((o) => <Row key={o.id} o={o} onSelect={go} recent />)}
                </CommandGroup>
              )}
              {hasQuery ? (
                <>
                  {cityGroup}
                  {ufGroup}
                  {regionGroup}
                </>
              ) : (
                <>
                  {regionGroup}
                  {ufGroup}
                </>
              )}
              {(noResults || index.status === "error" || (loading && total === 0)) && (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground" aria-live="polite">
                  {index.status === "error" ? (
                    <>
                      Não foi possível carregar os municípios.{" "}
                      <button type="button" onClick={load} className="font-medium text-brand-ink underline underline-offset-2">
                        Tentar novamente
                      </button>
                    </>
                  ) : loading ? (
                    "Carregando municípios…"
                  ) : (
                    <>
                      Nenhum resultado para <span className="font-medium text-foreground">“{query.trim()}”</span>.
                      <div className="mt-1 text-[13px]">Tente só o começo do nome ou acrescente a UF, como “santo andré sp”.</div>
                    </>
                  )}
                </div>
              )}
            </CommandList>

            <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
              <span className="inline-flex items-center gap-1.5">
                <Kbd className="border bg-background">↑</Kbd>
                <Kbd className="border bg-background">↓</Kbd>
                navegar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd className="border bg-background">↵</Kbd>
                abrir
              </span>
              <span className={cn("ml-auto", loading && "animate-pulse")}>
                {hasQuery ? (loading ? "Carregando municípios…" : `${total} resultado${total === 1 ? "" : "s"}`) : "Dica: “campinas sp”, “nordeste”"}
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
