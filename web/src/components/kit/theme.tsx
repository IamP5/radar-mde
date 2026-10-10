"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { ThemeSwitch, type Theme } from "@/components/arc/theme-switch/theme-switch";

/** `class` drives Tailwind's `dark:` variant, `data-theme` drives Arc's tokens. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute={["class", "data-theme"]} defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const OPTIONS = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return <SegmentedControl label="Tema" options={OPTIONS} value={mounted ? (theme ?? "system") : ""} onValueChange={setTheme} className={className} />;
}

/** Header toggle (light ↔ dark). The page crossfades through a view transition unless motion is reduced. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const theme: Theme = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const change = (next: Theme) => {
    const apply = () => {
      const root = document.documentElement;
      root.classList.toggle("dark", next === "dark");
      root.dataset.theme = next;
      setTheme(next);
    };
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    document.startViewTransition(apply);
  };
  return <ThemeSwitch theme={theme} iconOnly variant="rise" onThemeChange={change} label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} />;
}
