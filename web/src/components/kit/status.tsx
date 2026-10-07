import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusKind = "ok" | "edge" | "below" | "nd" | "info";

const DOT: Record<StatusKind, string> = {
  ok: "bg-good",
  edge: "bg-warning",
  below: "bg-critical",
  nd: "bg-subtle",
  info: "bg-brand",
};
const TINT: Record<StatusKind, string> = {
  ok: "bg-good-soft text-good-ink",
  edge: "bg-warning-soft text-warning-ink",
  below: "bg-critical-soft text-critical",
  nd: "bg-muted text-muted-foreground",
  info: "bg-brand-soft text-brand-ink",
};

/** 8px status dot (Vercel deployments style). Always paired with a text label. */
export function StatusDot({ kind, className }: { kind: StatusKind; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", DOT[kind], className)} />;
}

/** Tinted pill: color-100 background, color-900 text, with the dot. */
export function StatusBadge({ kind, children, className, dot = true }: { kind: StatusKind; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap", TINT[kind], className)}>
      {dot && <StatusDot kind={kind} />}
      {children}
    </span>
  );
}
