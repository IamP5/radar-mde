"use client";

import { useMemo, useState } from "react";
import Choropleth, { Legend } from "@/components/Choropleth";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { Segmented } from "@/components/kit/segmented";
import { NO_DATA_COLOR, type Bin } from "@/lib/bins";
import { brlCents, brlShort, int, share } from "@/lib/format";
import { cityPath } from "@/lib/geo";
import type { FundebMapPayload } from "@/lib/fundeb-types";

const RECEIVE = "var(--bin-5)";
const NONE = "var(--bin-3)";

const BINS: Bin[] = [
  { key: "recebe", label: "Recebe complementação", color: RECEIVE, test: (v) => v === 2 },
  { key: "nao", label: "Não recebe", color: NONE, test: (v) => v === 1 },
];

export function FundebMap({
  pageYear,
  data,
  src,
  ufCodes,
  scopeLabel,
}: {
  pageYear: number;
  data: FundebMapPayload;
  src: "br" | string;
  ufCodes?: number[];
  scopeLabel: string;
}) {
  const [pick, setPick] = useState<{ year: number; pageYear: number } | null>(null);
  const chosen = pick && pick.pageYear === pageYear ? pick.year : pageYear;
  const shown = data.years.includes(chosen) ? chosen : null;
  const key = shown == null ? "" : String(shown);
  const summary = shown == null ? undefined : data.byYear[key];
  const places = useMemo(() => {
    const map = new Map<number, { name: string; uf: string; slug: string; mark: string }>();
    const bits = data.mark[key] ?? "";
    data.id.forEach((id, i) => map.set(id, { name: data.name[i], uf: data.uf[i], slug: data.slug[i], mark: bits[i] ?? "0" }));
    return map;
  }, [data, key]);

  return (
    <Panel
      id="fundeb-mapa"
      title={`Quem recebe a complementação VAAT · ${scopeLabel}`}
      description="Municípios cuja rede fica abaixo do VAAT-MIN e recebe a complementação da União neste exercício. Valores nominais da portaria."
      action={
        <Segmented
          ariaLabel="Exercício da complementação VAAT"
          value={shown == null ? "sem" : String(shown)}
          onChange={(v) => setPick({ year: v === "sem" ? pageYear : Number(v), pageYear })}
          options={[
            ...(!data.years.includes(pageYear) ? [{ value: "sem", label: String(pageYear) }] : []),
            ...data.years.map((y) => ({ value: String(y), label: String(y) })),
          ]}
        />
      }
      footer={
        summary ? (
          <>
            {summary.label}. {summary.portaria}.{" "}
            <a href={summary.page} target="_blank" rel="noreferrer" className="font-medium text-brand-ink underline-offset-2 hover:underline">
              Publicação no FNDE
            </a>
          </>
        ) : (
          "sem dado para este exercício."
        )
      }
    >
      {summary ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Recebem complementação" value={int(summary.nReceive)} sub={`de ${int(summary.nKnown)} com VAAT publicado`} />
            <Stat label="Parcela" value={share(summary.nReceive, summary.nKnown)} sub="dos municípios com dado" />
            <Stat className="col-span-2 lg:col-span-1" label="Total da complementação" value={brlShort(summary.total)} sub={`piso ${brlCents(summary.floor)} por aluno`} />
          </div>
          <Choropleth
            src={src}
            layer="mun"
            ufCodes={ufCodes}
            height={440}
            ariaLabel={`Mapa de ${scopeLabel}: municípios que recebem complementação VAAT em ${shown}`}
            fill={(id) => {
              const m = places.get(id)?.mark;
              if (m === "2") return RECEIVE;
              if (m === "1") return NONE;
              return NO_DATA_COLOR;
            }}
            label={(id) => {
              const p = places.get(id);
              if (!p) return "";
              const status = p.mark === "2" ? "recebe complementação VAAT" : p.mark === "1" ? "não recebe complementação VAAT" : "sem dado";
              return `${p.name}: ${status}`;
            }}
            href={(id) => {
              const p = places.get(id);
              return p ? cityPath(p.uf, p.slug) : null;
            }}
            tooltip={(id) => {
              const p = places.get(id);
              if (!p || p.mark === "0") return <div className="text-muted-foreground">sem dado</div>;
              return (
                <>
                  <div className="font-semibold">{p.mark === "2" ? "Recebe complementação" : "Não recebe complementação"}</div>
                  <div className="text-muted-foreground">{p.name}</div>
                </>
              );
            }}
          />
          <Legend title={`Complementação VAAT em ${shown}`} bins={BINS} />
        </>
      ) : (
        <p className="text-sm text-foreground">sem dado</p>
      )}
    </Panel>
  );
}
