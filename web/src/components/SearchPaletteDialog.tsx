"use client";

/**
 * The ⌘K dialog itself (cmdk + Base UI Dialog). Loaded on first open by SearchPalette, so none of this is in
 * the initial bundle of every page.
 */
import { Command as CommandPrimitive } from "cmdk";
import { ChevronDown, Clock, Globe2, Landmark, ListFilter, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { int } from "@/lib/format";
import { loadIndex as loadCityIndex } from "@/lib/indice";
import { ALL_REGIONS, ALL_UFS, search, toSearchCity, type Kind, type Option, type SearchCity } from "@/lib/search";
import { cn } from "@/lib/utils";

/* ---------- index ---------- */

let indexPromise: Promise<SearchCity[]> | null = null;
let indexCache: SearchCity[] | null = null;
function loadIndex(): Promise<SearchCity[]> {
  indexPromise ??= loadCityIndex()
    .then((rows) => (indexCache = rows.map(toSearchCity)))
    .catch((e: unknown) => {
      indexPromise = null; // allow retry
      throw e;
    });
  return indexPromise;
}

/** Start downloading the municipality index before the dialog opens (on intent). */
export function warmIndex() {
  loadIndex().catch(() => {});
}

type IndexState = { status: "loading" | "error" } | { status: "ready"; cities: SearchCity[] };

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

/* ---------- rows ---------- */

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

const ICON: Record<Kind, typeof MapPin> = { region: Globe2, uf: Landmark, city: MapPin, link: ListFilter };

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
      {o.uf && (
        <span className="rounded-sm border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{o.uf}</span>
      )}
      {o.pop != null && (
        <span className="w-[5.5rem] shrink-0 text-right text-xs text-muted-foreground tnum max-[380px]:hidden">{int(o.pop)} hab.</span>
      )}
    </CommandItem>
  );
}

const LIMIT = 8;
const LIMIT_ALL = 400;
const MORE_ID = "more:all";

/** Consecutive runs of the same kind (territories vs municipalities), each rendered as its own group. */
function runs(items: Option[]) {
  const out: { territory: boolean; items: Option[] }[] = [];
  for (const o of items) {
    const territory = o.kind !== "city";
    const last = out[out.length - 1];
    if (last && last.territory === territory) last.items.push(o);
    else out.push({ territory, items: [o] });
  }
  return out;
}

