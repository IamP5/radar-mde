"use client";

import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROW_CSV_COLUMNS, ROW_CSV_COLUMNS_FIN, csvFilename, csvHref, downloadCsv, rowCsvRecord, toCsv } from "@/lib/csv";
import { int } from "@/lib/format";
import { existedIn, loadFinance, type Finance, type Row } from "@/lib/rows";
import { useState } from "react";

/**
 * GOV-21: export exactly what the UF table shows (filtered municipalities, in the table order), for the
 * selected year or the whole series, as standard CSV or Excel-Brasil (";" + decimal comma), plus the full state file.
 */
export function UfTableExport({
  uf, rows, years, year, nameParts,
}: { uf: string; rows: Row[]; years: number[]; year: number; nameParts: (string | null | false | undefined)[] }) {
  const yi = years.indexOf(year);
  const first = years[0];
  const last = years[years.length - 1];

  const [busy, setBusy] = useState(false);
  // receita / aplicado / Fundeb columns come from a separate file fetched only on export (GOV-09/21)
  const run = async (scope: "year" | "series", excel: boolean) => {
    setBusy(true);
    let fin: Finance | undefined;
    try {
      fin = await loadFinance();
    } catch {
      fin = undefined; // export the columns we have rather than nothing
    }
    setBusy(false);
    const records =
      scope === "year"
        ? rows.filter((r) => existedIn(r, year)).map((r) => rowCsvRecord(r, yi, years, fin))
        : rows.flatMap((r) => years.flatMap((y, i) => (existedIn(r, y) ? [rowCsvRecord(r, i, years, fin)] : [])));
    const name = csvFilename([uf, scope === "year" ? year : `${first}-${last}`, ...nameParts], excel);
    downloadCsv(name, toCsv(fin ? ROW_CSV_COLUMNS_FIN : ROW_CSV_COLUMNS, records, { excel }));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!rows.length || busy}
        render={
          <Button variant="outline" size="sm" className="print:hidden">
            <Download data-icon="inline-start" />
            {busy ? "Preparando…" : "Exportar tabela"}
            <ChevronDown data-icon="inline-end" className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-76">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {rows.length === 1 ? "O município filtrado" : `Os ${int(rows.length)} municípios filtrados`}, na ordem da tabela
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run("year", false)}>
            <Download className="text-muted-foreground" />
            Só {year} · CSV padrão
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("series", false)}>
            <Download className="text-muted-foreground" />
            Série {first}–{last} · CSV padrão
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("year", true)}>
            <Download className="text-muted-foreground" />
            Só {year} · Excel Brasil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("series", true)}>
            <Download className="text-muted-foreground" />
            Série {first}–{last} · Excel Brasil
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Estado inteiro, todas as colunas (receita, aplicado, Fundeb…)</DropdownMenuLabel>
          <DropdownMenuItem render={<a href={csvHref(uf)} download />}>
            <Download className="text-muted-foreground" />
            CSV padrão
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={csvHref(uf, true)} download />}>
            <Download className="text-muted-foreground" />
            Excel Brasil
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Excel Brasil: separador “;” e vírgula decimal.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
