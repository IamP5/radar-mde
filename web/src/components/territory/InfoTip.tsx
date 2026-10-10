"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";

/** Tap-able (not hover-only) "what is this?" popover for KPI labels. A 24px icon with a 40px hit area. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="relative -my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 after:absolute after:-inset-2 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground print:hidden"
      >
        <Info aria-hidden className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-80">
        <div className="space-y-2 text-sm leading-5 text-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/** The R$ shortfall KPI, explained the same way on every territory dashboard (JOR-06). */
export function ShortfallInfo({ atypical }: { atypical?: string | null } = {}) {
  return (
    <InfoTip label="Como o valor que faltou aplicar é calculado">
      <p>
        <strong className="font-medium">Estimativa</strong> de quanto faltou para chegar a 25%: (25% − % declarado) × receita de impostos do
        município, somada nos municípios que ficaram abaixo do mínimo naquele ano.
      </p>
      <p className="text-muted-foreground">
        Usa os valores que as próprias prefeituras declararam ao SIOPE, em reais da época (sem correção pela inflação). Os tribunais de contas
        podem apurar valores diferentes.
      </p>
      {atypical && (
        <p className="text-muted-foreground">
          Desse total, {atypical} vêm de valores fora do padrão do próprio município (confirme na fonte).
        </p>
      )}
      <Link href="/sobre#calculos" className="font-medium text-brand-ink underline-offset-2 hover:underline">
        Ver a metodologia
      </Link>
    </InfoTip>
  );
}
