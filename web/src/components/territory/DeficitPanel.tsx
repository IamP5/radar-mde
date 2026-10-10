"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useUrlParam } from "./useUrlParam";
import { Panel } from "@/components/kit/panel";
import { Segmented } from "@/components/kit/segmented";
import { withYear } from "@/components/YearPicker";
import { brlShort } from "@/lib/format";
import { cityPath } from "@/lib/geo";
import { IPCA_BASE, type Deficit } from "@/lib/rows";
import { cn } from "@/lib/utils";

/** "…, 2021, 2022, 2023, 2025": the most recent years, ellipsis in front when older ones are omitted. */
const lastYears = (ys: number[]) => `${ys.length > 4 ? "…, " : ""}${ys.slice(-4).join(", ")}`;

/**
 * "Maiores déficits acumulados", shared by Brasil/região and UF dashboards.
 * - Nominal / Corrigido (IPCA) toggle: each list is ranked by its own balance (server-side `topDeficits(…, { real })`).
 * - GOV-12: a ⚠ marks municipalities whose balance depends on a year flagged as outside its own pattern.
 */
export function DeficitPanel({
  nominal, real, years, year, initialYear, className, compact,
}: { nominal: Deficit[]; real: Deficit[]; years: number[]; year: number; initialYear: number; className?: string; compact?: boolean }) {
  const [mode, setMode] = useUrlParam<"nom" | "real">("valores", { nom: "nominal", real: "ipca" }, "nom");
  const list = mode === "real" ? real : nominal;
  const last = years[years.length - 1];
  return (
    <Panel
      divided
      className={className}
      title={`Maiores déficits acumulados até ${last}`}
      description={
        mode === "real"
          ? `Saldo estimado que faltou para 25% de ${years[0]} a ${last}, descontado o que foi aplicado a mais depois, em R$ de ${IPCA_BASE} corrigidos pelo IPCA. Não muda com o ano escolhido.`
          : `Saldo estimado que faltou para 25% de ${years[0]} a ${last}, descontado o que foi aplicado a mais depois, em valores nominais (R$ da época). Não muda com o ano escolhido.`
      }
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2 sm:px-5">
        <Segmented
          ariaLabel="Valores do déficit"
          value={mode}
          onChange={setMode}
          options={[
            { value: "nom", label: "Nominal", title: "Valores da época, sem correção" },
            { value: "real", label: "Corrigido (IPCA)", title: `R$ de ${IPCA_BASE}, corrigidos pelo IPCA` },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted-foreground sm:px-5">Nenhum déficit acumulado.</p>
      ) : (
        <ol className={cn("scroll-thin fade-b overflow-y-auto pb-6", compact ? "max-h-[20rem] p-1.5 text-sm" : "max-h-[21rem] divide-y")}>
          {list.map((d, i) => {
            const atip = d.atipYears ?? [];
            const atipText = atip.length
              ? `Inclui ${atip.length === 1 ? "valor" : "valores"} fora do padrão do próprio município (${atip.join(", ")}); confirme na fonte`
              : null;
            return (
              <li key={d.id}>
                <Link
                  href={withYear(cityPath(d.uf, d.slug), year, initialYear)}
                  className={cn("flex items-center gap-3 transition-colors duration-150 hover:bg-accent/60", compact ? "rounded-md px-2.5 py-2" : "px-4 py-2.5 sm:px-5")}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tnum">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{d.name}</span>
                      {!compact && <span className="shrink-0 rounded border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{d.uf}</span>}
                      {atipText && (
                        <span title={atipText} className="inline-flex shrink-0 items-center text-warning">
                          <TriangleAlert aria-hidden className="size-3.5" />
                          <span className="sr-only">{atipText}</span>
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground tnum" title={d.below.join(", ")}>
                      {d.below.length} {d.below.length === 1 ? "ano" : "anos"} abaixo: {lastYears(d.below)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-critical-ink tnum">{brlShort(mode === "real" ? d.carryReal : d.carry)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <p className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">
        <TriangleAlert aria-hidden className="mr-1 inline size-3 align-[-1px] text-warning" />
        depende de valor fora do padrão do próprio município: confirme na fonte.
      </p>
    </Panel>
  );
}
