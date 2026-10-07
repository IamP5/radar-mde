import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PrintMeta } from "./print-meta";

/** White band at the top of every page (Vercel dashboard style): title + one-line description left, actions right. */
export function PageHeader({
  title, description, actions, eyebrow, children, className,
}: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b bg-background print:border-0", className)}>
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-6 sm:px-6 md:pt-8">
        {eyebrow && <div className="mb-3 text-sm text-muted-foreground">{eyebrow}</div>}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.04em] text-balance md:text-[2rem] md:leading-10">{title}</h1>
            {description && <div className="mt-2 max-w-3xl text-[0.9375rem] leading-6 text-pretty text-muted-foreground">{description}</div>}
            <PrintMeta />
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Page body container on the gray canvas. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8", className)}>{children}</div>;
}
