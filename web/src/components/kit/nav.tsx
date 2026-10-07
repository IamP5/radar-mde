"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { NAV } from "./nav-items";

const SECTIONS = ["/explorar", "/acompanhar", "/dados", "/sobre"];

/**
 * Header nav: gray text, active item foreground with a hover pill, Vercel-style. On phones the labels are
 * shortened and, if the row still overflows, the cut edge fades out to show that it scrolls (CIT-12).
 */
export function NavLinks() {
  const path = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  // Every territory page (Brasil, região, UF, município) lives under "Painel"
  const active = (href: string) => (href === "/" ? !SECTIONS.some((s) => path.startsWith(s)) : path.startsWith(href));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Keep the current section in view by scrolling the container itself. Never scrollIntoView(): in Chromium it
    // moves the sequential-focus starting point, so the first Tab would skip the skip link (A11Y-17).
    const a = el.querySelector<HTMLElement>("[aria-current=page]");
    if (a && el.scrollWidth > el.clientWidth) el.scrollLeft = a.offsetLeft - el.offsetLeft - (el.clientWidth - a.offsetWidth) / 2;
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [path]);

  const fade =
    edges.left && edges.right
      ? "[mask-image:linear-gradient(to_right,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)]"
      : edges.right
        ? "[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]"
        : edges.left
          ? "[mask-image:linear-gradient(to_right,transparent,#000_2rem)]"
          : "";

  return (
    <nav
      ref={ref}
      aria-label="Principal"
      className={cn("-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto", fade)}
    >
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          // No viewport prefetch: on phones it pulled every section (and the charts bundle) on each page view
          // (PERF-05). Prefetch on intent instead.
          prefetch={false}
          onPointerEnter={() => router.prefetch(n.href)}
          onTouchStart={() => router.prefetch(n.href)}
          aria-current={active(n.href) ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center rounded-md px-2.5 text-sm transition-colors duration-150 hover:bg-accent hover:text-foreground md:min-h-8",
            active(n.href) ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {n.short !== n.label ? (
            <>
              <span className="max-[459px]:hidden">{n.label}</span>
              <span className="min-[460px]:hidden">{n.short}</span>
            </>
          ) : (
            n.label
          )}
        </Link>
      ))}
    </nav>
  );
}
