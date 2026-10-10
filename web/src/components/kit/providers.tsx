"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArcProvider } from "@/components/arc/lib/arc-provider";
import { ThemeProvider } from "./theme";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ArcProvider link={Link}>{children}</ArcProvider>
    </ThemeProvider>
  );
}
