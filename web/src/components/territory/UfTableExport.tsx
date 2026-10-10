"use client";

import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { ROW_CSV_COLUMNS, ROW_CSV_COLUMNS_FIN, csvFilename, csvHref, downloadCsv, rowCsvRecord, toCsv } from "@/lib/csv";
import { existedIn, loadFinance, type Finance, type Row } from "@/lib/rows";
import { useState } from "react";

/** Arc menu items only run a callback, so the full-state file (a route, not a blob) goes through a temporary `<a download>`. */
function downloadHref(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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
    if (busy) return;
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

  if (!rows.length) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Download size={16} aria-hidden />
        Exportar tabela
        <ChevronDown size={15} aria-hidden />
      </Button>
    );
  }
  const icon = <Download size={16} />;
  return (
    <DropdownMenu
      label={busy ? "Preparando…" : "Exportar tabela"}
      icon={icon}
      items={[
        { label: `Só ${year} · CSV padrão`, icon, onSelect: () => run("year", false) },
        { label: `Série ${first}–${last} · CSV padrão`, icon, onSelect: () => run("series", false) },
        { label: `Só ${year} · Excel Brasil`, icon, onSelect: () => run("year", true) },
        { label: `Série ${first}–${last} · Excel Brasil`, icon, onSelect: () => run("series", true) },
        { label: "Estado inteiro · CSV padrão", icon, onSelect: () => downloadHref(csvHref(uf)), separatorBefore: true },
        { label: "Estado inteiro · Excel Brasil", icon, onSelect: () => downloadHref(csvHref(uf, true)) },
      ]}
    />
  );
}
