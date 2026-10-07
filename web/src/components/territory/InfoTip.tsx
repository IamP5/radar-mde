"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Tap-able (not hover-only) "what is this?" popover for KPI labels. 24px target, muted icon. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="-my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground print:hidden"
      >
        <Info aria-hidden className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 max-w-[calc(100vw-2rem)] text-[13px] leading-5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** The R$ shortfall KPI, explained the same way on every territory dashboard (JOR-06). */
export function ShortfallInfo() {
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
      <Link href="/sobre#calculos" className="font-medium text-brand-ink underline-offset-2 hover:underline">
        Ver a metodologia
      </Link>
    </InfoTip>
  );
}
