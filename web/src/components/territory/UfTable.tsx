"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusDot, type StatusKind } from "@/components/kit/status";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withYear } from "@/components/YearPicker";
import { cn } from "@/lib/utils";
import { funMin, int, MDE_MIN, pct } from "@/lib/format";
import { getRegion, ufPath } from "@/lib/geo";
import { belowShare, shortfallLabel, type UfSummary } from "@/lib/rows";

type Key = "name" | "n" | "share" | "below" | "short" | "median" | "fun" | "aluno" | "gov" | "nd";

/**
 * Sortable ranking of UFs for one year. Rows link to the state dashboard (keeping `?ano`).
 * The state name is a sticky first column and "% abaixo de 25%" comes right after it, so the key metric is
 * visible at 375px; secondary columns hide below `sm`, and a right-edge fade signals horizontal scroll.
 */
export default function UfTable({
  id, ufs, years, year, initialYear, showRegion, caption,
}: { id?: string; ufs: UfSummary[]; years: number[]; year: number; initialYear: number; showRegion: boolean; caption: string }) {
  const yi = years.indexOf(year);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "share", dir: -1 });
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  const rows = useMemo(() => {
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
    return [...ufs].sort((a, b) => {
      const va = val(a, sort.key), vb = val(b, sort.key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : va - (vb as number)) * sort.dir;
    });
  }, [ufs, sort, yi]);
  const maxShare = Math.max(1, ...ufs.map((u) => belowShare(u.stats[yi]) ?? 0));

  const th = (key: Key, label: string, opts: { title?: string; left?: boolean; className?: string } = {}) => {
    const on = sort.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TableHead
        scope="col"
        className={cn("h-10 px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground last:pr-4 sm:last:pr-5", opts.left ? "text-left" : "text-right", opts.className)}
        aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          title={opts.title}
          className={cn(
            "group/sort -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors duration-150 hover:bg-accent hover:text-foreground",
            !opts.left && "flex-row-reverse",
            on && "text-foreground",
          )}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}
        >
          <span>{label}</span>
          <Icon aria-hidden className={cn("size-3.5", on ? "text-foreground" : "text-muted-foreground/60 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100")} />
        </button>
      </TableHead>
    );
  };

  const td = "px-3 py-2.5 text-right tnum whitespace-nowrap last:pr-4 sm:last:pr-5";
  const fmt1 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const sticky = "sticky left-0 z-[1] bg-card shadow-[inset_-1px_0_0_var(--border)] sm:shadow-none";

  return (
    <div className="relative">
      <div
        id={id}
        ref={scroller}
        tabIndex={more ? 0 : undefined}
        role={more ? "region" : undefined}
        aria-label={more ? `${caption} (role para o lado para ver todas as colunas)` : undefined}
        className="scroll-thin w-full scroll-mt-32 overflow-x-auto"
      >
        <table className="w-full caption-bottom text-[13px] sm:text-sm">
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {th("name", "Estado", { left: true, className: cn(sticky, "pl-4 sm:pl-5") })}
              {th("share", "% abaixo de 25%", { title: "Parcela dos municípios que declararam e aplicaram menos de 25% em MDE" })}
              {th("short", "Faltou (R$)", { title: "Estimativa do que faltou para 25% nos municípios abaixo do mínimo (valores nominais)" })}
              {th("median", "MDE mediana")}
              {th("gov", "Gov. estadual", { title: "Governo estadual: % aplicado em MDE pelo próprio governo do estado na sua rede (mínimo 25%)" })}
              {th("fun", "Fundeb < mín.", { title: `Fundeb abaixo do mínimo: % dos municípios que pagaram aos profissionais menos de ${funMin(year)}% do Fundeb`, className: "hidden sm:table-cell" })}
              {th("aluno", "R$/aluno", { title: "Mediana do investimento por aluno dos municípios (R$/ano, nominal)", className: "hidden sm:table-cell" })}
              {th("n", "Municípios", { className: "hidden xl:table-cell" })}
              {th("nd", "Sem dados", { title: "Municípios que não declararam ou sem dado no ano" })}
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
                <TableRow key={u.uf} className="group hover:bg-accent/60">
                  <TableCell className={cn(sticky, "py-2.5 pr-3 pl-4 transition-colors group-hover:bg-[color-mix(in_oklab,var(--surface-muted)_60%,var(--card))] sm:pl-5")}>
                    <span className="flex items-center gap-2">
                      <StatusDot kind={kind} />
                      <Link href={withYear(ufPath(u.uf), year, initialYear)} className="font-medium whitespace-nowrap hover:underline hover:underline-offset-2">
                        {u.name}
                      </Link>
                      <span className="rounded border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{u.uf}</span>
                      {showRegion && <span className="hidden text-xs whitespace-nowrap text-muted-foreground 2xl:inline">{getRegion(u.region).name}</span>}
                    </span>
                  </TableCell>
                  <TableCell className={td}>
                    <span className="inline-flex items-center justify-end gap-2.5">
                      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted forced-color-adjust-none md:inline-block" aria-hidden>
                        <span className="block h-full rounded-full bg-critical" style={{ width: `${((sh ?? 0) / maxShare) * 100}%` }} />
                      </span>
                      <span className={cn("w-11", sh ? "font-medium text-critical-ink" : "text-muted-foreground")}>{sh == null ? "—" : fmt1(sh)}</span>
                      <span className="w-12 text-left text-xs text-muted-foreground" title={`${s.below} de ${s.reported} municípios que declararam`}>
                        {s.below}/{s.reported}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className={cn(td, s.shortfall > 0 ? "text-critical-ink" : "text-muted-foreground")} title={shortfallLabel(s).note ?? undefined}>
                    {s.below ? shortfallLabel(s).value : "—"}
                  </TableCell>
                  <TableCell className={td}>{pct(s.median)}</TableCell>
                  <TableCell className={cn(td, gov != null && gov < MDE_MIN && "font-medium text-critical-ink", gov == null && "text-muted-foreground")} title={gov == null ? "Sem dado do governo estadual neste ano" : undefined}>
                    {pct(gov)}
                  </TableCell>
                  <TableCell className={cn(td, "hidden sm:table-cell", !fb && "text-muted-foreground")}>{fb == null ? "—" : fmt1(fb)}</TableCell>
                  <TableCell className={cn(td, "hidden sm:table-cell", !s.alunoMedian && "text-muted-foreground")}>
                    {s.alunoMedian ? `R$ ${int(Math.round(s.alunoMedian))}` : "—"}
                  </TableCell>
                  <TableCell className={cn(td, "hidden text-muted-foreground xl:table-cell")}>{int(s.n)}</TableCell>
                  <TableCell className={cn(td, !(s.nd + s.missing) && "text-muted-foreground")}>{s.nd + s.missing}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
      {/* right-edge fade while more columns are hidden off-screen */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent transition-opacity duration-150", more ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
