"use client";

/**
 * Header search trigger + global shortcuts (⌘K / Ctrl+K, "/"). The dialog (cmdk, Arc Dialog, matching) is
 * code-split and only downloaded on intent (hover/focus/touch on the trigger) or on first open, so it stays out of
 * the initial bundle of every page. Keyboard shortcuts work immediately because the listeners live here.
 */
import { Search } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/arc/button/button";
import arc from "@/components/arc/button/button.module.css";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type DialogProps = { open: boolean; onOpenChange: (v: boolean) => void };
type DialogModule = typeof import("./SearchPaletteDialog");

/**
 * Loaded by hand instead of next/dynamic: a lazy/Suspense boundary is revealed with React's ~300 ms throttle, which
 * made the first ⌘K feel slow (PAL-01). Here the dialog renders only once the module is in memory.
 */
let modulePromise: Promise<DialogModule> | null = null;
const loadDialog = () =>
  (modulePromise ??= import("./SearchPaletteDialog").catch((e: unknown) => {
    modulePromise = null;
    throw e;
  }));
/** Intent (hover, focus, touch, ⌘/Ctrl down): fetch the dialog code and warm the municipality index. */
const preload = () => {
  loadDialog().then((m) => m.warmIndex(), () => {});
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
export function SearchButton({
  children = "Buscar município", className, variant = "secondary", size = "sm",
}: { children?: ReactNode; className?: string; variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Button type="button" variant={variant} size={size} className={className} aria-haspopup="dialog" onClick={openSearch} onPointerEnter={preload} onFocus={preload}>
      <Search aria-hidden className="size-4" />
      {children}
    </Button>
  );
}

/** A button drawn as a search field (Arc's secondary button, text to the left): the home page's first action. */
export function SearchFieldButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={openSearch}
      onPointerEnter={preload}
      onFocus={preload}
      onTouchStart={preload}
      className={cn(arc.button, arc.secondary, arc.md, "w-full", className)}
    >
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-left font-normal text-muted-foreground">{children}</span>
      <Kbd aria-hidden className="border bg-background font-mono text-[11px] pointer-coarse:hidden">/</Kbd>
    </button>
  );
}

export default function SearchPalette({ compact = false }: { compact?: boolean } = {}) {
  const isMac = useSyncExternalStore(noopSubscribe, isMacClient, isMacServer);
  const [open, setOpen] = useState(false);
  // bumped on every open: remounts the dialog so query, selection and "recentes" start fresh
  const [session, setSession] = useState(0);
  const [Dialog, setDialog] = useState<ComponentType<DialogProps> | null>(null);

  const ensureDialog = useCallback(() => {
    loadDialog().then(
      (m) => setDialog(() => m.default),
      () => {},
    );
  }, []);

  // The dialog chunk is small and almost always used: fetch it when the browser is idle (code only, no data)
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(ensureDialog, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(ensureDialog, 2500);
    return () => clearTimeout(t);
  }, [ensureDialog]);

  const openPalette = useCallback(() => {
    ensureDialog();
    preload();
    setSession((s) => s + 1);
    setOpen(true);
  }, [ensureDialog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") preload();
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
        // Phones get a 44px hit area around the 36px control.
        className={compact ? "m-ctl size-10!" : cn(arc.button, arc.secondary, arc.sm, "max-sm:after:absolute max-sm:after:-inset-1")}
      >
        <Search aria-hidden className={cn("size-4 shrink-0", !compact && "text-muted-foreground")} />
        {!compact && (
          <span className="hidden items-center gap-3 sm:flex md:hidden lg:flex">
            <span className="w-36 truncate text-left font-normal text-muted-foreground">Buscar município…</span>
            <Kbd className="border bg-background font-mono text-[11px]">{isMac ? "⌘K" : "Ctrl K"}</Kbd>
          </span>
        )}
      </button>
      {session > 0 && Dialog && <Dialog key={session} open={open} onOpenChange={setOpen} />}
    </>
  );
}
