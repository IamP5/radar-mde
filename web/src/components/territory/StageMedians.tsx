"use client";

import { useState } from "react";
import { Panel } from "@/components/kit/panel";
import { Segmented } from "@/components/kit/segmented";
import { IPCA_BASE } from "@/lib/rows";
import { STAGE_BY_ID, STAGE_DASHBOARD, latestMedianYear, medianN, stageText, type MedianMap, type StageId } from "@/lib/etapas-fields";

function figure(map: MedianMap, id: StageId, year: number, real: boolean) {
  const cell = map[String(year)];
  if (!medianN(cell, id)) return "sem dado";
  return stageText(id, cell?.[id] ?? null, year, real);
}

function dashLabel(id: StageId): string {
  if (id === "eja") return "EJA (jovens e adultos)";
  if (id === "shEi") return "Parte na educação infantil";
  if (id === "shEf") return "Parte no ensino fundamental";
  return STAGE_BY_ID[id].label;
}

export function StageMedians({ year, scope, brasil }: { year: number; scope: MedianMap; brasil?: MedianMap }) {
  const [mode, setMode] = useState<"nominal" | "real">("nominal");
  const real = mode === "real";
  return (
    <Panel
      id="etapas"
      className="scroll-mt-[calc(var(--header-h,3.5rem)+3.25rem)]"
      stackAction
      title="Para onde vai o dinheiro"
      description={`Mediana dos municípios neste ano — não é uma cidade. EJA é a educação de jovens e adultos. Os reais são por aluno, com a matrícula declarada ao SIOPE (FNDE), não o Censo Escolar. Os percentuais são a parte desse gasto. Da época são os reais do ano; corrigido pelo IPCA usa reais de ${IPCA_BASE} e não altera os percentuais. No ano mais recente os dois coincidem.`}
      action={
        <Segmented
          ariaLabel="Valores por etapa"
          value={mode}
          onChange={setMode}
          options={[
            { value: "nominal", label: "Da época" },
            { value: "real", label: "Corrigido pelo IPCA" },
          ]}
        />
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {STAGE_DASHBOARD.map((id) => {
          const shown = figure(scope, id, year, real);
          const last = shown === "sem dado" ? latestMedianYear(scope, id) : null;
          return (
            <div key={id} className="min-w-0">
              <dt className="text-[0.8125rem] text-muted-foreground">{dashLabel(id)}</dt>
              <dd className="mt-0.5 text-sm font-semibold tnum">{shown}</dd>
              {last != null && last < year && <dd className="text-xs text-muted-foreground">última mediana: {last}</dd>}
              {brasil && <dd className="text-xs text-muted-foreground tnum">mediana do Brasil {figure(brasil, id, year, real)}</dd>}
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}
