"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; title?: string };

/**
 * Geist-style segmented control: gray track, the active item raised on the background color.
 * A radiogroup with roving focus and arrow keys.
 */
export function Segmented<T extends string>({
  value, onChange, options, ariaLabel, size = "sm", className,
}: { value: T; onChange: (v: T) => void; options: SegmentedOption<T>[]; ariaLabel: string; size?: "sm" | "md"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const i = options.findIndex((o) => o.value === value);
  const move = (d: number) => {
    const n = options[(i + d + options.length) % options.length];
    onChange(n.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus());
  };
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      }}
      className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none]", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "shrink-0 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors duration-150",
              size === "sm" ? "h-7 text-[13px]" : "h-8 text-sm",
              on ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
