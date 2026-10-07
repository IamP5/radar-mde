"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cityPath, getRegion, getUf, REGIONS, regionPath, UFS, ufPath, type RegionKey } from "@/lib/geo";
import { norm } from "@/lib/format";
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
  return (
    <nav aria-label="Navegação territorial" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-1 text-sm text-muted-foreground">
        <li className="flex items-center">
          <Crumb href="/" label="Brasil" current={!reg} />
        </li>
        {reg && (
          <Level>
            <Crumb href={regionPath(reg)} label={getRegion(reg).name} current={!uf} />
            <SiblingMenu
              label="Trocar de região"
              heading="Regiões"
              items={REGIONS.map((r) => ({ key: r.key, label: r.name, href: regionPath(r.key), on: r.key === reg }))}
            />
          </Level>
        )}
        {uf && reg && (
          <Level>
            <Crumb href={ufPath(uf)} label={getUf(uf)!.name} current={!city} />
            <SiblingMenu
              label="Trocar de estado"
              heading={`Estados da região ${getRegion(reg).name}`}
              items={UFS.filter((u) => u.region === reg).map((u) => ({ key: u.uf, label: u.name, hint: u.uf, href: ufPath(u.uf), on: u.uf === uf }))}
            />
          </Level>
        )}
        {uf && city && (
          <Level>
            <Crumb label={city} current />
            {uf !== "DF" && <CityPicker uf={uf} current={city} />}
          </Level>
        )}
      </ol>
    </nav>
  );
}

function Level({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center">
      <span aria-hidden className="mx-1 text-[15px] text-muted-foreground/40 select-none">/</span>
      {children}
    </li>
  );
}

function Crumb({ href, label, current }: { href?: string; label: string; current: boolean }) {
  if (current || !href)
    return (
      <span aria-current="page" className="truncate rounded-md px-1.5 py-0.5 font-medium text-foreground">
        {label}
      </span>
    );
  return (
    <Link href={href} className="truncate rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-accent hover:text-foreground">
      {label}
    </Link>
  );
}

type Item = { key: string; label: string; hint?: string; href: string; on: boolean };

function SiblingMenu({ label, heading, items }: { label: string; heading: string; items: Item[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-xs" aria-label={label} title={label} className="text-muted-foreground hover:text-foreground">
            <ChevronsUpDown className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{heading}</DropdownMenuLabel>
          {items.map((it) => (
            <DropdownMenuItem
              key={it.key}
              render={<Link href={it.href} aria-current={it.on ? "page" : undefined} />}
              className={cn("py-1.5", it.on ? "font-medium text-foreground" : "text-muted-foreground")}
            >
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint && <span className="font-mono text-[11px] text-muted-foreground">{it.hint}</span>}
              <Check className={cn("size-3.5", it.on ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Searchable list of the state's municipalities (Popover + Command). */
function CityPicker({ uf, current }: { uf: string; current: string }) {
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
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-xs" aria-label={`Trocar de município (${name})`} title="Trocar de município" className="text-muted-foreground hover:text-foreground">
            <ChevronsUpDown className="size-3.5" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[min(18rem,calc(100vw-2rem))] gap-0 p-0">
        <Command loop filter={(value, search) => (norm(value).includes(norm(search.trim())) ? 1 : 0)}>
          <CommandInput placeholder={`Buscar em ${name}…`} aria-label={`Buscar município em ${name}`} />
          <CommandList className="scroll-thin">
            {!list ? (
              <div className="py-6 text-center text-[13px] text-muted-foreground" role="status">
                {failed ? "Não foi possível carregar a lista." : "Carregando municípios…"}
              </div>
            ) : (
              <>
                <CommandEmpty className="text-[13px] text-muted-foreground">Nenhum município encontrado.</CommandEmpty>
                <CommandGroup heading={`${list.length.toLocaleString("pt-BR")} municípios`}>
                  {list.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.id}`}
                      data-checked={c.name === current}
                      onSelect={() => {
                        setOpen(false);
                        router.push(cityPath(c.uf, c.slug));
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
