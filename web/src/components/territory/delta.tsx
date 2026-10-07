import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "@/components/kit/stat";

/**
 * KPI delta pill content, identical on Brasil, região and UF dashboards (JOR-15):
 * arrow + signed magnitude + "vs {ano anterior}", e.g. "↘ −61 vs 2024", "↗ +0,1 p.p. vs 2024", "= 2024".
 * Tone depends on whether "up" is good or bad for the metric; `neutralize` forces a neutral tone
 * (e.g. fewer below 25% only because more municipalities stopped declaring).
 */
export function delta(
  d: number | null,
  fmt: (abs: number) => string,
  upIs: "bad" | "good",
  vs: number | undefined,
  neutralize = false,
): { node?: ReactNode; tone: Tone } {
  if (d == null || vs == null || !Number.isFinite(d)) return { tone: "neutral" };
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  const tone: Tone = d === 0 || neutralize ? "neutral" : (d > 0) === (upIs === "bad") ? "bad" : "good";
  const mag = fmt(Math.abs(d));
  return {
    tone,
    node: (
      <span className="inline-flex items-center gap-0.5">
        <Icon aria-hidden className="size-3" />
        {d === 0 ? (
          <>
            <span aria-hidden>= {vs}</span>
            <span className="sr-only">igual a {vs}</span>
          </>
        ) : (
          <>
            <span aria-hidden>
              {d > 0 ? "+" : "−"}
              {mag}
              <span className="font-normal"> vs {vs}</span>
            </span>
            <span className="sr-only">
              {mag} {d > 0 ? "a mais" : "a menos"} que em {vs}
            </span>
          </>
        )}
      </span>
    ),
  };
}

export const relChange = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || b === 0 ? null : ((a - b) / b) * 100);
export const fmtPct0 = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
export const fmtPp = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
