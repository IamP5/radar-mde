import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one card material: hairline border, 12px radius, no shadow in dark. Header row (title, description,
 * actions) separated by a border when the body is a chart/table (`divided`).
 */
export function Panel({
  title, description, action, children, footer, className, bodyClassName, divided = false, id,
}: {
  title?: ReactNode; description?: ReactNode; action?: ReactNode; children?: ReactNode; footer?: ReactNode;
  className?: string; bodyClassName?: string; divided?: boolean; id?: string;
}) {
  const hasHeader = title || description || action;
  return (
    <section id={id} className={cn("min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card", className)}>
      {hasHeader && (
        <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 pt-4 sm:px-5", divided ? "border-b pb-4" : "pb-1")}>
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] leading-6 font-semibold tracking-[-0.01em]">{title}</h2>}
            {description && <div className="mt-0.5 text-[13px] leading-5 text-pretty text-muted-foreground">{description}</div>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(hasHeader && !divided ? "px-4 pt-3 pb-4 sm:px-5" : divided ? "" : "p-4 sm:p-5", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">{footer}</footer>}
    </section>
  );
}

/** Small section heading used between groups of panels. */
export function SectionTitle({ children, description, action }: { children: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{children}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Empty / loading / error box with the same geometry as the content it replaces. */
export function EmptyState({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[13px] text-muted-foreground">{children}</div>}
    </div>
  );
}
