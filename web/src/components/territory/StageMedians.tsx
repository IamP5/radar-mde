"use client";

import { useState } from "react";
import { Panel } from "@/components/kit/panel";
import { Segmented } from "@/components/kit/segmented";
import { STAGE_BY_ID, STAGE_DASHBOARD, medianN, stageText, type MedianMap, type StageId } from "@/lib/etapas-fields";

function figure(map: MedianMap, id: StageId, year: number, real: boolean) {
  const cell = map[String(year)];
  if (!medianN(cell, id)) return "sem dado";
  return stageText(id, cell?.[id] ?? null, year, real);
}

export function StageMedians({ year, scope, brasil }: { year: number; scope: MedianMap; brasil?: MedianMap }) {
  const [mode, setMode] = useState<"nominal" | "real">("nominal");
  const real = mode === "real";
  return (
    <Panel
      id="etapas"
      title="Para onde vai o dinheiro"
      description="Mediana dos municípios no ano. O valor por aluno usa a matrícula declarada ao SIOPE, não o Censo Escolar."
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
        {STAGE_DASHBOARD.map((id) => (
          <div key={id} className="min-w-0">
            <dt className="text-[0.8125rem] text-muted-foreground">{STAGE_BY_ID[id].label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tnum">{figure(scope, id, year, real)}</dd>
            {brasil && <dd className="text-xs text-muted-foreground tnum">Brasil {figure(brasil, id, year, real)}</dd>}
          </div>
        ))}
      </dl>
    </Panel>
  );
}
