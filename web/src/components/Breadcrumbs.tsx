"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cityPath, getRegion, getUf, REGIONS, regionPath, UFS, ufPath, type RegionKey } from "@/lib/geo";
import { normKey } from "@/lib/format";
import { loadIndex, type IndexEntry } from "@/lib/indice";
import { cn } from "@/lib/utils";

type Props = { region?: RegionKey; uf?: string; city?: string };

/**
 * Vercel scope switcher: "Brasil / Sudeste ⇅ / São Paulo ⇅ / Santo André ⇅". Each crumb is a link; the
 * chevron next to it opens its siblings so users can move sideways without climbing back up. Municipalities
 * (up to 853 per state) get a searchable list loaded from the shared index on first open.
 */
export default function Breadcrumbs({ region, uf, city }: Props) {
  const reg = region ?? (uf ? getUf(uf)!.region : undefined);
  const [q, refresh] = useAnoQuery();
  const y = (href: string) => `${href}${q}`;
  // Distrito Federal: its "UF page" is Brasília's page, so the crumb would link to itself
  const dfCity = uf?.toUpperCase() === "DF" && !!city;
  return (
    <nav aria-label="Navegação territorial" className="min-w-0" onPointerEnter={refresh} onFocusCapture={refresh}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-1 text-sm text-muted-foreground">
        <li className="-ml-1.5 flex items-center">
          <Crumb href={y("/")} label="Brasil" current={!reg} />
        </li>
        {reg && (
          <Level>
            <Crumb href={y(regionPath(reg))} label={getRegion(reg).name} current={!uf} />
            <SiblingMenu
              label="Trocar de região"
              heading="Regiões"
              items={REGIONS.map((r) => ({ key: r.key, label: r.name, href: y(regionPath(r.key)), on: r.key === reg }))}
            />
          </Level>
        )}
        {uf && reg && (
          <Level>
            <Crumb href={dfCity ? undefined : y(ufPath(uf))} label={getUf(uf)!.name} current={!city} />
            <SiblingMenu
              label="Trocar de estado"
              heading={`Estados da região ${getRegion(reg).name}`}
              items={UFS.filter((u) => u.region === reg).map((u) => ({ key: u.uf, label: u.name, hint: u.uf, href: y(ufPath(u.uf)), on: u.uf === uf.toUpperCase() }))}
            />
          </Level>
        )}
        {uf && city && (
          <Level>
            <Crumb label={city} current />
            {!dfCity && <CityPicker uf={uf} current={city} query={q} />}
          </Level>
        )}
      </ol>
    </nav>
  );
}

function Level({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center">
      <span aria-hidden className="mx-1 text-[0.9375rem] text-muted-foreground/40 select-none">/</span>
      {children}
    </li>
  );
}

function Crumb({ href, label, current }: { href?: string; label: string; current: boolean }) {
  if (current)
    return (
      <span aria-current="page" className="truncate rounded-md px-1.5 py-0.5 font-medium text-foreground">
        {label}
      </span>
    );
  if (!href) return <span className="truncate rounded-md px-1.5 py-0.5">{label}</span>;
  return (
    <Link href={href} prefetch={false} className="inline-flex min-h-6 items-center truncate rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-accent hover:text-foreground">
      {label}
    </Link>
  );
}

/**
 * "?ano=2019" while a non-default year is selected (pages mirror it to the URL with replaceState, which fires no
 * event), re-read whenever the pointer or focus enters the breadcrumbs, i.e. before any crumb can be followed.
 */
function useAnoQuery() {
  const [q, setQ] = useState("");
  const refresh = useCallback(() => {
    const a = new URLSearchParams(window.location.search).get("ano");
    setQ(a && /^\d{4}$/.test(a) ? `?ano=${a}` : "");
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after hydration
  useEffect(refresh, [refresh]);
  return [q, refresh] as const;
}

function SwitchTrigger({ label }: { label: string }) {
  return (
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" aria-label={label} className="print:hidden">
        <ChevronsUpDown className="size-3.5" />
      </Button>
    </PopoverTrigger>
  );
}

type Item = { key: string; label: string; hint?: string; href: string; on: boolean };

function SiblingMenu({ label, heading, items }: { label: string; heading: string; items: Item[] }) {
  // the trail survives a client navigation between pages of the same route, so a chosen link closes the list itself
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SwitchTrigger label={label} />
      <PopoverContent aria-label={heading} className="w-64 space-y-1">
        <p className="px-2 pb-1 text-xs text-muted-foreground">{heading}</p>
        <ul>
          {items.map((it) => (
            <li key={it.key}>
              <Link
                href={it.href}
                prefetch={false}
                aria-current={it.on ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150 hover:bg-accent sm:min-h-9",
                  it.on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-muted-foreground tnum">{it.hint}</span>}
                <Check aria-hidden className={cn("size-3.5", it.on ? "opacity-100" : "opacity-0")} />
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Searchable list of the state's municipalities (Popover + Command). */
function CityPicker({ uf, current, query }: { uf: string; current: string; query: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<IndexEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || list) return;
    let live = true;
    loadIndex()
      .then((rows) => {
        if (!live) return;
        setList(rows.filter((r) => r.uf === uf.toUpperCase()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, list, uf]);
  const name = getUf(uf)?.name ?? uf;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SwitchTrigger label={`Trocar de município (${name})`} />
      <PopoverContent aria-label={`Municípios de ${name}`} className="w-72">
        {/* match on the name only (the value carries the IBGE code to stay unique), punctuation- and accent-insensitive */}
        <Command loop className="bg-transparent p-0" filter={(value, search) => (normKey(value.replace(/\s\d+$/, "")).includes(normKey(search)) ? 1 : 0)}>
          <CommandInput placeholder={`Buscar em ${name}…`} aria-label={`Buscar município em ${name}`} />
          <CommandList className="scroll-thin">
            {!list ? (
              <div className="py-6 text-center text-sm text-muted-foreground" role="status">
                {failed ? "Não foi possível carregar a lista." : "Carregando municípios…"}
              </div>
            ) : (
              <>
                <CommandEmpty className="text-sm text-muted-foreground">Nenhum município encontrado.</CommandEmpty>
                <CommandGroup heading={`${list.length.toLocaleString("pt-BR")} municípios`}>
                  {list.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.id}`}
                      data-checked={c.name === current}
                      onSelect={() => {
                        setOpen(false);
                        router.push(`${cityPath(c.uf, c.slug)}${query}`);
                      }}
                      className={c.name === current ? "font-medium" : undefined}
                    >
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
