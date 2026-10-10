"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { cn } from "@/lib/utils";

/**
 * Selected year mirrored to `?ano=` so links keep context when drilling down (Brasil → UF → município)
 * and shared URLs open on the same year. Read after mount to keep the static HTML cacheable.
 */
export function useYear(years: number[], initial: number) {
  const [year, setYearState] = useState(initial);
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get("ano"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is only readable after hydration
    if (years.includes(q) && q !== initial) setYearState(q);
  }, [years, initial]);
  const setYear = (y: number) => {
    setYearState(y);
    const u = new URL(window.location.href);
    if (y === initial) u.searchParams.delete("ano");
    else u.searchParams.set("ano", String(y));
    window.history.replaceState(window.history.state, "", u);
  };
  return [year, setYear] as const;
}

/** Appends ?ano= to an internal link when a non-default year is selected. */
export const withYear = (href: string, year: number, initial: number) => (year === initial ? href : `${href}?ano=${year}`);

/**
 * Year control: prev/next buttons around Arc's segmented track, which scrolls the selected year into view
 * and moves the selection with arrow keys, Home and End.
 */
export default function YearPicker({ years, year, onChange, className }: { years: number[]; year: number; onChange: (y: number) => void; className?: string }) {
  const i = years.indexOf(year);
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <span className="mr-1 hidden shrink-0 text-sm text-muted-foreground sm:inline" aria-hidden>
        Exercício
      </span>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange(years[i - 1])} disabled={i <= 0} aria-label="Ano anterior">
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <SegmentedControl
        label="Exercício"
        className="tnum"
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        value={String(year)}
        onValueChange={(v) => onChange(Number(v))}
      />
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange(years[i + 1])} disabled={i >= years.length - 1} aria-label="Próximo ano">
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
