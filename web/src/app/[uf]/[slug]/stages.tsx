"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import MultiLine from "@/components/MultiLine";
import { ChartActions } from "@/components/kit/chart-actions";
import { Panel } from "@/components/kit/panel";
import { Segmented } from "@/components/kit/segmented";
import { Stat } from "@/components/kit/stat";
import { brl, pct } from "@/lib/format";
import {
  STAGE_BY_ID, STAGE_CHART, STAGE_FIELDS, STAGE_PER_STUDENT, STAGE_QUIET,
  medianN, stageMoney, stageRealKey, stageText, shareStack,
  type MedianMap, type StageId, type StageYearMap,
} from "@/lib/etapas-fields";
import { IPCA_BASE } from "@/lib/rows";
import { THESIS_URL } from "@/lib/thesis";
import { useCitySelection } from "./city-year";
import { Term } from "./glossary";

const DASH = [undefined, "1 3.5", "5 3", "10 3 2 3", "18 4"] as const;

function FieldLabel({ id }: { id: StageId }) {
  if (id === "cre") return <Term k="creche">Creche</Term>;
  if (id === "eja") return <Term k="eja">EJA</Term>;
  if (id === "ee") return <Term k="ee">Educação especial</Term>;
  if (id === "fuEi") return <><Term k="fundeb">Fundeb</Term> na educação infantil</>;
  if (id === "fuEf") return <><Term k="fundeb">Fundeb</Term> no fundamental</>;
  return STAGE_BY_ID[id].label;
}

function ShareBar({ shEi, shEf }: { shEi: number | null; shEf: number | null }) {
  const stack = shareStack(shEi, shEf);
  if (!stack) return <p className="text-sm text-muted-foreground">sem dado</p>;
  const parts = [
    { key: "ei", label: "Educação infantil", value: stack.ei, color: "var(--series-1)" },
    { key: "ef", label: "Ensino fundamental", value: stack.ef, color: "var(--series-2)" },
    { key: "other", label: "Demais etapas", value: stack.other, color: "var(--muted-foreground)" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-sm" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.value)}`).join(", ")}>
        {parts.map((p) =>
          p.value > 0 ? <span key={p.key} data-swatch className="h-full" style={{ width: `${p.value}%`, background: p.color }} /> : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden data-swatch className="size-2.5 rounded-[2px]" style={{ background: p.color }} />
            <span>{p.label}</span>
            <span className="tnum text-foreground">{pct(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StagePanel({
  name, uf, slug, thesis, years, city, ufMedians, brMedians,
}: {
  name: string;
  uf: string;
  slug: string;
  thesis: boolean;
  years: number[];
  city: StageYearMap;
  ufMedians: MedianMap;
  brMedians: MedianMap;
}) {
  const { year, setYear } = useCitySelection();
  const [mode, setMode] = useState<"nominal" | "real">("nominal");
  const real = mode === "real";
  const cell = city[String(year)];
  const span = `${years[0]}–${years[years.length - 1]}`;
  const who = `${name} (${uf})`;
  const series = STAGE_CHART.map((id, i) => ({
    key: id,
    label: STAGE_BY_ID[id].label,
    color: `var(--series-${i + 1})`,
    dash: DASH[i],
    values: years.map((y) => stageMoney(city[String(y)]?.[id] ?? null, y, real)),
  }));
  const csvColumns = ["ano", ...STAGE_CHART.map((id) => (real ? stageRealKey(STAGE_BY_ID[id].csv) : STAGE_BY_ID[id].csv))];
  const place = medianText(ufMedians, brMedians, year, real);

  return (
    <Panel
      id="etapas"
      title="Para onde vai o dinheiro"
      description={
        <>
          Fonte: SIOPE. O valor por aluno usa a matrícula que o ente declarou, não o Censo Escolar.
          {thesis && (
            <>
              {" "}
              O destino do gasto é o que a Figura 39 da tese de Adriana Zanini da Silva (UNINOVE, 2021) discute.{" "}
              <a href={THESIS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                Ler a tese <ExternalLink className="size-3" />
              </a>
            </>
          )}
        </>
      }
      action={
        <>
          <Segmented
            ariaLabel="Valores por etapa"
            value={mode}
            onChange={setMode}
            options={[
              { value: "nominal", label: "Da época" },
              { value: "real", label: "Corrigido pelo IPCA" },
            ]}
          />
          <ChartActions
            title={`Gasto por etapa, R$ por aluno, ${real ? `R$ de ${IPCA_BASE}` : "valores da época"} — ${who}, ${span}`}
            filename={[uf.toLowerCase(), slug, "etapas", real ? "ipca" : "nominal"]}
            legend={series.map((s) => ({ label: s.label, color: s.color, dash: s.dash }))}
            note={real ? `R$ de ${IPCA_BASE}, corrigidos pelo IPCA.` : "Valores da época, sem correção pela inflação."}
            csv={{
              columns: csvColumns,
              rows: years.map((y) => {
                const row: Record<string, number | null> = { ano: y };
                for (const id of STAGE_CHART) {
                  row[real ? stageRealKey(STAGE_BY_ID[id].csv) : STAGE_BY_ID[id].csv] = stageMoney(city[String(y)]?.[id] ?? null, y, real);
                }
                return row;
              }),
            }}
          />
        </>
      }
      footer={`Indicadores SIOPE ${STAGE_FIELDS.map((f) => f.siope).join(", ")}. O 0 é tratado como ausente.`}
    >
      <ShareBar shEi={cell?.shEi ?? null} shEf={cell?.shEf ?? null} />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {STAGE_PER_STUDENT.map((id) => (
          <Stat
            key={id}
            label={<FieldLabel id={id} />}
            value={stageText(id, cell?.[id] ?? null, year, real)}
            tone="neutral"
            sub={place(id)}
            context={cell?.atip?.includes(id) ? "fora do padrão do próprio ente" : undefined}
          />
        ))}
      </div>
      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {STAGE_QUIET.map((id) => (
          <div key={id} className="flex items-baseline justify-between gap-3 border-b py-2">
            <dt className="text-[0.8125rem] text-muted-foreground">
              <FieldLabel id={id} />
            </dt>
            <dd className="text-right text-sm font-medium tnum">
              {stageText(id, cell?.[id] ?? null, year, real)}
              {cell?.atip?.includes(id) && <div className="text-xs font-normal text-muted-foreground">fora do padrão do próprio ente</div>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <MultiLine
          years={years}
          series={series}
          selected={year}
          onSelect={setYear}
          fmt={brl}
          ariaLabel={`Gasto por etapa em ${name}, reais por aluno`}
          height={260}
        />
      </div>
    </Panel>
  );
}

function medianText(ufMedians: MedianMap, brMedians: MedianMap, year: number, real: boolean) {
  const one = (map: MedianMap, id: StageId) => {
    const cell = map[String(year)];
    if (!medianN(cell, id)) return "sem dado";
    return stageText(id, cell?.[id] ?? null, year, real);
  };
  return (id: StageId) => `UF ${one(ufMedians, id)} · Brasil ${one(brMedians, id)}`;
}
