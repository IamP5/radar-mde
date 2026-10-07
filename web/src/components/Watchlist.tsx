"use client";

import { Eye, RotateCcw, Table2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, Panel } from "@/components/kit/panel";
import { StatusBadge, type StatusKind } from "@/components/kit/status";
import { SearchButton } from "@/components/SearchPalette";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { binColor } from "@/lib/bins";
import { MDE_MIN, int } from "@/lib/format";
import { cityPath } from "@/lib/geo";
import { loadAllRows, timesBelow, type Row } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/lib/watchlist";

const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(1).replace(".", ","));

function status(r: Row, i: number): { kind: StatusKind; label: string } {
  const v = r.mde[i];
  if (v == null) return r.nd[i] ? { kind: "nd", label: "Não declarou" } : { kind: "nd", label: "Sem dados" };
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

export default function Watchlist() {
  const [list, toggle] = useWatchlist();
  const [data, setData] = useState<{ years: number[]; rows: Row[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadAllRows()
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [attempt]);

  if (!list.length)
    return (
      <EmptyState title="Nenhum município acompanhado" className="bg-card py-16">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full border bg-background text-muted-foreground">
          <Eye className="size-4" />
        </div>
        <p>
          Abra a página de um município e clique em <span className="font-medium text-foreground">Acompanhar</span>. Ele aparece aqui com a
          série completa, ano a ano, para você conferir quando sair um novo relatório.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <SearchButton variant="default">Buscar município</SearchButton>
          <Button variant="outline" nativeButton={false} render={<Link href="/explorar" />}>
            <Table2 data-icon="inline-start" />
            Explorar a lista
          </Button>
        </div>
      </EmptyState>
    );

  if (failed)
    return (
      <EmptyState title="Não foi possível carregar os dados" className="bg-card py-16">
        <p>Verifique a conexão e tente de novo.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>
          <RotateCcw data-icon="inline-start" />
          Tentar de novo
        </Button>
      </EmptyState>
    );

  if (!data)
    return (
      <div className="overflow-hidden rounded-xl border bg-card" role="status" aria-label="Carregando">
        <div className="border-b px-5 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>
        {Array.from({ length: Math.min(list.length, 6) }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-5 py-3 last:border-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ml-auto h-6 w-1/2" />
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
      action={<SearchButton className="h-7 px-2.5 text-[13px]">Adicionar</SearchButton>}
      footer={missing > 0 ? `${missing} ${missing === 1 ? "item salvo não foi encontrado" : "itens salvos não foram encontrados"} na base atual.` : undefined}
    >
      <div className="scroll-thin relative overflow-x-auto">
        <table className="w-full text-sm tnum">
          <caption className="sr-only">Municípios acompanhados e percentual aplicado em MDE por ano</caption>
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
              const s = status(r, last);
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
                  <TableCell className={cn("px-2 text-right", t ? "font-medium text-critical" : "text-muted-foreground")}>{t}</TableCell>
                  {r.mde.map((v, i) => {
                    const nd = r.nd[i];
                    const c = binColor(v);
                    return (
                      <TableCell key={i} className="px-0.5 py-1.5 text-center">
                        <span
                          title={`${years[i]}: ${v == null ? (nd ? "não declarou" : "sem dados") : v.toFixed(2).replace(".", ",") + "%"}`}
                          className={cn(
                            "inline-flex h-7 w-10 items-center justify-center rounded-[5px] text-[11px]",
                            v != null && v < MDE_MIN && "font-semibold",
                            nd && "border border-dashed border-critical text-critical",
                            v == null && !nd && "text-muted-foreground",
                            v != null && !nd && BIN_TEXT[c],
                          )}
                          style={nd ? undefined : { background: c }}
                        >
                          {nd ? "n/d" : fmt(v)}
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell className="pr-3 pl-2 text-right sm:pr-4">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggle(key)}
                      aria-label={`Deixar de acompanhar ${r.name}`}
                      title="Deixar de acompanhar"
                      className="text-muted-foreground hover:text-critical"
                    >
                      <X />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </Panel>
  );
}
