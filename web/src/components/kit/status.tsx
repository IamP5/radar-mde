import type { CSSProperties, ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { cn } from "@/lib/utils";

export type StatusKind = "ok" | "edge" | "below" | "nd" | "info";

const DOT: Record<StatusKind, string> = {
  ok: "bg-good",
  edge: "bg-warning",
  below: "bg-critical",
  nd: "bg-subtle",
  info: "bg-brand",
};
const TONE: Record<StatusKind, BadgeTone> = { ok: "success", edge: "warning", below: "danger", nd: "neutral", info: "info" };
/** The app's --warning is a fill; Arc's warning badge needs the ink to stay legible. */
const WARNING_INK = { "--warning": "var(--warning-ink)" } as CSSProperties;

/** 8px status dot (Vercel deployments style). Always paired with a text label. */
export function StatusDot({ kind, className }: { kind: StatusKind; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full forced-color-adjust-none", DOT[kind], className)} />;
}

/** Arc badge in the status tone, led by the dot. */
export function StatusBadge({ kind, children, className, dot = true }: { kind: StatusKind; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <Badge tone={TONE[kind]} size="sm" icon={dot ? <StatusDot kind={kind} /> : undefined} className={className} style={kind === "edge" ? WARNING_INK : undefined}>
      {children}
    </Badge>
  );
}
