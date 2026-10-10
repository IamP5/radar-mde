"use client";

import { Eye, RotateCcw, Table2, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { ButtonLink } from "@/components/kit/button-link";
import { Panel } from "@/components/kit/panel";
import { StatusBadge, type StatusKind } from "@/components/kit/status";
import { SearchButton } from "@/components/SearchPalette";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { binColor } from "@/lib/bins";
import { MDE_MIN, int } from "@/lib/format";
import { cityPath } from "@/lib/geo";
import { DATA_VERSION, atipNote, existedIn, isAtip, isImplausible, loadAllRows, timesBelow, unpackRows, type Row, type RowsFile } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/lib/watchlist";

const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(1).replace(".", ","));

function status(r: Row, i: number, year: number): { kind: StatusKind; label: string } {
  const v = r.mde[i];
  if (v == null) return !existedIn(r, year) ? { kind: "nd", label: "Não existia" } : r.nd[i] ? { kind: "nd", label: "Não declarou" } : { kind: "nd", label: "Sem dados" };
  if (v < MDE_MIN) return { kind: "below", label: "Abaixo" };
  return v < MDE_MIN + 1 ? { kind: "edge", label: "No limite" } : { kind: "ok", label: "Cumpriu" };
}

/** Text on each MDE bin, per theme (the dark palette flips which steps are light). */
const BIN_TEXT: Record<string, string> = {
  "var(--bin-1)": "text-white dark:text-black",
  "var(--bin-2)": "text-ink dark:text-white",
  "var(--bin-3)": "text-ink",
  "var(--bin-4)": "text-ink dark:text-white",
  "var(--bin-5)": "text-white dark:text-black",
};

const head = "h-10 px-2 text-[13px] font-medium text-muted-foreground";

type Data = { years: number[]; rows: Row[] };

/** Only the saved municipalities (CIT-08); falls back to the national file if that request fails. */
async function loadWatched(ids: string[]): Promise<Data> {
  try {
    const qs = ids.map((id) => `m=${encodeURIComponent(id)}`).join("&");
    const res = await fetch(`/acompanhar/dados?${qs}&v=${DATA_VERSION}`);
    if (!res.ok) throw new Error(String(res.status));
    const f = (await res.json()) as RowsFile;
    return { years: f.years, rows: unpackRows(f.rows, f.years.length) };
  } catch {
    return loadAllRows();
  }
}

/** One coloured cell per year with the % (n/d when not declared, blank before the municipality existed). */
function YearCell({
  v, nd, na, atip, year, className,
}: { v: number | null; nd: boolean; na: boolean; /** atypical-value note (atipNote) */ atip?: string; year: number; className?: string }) {
  const c = binColor(v);
  const label = `${year}: ${na ? "município ainda não existia" : v == null ? (nd ? "não declarou" : "sem dados") : v.toFixed(2).replace(".", ",") + "%"}${atip ? ` — ${atip}` : ""}`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "relative inline-flex h-7 items-center justify-center rounded-[5px] text-[11px] tnum",
        // CIT-22: atypical value — dashed outline plus a corner mark, like the city page's ⚠
        atip && "outline-2 outline-offset-1 outline-dashed outline-warning after:absolute after:-top-1 after:-right-1 after:size-2 after:rounded-full after:bg-warning",
        v != null && v < MDE_MIN && "font-medium",
        nd && "border border-dashed border-critical text-critical-ink",
        v == null && !nd && "text-muted-foreground",
        na && "bg-muted/60",
        v != null && !nd && BIN_TEXT[c],
        className,
      )}
      style={nd || na ? undefined : { background: c }}
    >
      {na ? "" : nd ? "n/d" : fmt(v)}
    </span>
  );
}

