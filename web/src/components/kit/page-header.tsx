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
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="min-w-0 lg:min-w-[min(100%,28rem)] lg:flex-1">
            <h1 className="font-heading text-2xl leading-8 font-medium tracking-(--tracking-display) text-balance md:text-3xl md:leading-10">{title}</h1>
            {description && <div className="mt-2 max-w-3xl text-base leading-6 text-pretty text-muted-foreground">{description}</div>}
            <PrintMeta />
          </div>
          {actions && <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 lg:max-w-[50%] lg:justify-end print:hidden">{actions}</div>}
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
