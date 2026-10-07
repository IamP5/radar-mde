"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { NAV } from "./nav-items";



const SECTIONS = ["/explorar", "/acompanhar", "/dados", "/sobre"];

/** Header nav: gray text, active item foreground with a hover pill, Vercel-style. */
export function NavLinks() {
  const path = usePathname();
  // Every territory page (Brasil, região, UF, município) lives under "Painel"
  const active = (href: string) => (href === "/" ? !SECTIONS.some((s) => path.startsWith(s)) : path.startsWith(href));
  return (
    <nav aria-label="Principal" className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 hover:bg-accent hover:text-foreground",
            active(n.href) ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