/** Horizontal scroller whose cut edge fades out while there is more to scroll (VIS-13). */
function EdgeFadeScroller({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((e) => (e.right === right ? e : { right }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  // only the right edge fades: the name column is sticky on the left
  const mask = edges.right ? "[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]" : "";
  return (
    <div ref={ref} className={cn(className, mask)}>
      {children}
    </div>
  );
}

export default function Watchlist() {
  const [list, toggle, ready] = useWatchlist();
  // ids already requested that the server didn't know: don't ask again for them alone (FUN-24)
  const [unknown, setUnknown] = useState<ReadonlySet<string>>(() => new Set());
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Saved items whose rows aren't loaded yet: removing one needs no new request, adding one fetches just that one
  const missingKeys = useMemo(() => {
    const have = new Set(data?.rows.map((r) => `${r.uf.toLowerCase()}/${r.slug}`));
    return list.filter((k) => !have.has(k) && !unknown.has(k)).join(",");
  }, [list, data, unknown]);

  useEffect(() => {
    if (!missingKeys) return;
    let live = true;
    loadWatched(missingKeys.split(","))
      .then((d) => {
        if (!live) return;
        const got = new Set(d.rows.map((r) => `${r.uf.toLowerCase()}/${r.slug}`));
        const asked = missingKeys.split(",").filter((k) => !got.has(k));
        if (asked.length) setUnknown((u) => new Set([...u, ...asked]));
        setData((prev) => (prev ? { years: prev.years, rows: [...prev.rows, ...d.rows.filter((r) => !prev.rows.some((p) => p.id === r.id))] } : d));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [missingKeys, attempt]);

  // Until the browser's list is read, reserve the space of a loaded list instead of flashing the empty state
  if (!ready)
    return (
      <div className="overflow-hidden rounded-xl border bg-card px-5 py-4 shadow-card">
        <Skeleton lines={2} label="Carregando municípios salvos" className="max-w-sm" />
      </div>
    );

  if (!list.length)
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState
          title="Nenhum município salvo"
          description="Abra a página de um município e toque em Salvar. Ele aparece aqui com a série completa, ano a ano. Volte aqui quando sair um novo ano de dados."
          icon={<Eye aria-hidden className="size-5" />}
          action={
            <>
              <SearchButton variant="primary">Buscar município</SearchButton>
              <ButtonLink href="/explorar">
                <Table2 aria-hidden className="size-4" />
                Explorar a lista
              </ButtonLink>
            </>
          }
        />
      </div>
    );

  if (failed)
    return (
      <div role="status" className="rounded-xl border bg-card shadow-card">
        <EmptyState
          title="Não foi possível carregar os dados"
          description="Verifique a conexão e tente de novo."
          icon={<TriangleAlert aria-hidden className="size-5" />}
          action={
            <Button variant="secondary" size="sm" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>
              <RotateCcw aria-hidden className="size-4" />
              Tentar de novo
            </Button>
          }
        />
      </div>
    );

  if (!data)
    return (
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b px-5 py-4">
          <Skeleton lines={2} label="Carregando municípios salvos" className="max-w-sm" />
        </div>
        {Array.from({ length: Math.min(list.length, 6) }, (_, i) => (
          <div key={i} aria-hidden className="flex items-center gap-4 border-b px-5 py-3 last:border-0 motion-safe:animate-pulse">
            <span className="h-4 w-40 rounded-md bg-muted" />
            <span className="h-5 w-20 rounded-full bg-muted" />
            <span className="ml-auto h-6 w-1/2 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );

  const { years, rows } = data;
  const last = years.length - 1;
  const byKey = new Map(rows.map((r) => [`${r.uf.toLowerCase()}/${r.slug}`, r]));
  const items = list.map((k) => byKey.get(k)).filter((r): r is Row => !!r);
  const missing = list.length - items.length;

  return (
    <Panel
      divided
      title={`${int(items.length)} ${items.length === 1 ? "município" : "municípios"}`}
      description={<>Percentual aplicado em MDE por ano, {years[0]}–{years[last]}. Em vermelho, abaixo do mínimo de 25%.</>}
      action={<SearchButton>Adicionar</SearchButton>}
      footer={missing > 0 ? `${missing} ${missing === 1 ? "item salvo não foi encontrado" : "itens salvos não foram encontrados"} na base atual.` : undefined}
    >
      {/* Phones: one card per municipality, the whole series visible in two rows (CIT-14) */}
      <ul className="divide-y lg:hidden">
        {items.map((r) => {
          const key = `${r.uf.toLowerCase()}/${r.slug}`;
          const s = status(r, last, years[last]);
          const t = timesBelow(r);
          return (
            <li key={r.id} className="px-4 py-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={cityPath(r.uf, r.slug)} className="truncate font-medium hover:text-brand-ink hover:underline hover:underline-offset-2">
                      {r.name}
                    </Link>
                    <span className="rounded-sm border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{r.uf}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge kind={s.kind}>
                      {s.label} em {years[last]}
                    </StatusBadge>
                    <span className={cn(t && "font-medium text-critical-ink")}>
                      {t ? `${t} ${t === 1 ? "ano" : "anos"} abaixo de 25%` : "Nenhum ano abaixo de 25%"}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="md" onClick={() => toggle(key)} aria-label={`Remover ${r.name} dos salvos`} className="-mt-2 -mr-3">
                  <X aria-hidden className="size-4" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-9 gap-1 md:grid-cols-18">
                {years.map((y, i) => (
                  <div key={y} className="flex flex-col items-stretch gap-0.5">
                    <YearCell v={r.mde[i]} nd={r.nd[i]} na={!existedIn(r, y)} atip={isAtip(r, i, "mde") ? atipNote(["mde"], isImplausible(r, i)) : undefined} year={y} className="h-7 text-[10px]" />
                    <span className="text-center font-mono text-[10px] text-muted-foreground">’{String(y).slice(2)}</span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <EdgeFadeScroller className="scroll-thin relative overflow-x-auto max-lg:hidden">
        <table className="w-full text-sm tnum">
          <caption className="sr-only">Municípios salvos e percentual aplicado em MDE por ano</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={cn(head, "sticky left-0 z-10 bg-card pl-4 text-left sm:pl-5")}>Município</TableHead>
              <TableHead scope="col" className={cn(head, "text-left")}>Em {years[last]}</TableHead>
              <TableHead scope="col" className={cn(head, "text-right")} title={`Anos abaixo de 25% entre ${years[0]} e ${years[last]}`}>
                Anos &lt; 25%
              </TableHead>
              {years.map((y) => (
                <TableHead key={y} scope="col" className={cn(head, "w-10 px-0.5 text-center font-mono text-[11px] font-normal")}>
                  ’{String(y).slice(2)}
                </TableHead>
              ))}
              <TableHead scope="col" className={cn(head, "pr-4 sm:pr-5")}>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => {
              const key = `${r.uf.toLowerCase()}/${r.slug}`;
              const s = status(r, last, years[last]);
              const t = timesBelow(r);
              return (
                <TableRow key={r.id} className="group hover:bg-accent/60">
                  <TableCell className="sticky left-0 z-10 bg-card py-2.5 pl-4 group-hover:bg-[color-mix(in_oklab,var(--card),var(--accent)_60%)] sm:pl-5">
                    <div className="flex items-center gap-2">
                      <Link href={cityPath(r.uf, r.slug)} className="max-w-44 truncate font-medium hover:text-brand-ink hover:underline hover:underline-offset-2 sm:max-w-none">
                        {r.name}
                      </Link>
                      <span className="rounded-sm border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{r.uf}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-2">
                    <StatusBadge kind={s.kind}>{s.label}</StatusBadge>
                  </TableCell>
                  <TableCell className={cn("px-2 text-right", t ? "font-medium text-critical-ink" : "text-muted-foreground")}>{t}</TableCell>
                  {years.map((y, i) => (
                    <TableCell key={y} className="px-0.5 py-1.5 text-center">
                      <YearCell v={r.mde[i]} nd={r.nd[i]} na={!existedIn(r, y)} atip={isAtip(r, i, "mde") ? atipNote(["mde"], isImplausible(r, i)) : undefined} year={y} className="w-10" />
                    </TableCell>
                  ))}
                  <TableCell className="pr-3 pl-2 text-right sm:pr-4">
                    <Button variant="ghost" size="sm" onClick={() => toggle(key)} aria-label={`Remover ${r.name} dos salvos`} title="Remover dos salvos">
                      <X aria-hidden className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </EdgeFadeScroller>
    </Panel>
  );
}
