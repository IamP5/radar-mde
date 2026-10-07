"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusDot, type StatusKind } from "@/components/kit/status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { funMin, MDE_MIN, pct } from "@/lib/format";
import { getRegion, ufPath } from "@/lib/geo";
import { belowShare, shortfallLabel, type UfSummary } from "@/lib/rows";

type Key = "name" | "n" | "share" | "below" | "short" | "median" | "fun" | "aluno" | "gov" | "nd";

/** Sortable ranking of UFs for one year. Rows link to the state dashboard. */
export default function UfTable({ ufs, years, year, showRegion }: { ufs: UfSummary[]; years: number[]; year: number; showRegion: boolean }) {
  const yi = years.indexOf(year);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "share", dir: -1 });
  const val = (u: UfSummary, k: Key): number | string | null => {
    const s = u.stats[yi];
    switch (k) {
      case "name": return u.name;
      case "n": return s.n;
      case "share": return belowShare(s);
      case "below": return s.below;
      case "short": return s.shortfall;
      case "median": return s.median;
      case "fun": return s.funReported ? (s.funBelow / s.funReported) * 100 : null;
      case "aluno": return s.alunoMedian;
      case "gov": return u.gov[yi];
      case "nd": return s.nd + s.missing;
    }
  };
  const rows = useMemo(
    () =>
      [...ufs].sort((a, b) => {
        const va = val(a, sort.key), vb = val(b, sort.key);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : va - (vb as number)) * sort.dir;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ufs, sort, yi],
  );
  const maxShare = Math.max(1, ...ufs.map((u) => belowShare(u.stats[yi]) ?? 0));

  const th = (key: Key, label: string, title?: string, left = false) => {
    const on = sort.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead
        scope="col"
        className={cn("h-10 px-3 text-[13px] font-medium text-muted-foreground first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5", left ? "text-left" : "text-right")}
        aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          title={title}
          className={cn(
            "group/sort -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors duration-150 hover:bg-accent hover:text-foreground",
            !left && "flex-row-reverse",
            on && "text-foreground",
          )}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}
        >
          {label}
          <Icon aria-hidden className={cn("size-3.5", on ? "text-foreground" : "text-muted-foreground/60 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100")} />
        </button>
      </TableHead>
    );
  };

  const td = "px-3 py-2.5 text-right tnum first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
  const fmt1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  return (
    <Table className="text-[13px] sm:text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {th("name", "Estado", undefined, true)}
          {th("n", "Municípios")}
          {th("share", "% abaixo de 25%", "Parcela dos municípios que declararam e aplicaram menos de 25% em MDE")}
          {th("short", "Faltou (R$)", "Soma do que faltou para 25% nos municípios abaixo do mínimo")}
          {th("median", "MDE mediana")}
          {th("fun", "Fundeb abaixo do mín.", `% dos municípios que pagaram aos profissionais menos de ${funMin(year)}% do Fundeb`)}
          {th("aluno", "R$/aluno (mediana)")}
          {th("gov", "Governo estadual", "% aplicado em MDE pelo próprio governo do estado (mínimo 25%)")}
          {th("nd", "Sem dados")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((u) => {
          const s = u.stats[yi];
          const sh = belowShare(s);
          const fb = s.funReported ? (s.funBelow / s.funReported) * 100 : null;
          const kind: StatusKind = sh == null ? "nd" : s.below ? "below" : "ok";
          const gov = u.gov[yi];
          return (
            <TableRow key={u.uf} className="hover:bg-accent/60">
              <TableCell className="py-2.5 pr-3 pl-4 sm:pl-5">
                <span className="flex items-center gap-2">
                  <StatusDot kind={kind} />
                  <Link href={ufPath(u.uf)} className="font-medium hover:underline hover:underline-offset-2">
                    {u.name}
                  </Link>
                  <span className="rounded border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{u.uf}</span>
                  {showRegion && <span className="hidden text-xs text-muted-foreground lg:inline">{getRegion(u.region).name}</span>}
                </span>
              </TableCell>
              <TableCell className={cn(td, "text-muted-foreground")}>{s.n.toLocaleString("pt-BR")}</TableCell>
              <TableCell className={td}>
                <span className="inline-flex items-center justify-end gap-2.5">
                  <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block" aria-hidden>
                    <span className="block h-full rounded-full bg-critical" style={{ width: `${((sh ?? 0) / maxShare) * 100}%` }} />
                  </span>
                  <span className={cn("w-12", sh ? "font-medium text-critical" : "text-muted-foreground")}>{sh == null ? "—" : fmt1(sh)}</span>
                  <span className="w-14 text-left text-xs text-muted-foreground">
                    {s.below}/{s.reported}
                  </span>
                </span>
              </TableCell>
              <TableCell className={cn(td, s.shortfall > 0 ? "text-critical" : "text-muted-foreground")} title={shortfallLabel(s).note ?? undefined}>
                {s.below ? shortfallLabel(s).value : "—"}
              </TableCell>
              <TableCell className={td}>{pct(s.median)}</TableCell>
              <TableCell className={cn(td, !fb && "text-muted-foreground")}>{fb == null ? "—" : fmt1(fb)}</TableCell>
              <TableCell className={cn(td, !s.alunoMedian && "text-muted-foreground")}>{s.alunoMedian ? `R$ ${s.alunoMedian.toLocaleString("pt-BR")}` : "—"}</TableCell>
              <TableCell className={cn(td, gov != null && gov < MDE_MIN && "font-medium text-critical")}>{pct(gov)}</TableCell>
              <TableCell className={cn(td, !(s.nd + s.missing) && "text-muted-foreground")}>{s.nd + s.missing}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
