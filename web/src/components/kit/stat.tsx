import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "bad" | "good" | "neutral";

/**
 * KPI card: muted label, large tabular value, optional delta pill, note and parent-territory context.
 * `spark` renders flush at the bottom edge (Vercel Analytics style).
 */
export function Stat({
  label, value, sub, tone = "neutral", delta, deltaTone = "neutral", context, spark, className, icon, wrap = false,
}: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone; delta?: ReactNode; deltaTone?: Tone;
  context?: ReactNode; spark?: ReactNode; className?: string; icon?: ReactNode;
  /** Let a long amount break onto the next line on a narrow card. */
  wrap?: boolean;
}) {
  return (
    <div className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center gap-1.5 text-[0.8125rem] leading-5 text-muted-foreground">
        {icon}
        <span className="min-w-0">{label}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "text-[1.375rem] leading-7 font-semibold tracking-[-0.04em] tnum sm:text-[1.75rem] sm:leading-8",
            wrap ? "whitespace-normal" : "whitespace-nowrap",
            tone === "bad" && "text-critical",
            tone === "good" && "text-good-ink",
          )}
        >
          {value}
        </span>
        {delta && <DeltaPill tone={deltaTone}>{delta}</DeltaPill>}
      </div>
      {sub && <div className="mt-1 text-xs leading-5 text-muted-foreground">{sub}</div>}
      {context && <div className="mt-auto pt-2 text-xs text-muted-foreground">{context}</div>}
      {spark && <div className={cn("-mx-4 -mb-4 h-10 shrink-0 pt-3 box-content forced-color-adjust-none", !context && "mt-auto")}>{spark}</div>}
    </div>
  );
}

export function DeltaPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center gap-0.5 rounded-full px-1.5 text-xs font-medium whitespace-nowrap tnum",
        tone === "bad" && "bg-critical-soft text-critical-ink",
        tone === "good" && "bg-good-soft text-good-ink",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
