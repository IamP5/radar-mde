"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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

const step =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/**
 * Compact Vercel-style year control: prev/next icon buttons around a scrollable segmented timeline
 * (gray track, selected year raised on the background). Arrow keys / Home / End move the selection.
 */
export default function YearPicker({ years, year, onChange, className }: { years: number[]; year: number; onChange: (y: number) => void; className?: string }) {
  const i = years.indexOf(year);
  const row = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    const track = row.current;
    const el = track?.querySelector<HTMLElement>("[aria-checked=true]");
    if (!track || !el) return;
    // keep the selected year centred in the track (never scrolls the page); re-run when the track resizes
    const center = () => {
      track.scrollLeft = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
    };
    center();
    const ro = new ResizeObserver(center);
    ro.observe(track);
    return () => ro.disconnect();
  }, [year]);

  const go = (n: number) => {
    if (n < 0 || n >= years.length) return;
    onChange(years[n]);
    requestAnimationFrame(() => row.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus());
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <span id={labelId} className="mr-1 hidden shrink-0 text-[13px] text-muted-foreground sm:inline">
        Exercício
      </span>
      <button type="button" className={step} onClick={() => onChange(years[i - 1])} disabled={i <= 0} aria-label="Ano anterior">
        <ChevronLeft className="size-4" />
      </button>
      <div
        ref={row}
        role="radiogroup"
        aria-labelledby={labelId}
        className="relative flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 fade-x [scrollbar-width:none]"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); go(i - 1); }
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); go(i + 1); }
          if (e.key === "Home") { e.preventDefault(); go(0); }
          if (e.key === "End") { e.preventDefault(); go(years.length - 1); }
        }}
      >
        {years.map((y) => {
          const on = y === year;
          return (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(y)}
              className={cn(
                "h-7 shrink-0 rounded-md px-2 text-[13px] font-medium tnum transition-colors duration-150",
                on
                  ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.06)] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {y}
            </button>
          );
        })}
      </div>
      <button type="button" className={step} onClick={() => onChange(years[i + 1])} disabled={i >= years.length - 1} aria-label="Próximo ano">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
