"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hides the site header/footer on full-screen experiences (the /mapa view brings its own chrome). */
export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/mapa" ? null : <>{children}</>;
}