export default function SearchPaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [recent] = useState<Option[]>(readRecent);
  // warm index (preloaded on intent): results are available on the very first render
  const [index, setIndex] = useState<IndexState>(() => (indexCache ? { status: "ready", cities: indexCache } : { status: "loading" }));
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setIndex({ status: "loading" });
    loadIndex().then(
      (cities) => setIndex({ status: "ready", cities }),
      () => setIndex({ status: "error" }),
    );
  }, []);

  useEffect(() => {
    let live = true;
    loadIndex().then(
      (cities) => live && setIndex({ status: "ready", cities }),
      () => live && setIndex({ status: "error" }),
    );
    return () => {
      live = false;
    };
  }, []);

  const cities = index.status === "ready" ? index.cities : null;
  const hasQuery = query.trim().length > 0;
  const result = useMemo(() => search(cities, query, expanded ? LIMIT_ALL : LIMIT), [cities, query, expanded]);
  const groups = useMemo(() => runs(result.items), [result.items]);
  const hidden = result.total - result.items.length;

  const shownRecent = hasQuery ? [] : recent;
  const order = hasQuery
    ? [...result.items.map((o) => o.id), ...(hidden > 0 && !expanded ? [MORE_ID] : [])]
    : [...shownRecent.map((o) => `recent:${o.id}`), ...ALL_REGIONS.map((o) => o.id), ...ALL_UFS.map((o) => o.id)];
  // Keep the highlight on a visible row; default to the first one
  const selected = order.includes(value) ? value : (order[0] ?? "");

  const go = (o: Option) => {
    saveRecent(o);
    onOpenChange(false);
    router.push(o.href);
  };

  const loading = hasQuery && index.status === "loading";
  const noResults = hasQuery && !!cities && result.total === 0;
  const status = !hasQuery
    ? ""
    : loading
      ? "Carregando municípios…"
      : index.status === "error"
        ? "Não foi possível carregar os municípios"
        : result.total === 0
          ? "Nenhum resultado"
          : `${int(result.total)} resultado${result.total === 1 ? "" : "s"}${hidden > 0 ? `, mostrando ${int(result.items.length)}` : ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        initialFocus={inputRef}
        className="top-[12vh] block max-w-[calc(100%-2rem)] translate-y-0 overflow-hidden rounded-xl! p-0 shadow-pop ring-0 max-sm:top-3 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">Buscar município, estado ou região</DialogTitle>
        <DialogDescription className="sr-only">Digite para filtrar; use as setas para navegar e Enter para abrir.</DialogDescription>
        <Command shouldFilter={false} loop value={selected} onValueChange={setValue} label="Buscar" className="rounded-none! p-0">
          <div className="flex h-12 items-center gap-2.5 border-b pr-2 pl-4">
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
                setExpanded(false);
              }}
              placeholder="Buscar município, estado ou região…"
              autoComplete="off"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[15px]"
            />
            <Kbd className="mr-2 h-5 border bg-background font-mono text-[11px] max-sm:hidden pointer-coarse:hidden">Esc</Kbd>
            {/* Touch screens have no Esc key: a real close button (CIT-13) */}
            <DialogClose className="hidden h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-sm:inline-flex pointer-coarse:inline-flex">
              Fechar
            </DialogClose>
          </div>

          <CommandList className="max-h-[min(60vh,440px)] scroll-py-2 p-1.5">
            {shownRecent.length > 0 && (
              <CommandGroup heading="Recentes">
                {shownRecent.map((o) => <Row key={o.id} o={o} onSelect={go} recent />)}
              </CommandGroup>
            )}
            {hasQuery ? (
              <>
                {groups.map((g, i) => (
                  <CommandGroup
                    key={`${i}-${g.territory}`}
                    heading={
                      result.fuzzy && !g.territory ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="size-3" /> Você quis dizer…
                        </span>
                      ) : g.territory ? (
                        "Brasil, regiões e estados"
                      ) : (
                        "Municípios"
                      )
                    }
                  >
                    {g.items.map((o) => <Row key={o.id} o={o} onSelect={go} />)}
                  </CommandGroup>
                ))}
                {hidden > 0 && !expanded && (
                  <CommandGroup>
                    <CommandItem
                      value={MORE_ID}
                      onSelect={() => {
                        setExpanded(true);
                        setValue(result.items[result.items.length - 1]?.id ?? "");
                      }}
                      className="h-10 cursor-pointer gap-3 px-2.5 text-muted-foreground [&>svg:last-child]:hidden"
                    >
                      <ChevronDown className="size-4" />
                      <span className="min-w-0 flex-1 truncate">
                        Ver todos os <span className="font-medium text-foreground tnum">{int(result.total)}</span> resultados
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}
                {hidden > 0 && (
                  <p className="px-3 pt-1 pb-2 text-[13px] text-muted-foreground">
                    {expanded ? `Mostrando ${int(result.items.length)} de ${int(result.total)}. ` : `+${int(hidden)} ${hidden === 1 ? "resultado" : "resultados"}. `}
                    Para achar mais rápido, digite também o estado, como “{query.trim()} pi”
                    {expanded && (
                      <>
                        , ou{" "}
                        <a
                          href={`/explorar?q=${encodeURIComponent(query.trim())}`}
                          onClick={(e) => {
                            e.preventDefault();
                            onOpenChange(false);
                            router.push(`/explorar?q=${encodeURIComponent(query.trim())}`);
                          }}
                          className="font-medium text-brand-ink underline underline-offset-2"
                        >
                          veja todos na tabela do Explorar
                        </a>
                      </>
                    )}
                    .
                  </p>
                )}
              </>
            ) : (
              <>
                <CommandGroup heading="Brasil e regiões">
                  {ALL_REGIONS.map((o) => <Row key={o.id} o={o} onSelect={go} />)}
                </CommandGroup>
                <CommandGroup heading="Estados">
                  {ALL_UFS.map((o) => <Row key={o.id} o={o} onSelect={go} />)}
                </CommandGroup>
              </>
            )}
            {(noResults || index.status === "error" || (loading && result.total === 0)) && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
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
                    <div className="mt-1 text-[13px]">Confira a grafia, tente só o começo do nome ou acrescente a UF, como “santo andré sp”.</div>
                  </>
                )}
              </div>
            )}
          </CommandList>

          {/* Result count for screen readers (the visual footer is hidden on phones) */}
          <span role="status" className="sr-only">
            {status}
          </span>
          <div aria-hidden className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
            <span className="inline-flex items-center gap-1.5">
              <Kbd className="border bg-background">↑</Kbd>
              <Kbd className="border bg-background">↓</Kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd className="border bg-background">↵</Kbd>
              abrir
            </span>
            <span className={cn("ml-auto", loading && "animate-pulse")}>{hasQuery ? status : "Dica: “campinas sp”, “nordeste”, “capitais”"}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
