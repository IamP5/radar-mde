"use client";

/**
 * Header search trigger + global shortcuts (⌘K / Ctrl+K, "/"). The dialog (cmdk, Base UI Dialog, matching) is
 * code-split and only downloaded on intent (hover/focus/touch on the trigger) or on first open, so it stays out of
 * the initial bundle of every page. Keyboard shortcuts work immediately because the listeners live here.
 */
import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

const SearchPaletteDialog = dynamic(() => import("./SearchPaletteDialog"), { ssr: false });
const preload = () => {
  void import("./SearchPaletteDialog");
};

/* ---------- platform hint + external open ---------- */

const noopSubscribe = () => () => {};
const isMacClient = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
const isMacServer = () => true;

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

const OPEN_EVENT = "radar:open-search";

/** Opens the header palette from anywhere (empty states, 404, home CTA). */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Button that opens the search palette; for CTAs outside the header. */
export function SearchButton({ children = "Buscar município", className, variant = "outline" }: { children?: ReactNode; className?: string; variant?: "outline" | "default" | "secondary" }) {
  return (
    <Button type="button" variant={variant} className={className} onClick={openSearch} onPointerEnter={preload} onFocus={preload}>
      <Search data-icon="inline-start" />
      {children}
    </Button>
  );
}

export default function SearchPalette() {
  const isMac = useSyncExternalStore(noopSubscribe, isMacClient, isMacServer);
  const [open, setOpen] = useState(false);
  // bumped on every open: remounts the dialog so query, selection and "recentes" start fresh
  const [session, setSession] = useState(0);

  const openPalette = useCallback(() => {
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "/" && !open && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target)) {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, openPalette);
    };
  }, [open, openPalette]);

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        onPointerEnter={preload}
        onFocus={preload}
        onTouchStart={preload}
        aria-label="Buscar município, estado ou região"
        aria-haspopup="dialog"
        className="inline-flex size-9 items-center justify-center gap-2 rounded-md border bg-background text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground sm:h-8 sm:w-56 sm:justify-start sm:pr-1 sm:pl-2.5 md:w-8 md:justify-center md:px-0 lg:w-60 lg:justify-start lg:pr-1 lg:pl-2.5 dark:bg-muted/40"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-left sm:inline md:hidden lg:inline">Buscar município…</span>
        <Kbd className="hidden h-5 border bg-background font-mono text-[11px] sm:inline-flex md:hidden lg:inline-flex">{isMac ? "⌘K" : "Ctrl K"}</Kbd>
      </button>
      {session > 0 && <SearchPaletteDialog key={session} open={open} onOpenChange={setOpen} />}
    </>
  );
}
