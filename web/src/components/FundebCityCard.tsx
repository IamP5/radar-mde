"use client";

import { useState } from "react";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { Segmented } from "@/components/kit/segmented";
import { brlCents, pct } from "@/lib/format";
import { fundebSentence, type FundebCityView } from "@/lib/fundeb-types";
import { Term } from "@/app/[uf]/[slug]/glossary";

export function FundebCityCard({ data, pageYear }: { data: FundebCityView; pageYear: number }) {
  const [pick, setPick] = useState<{ year: number; pageYear: number } | null>(null);
  const shown = pick && pick.pageYear === pageYear ? pick.year : pageYear;
  const key = String(shown);
  const inCatalog = data.years.includes(shown);
  const cell = data.rows[key];
  const floor = data.floor[key];
  const pub = data.publications[key];
  const missing = cell == null || floor == null;
  const max = missing ? 1 : Math.max(cell.vaat, cell.vaatCom, floor, 1);
  const vaar =
    cell == null ? "sem dado" : cell.vaar === 1 ? "Recebe complementação VAAR" : "Não recebe complementação VAAR";

  return (
    <Panel
      id="fundeb"
      title="Fundeb: quanto há por aluno e quanto vem da União"
      description={
        <>
          O <Term k="vaat">VAAT</Term> é o quanto a rede tem por aluno, somando receitas próprias e transferências. Se fica abaixo do{" "}
          <Term k="vaatMin">VAAT-MIN</Term>, a União complementa. Parte desse acréscimo (<Term k="iei">IEI</Term>) vai para a educação infantil. O{" "}
          <Term k="vaar">VAAR</Term> é outra complementação, condicionada a critérios de gestão.
        </>
      }
      action={
        data.years.length > 1 ? (
          <Segmented
            ariaLabel="Exercício do Fundeb"
            value={inCatalog ? String(shown) : "sem"}
            onChange={(v) => setPick({ year: v === "sem" ? pageYear : Number(v), pageYear })}
            options={[
              ...(!data.years.includes(pageYear) ? [{ value: "sem", label: String(pageYear) }] : []),
              ...data.years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
          />
        ) : undefined
      }
      footer={
        pub ? (
          <>
            {pub.label}. {pub.portaria}. Valores nominais do exercício, como publicados. Não são corrigidos pelo IPCA.{" "}
            <a href={pub.page} target="_blank" rel="noreferrer" className="font-medium text-brand-ink underline-offset-2 hover:underline">
              Publicação no FNDE
            </a>
            {pub.note ? ` ${pub.note}` : ""}
          </>
        ) : (
          "Sem publicação do FNDE para este exercício."
        )
      }
    >
      <p className="text-sm text-foreground">
        {missing ? "sem dado" : fundebSentence(cell, floor)}
        {shown !== pageYear && <span className="text-muted-foreground"> O restante da página segue {pageYear}.</span>}
      </p>
      {!missing && (
        <div className="mt-4" role="img" aria-label={`VAAT de ${brlCents(cell.vaat)} por aluno. O VAAT-MIN nacional é ${brlCents(floor)}.`}>
          <div className="relative h-3 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(cell.vaat / max) * 100}%` }} />
            <div className="absolute inset-y-[-3px] w-0.5 bg-foreground" style={{ left: `${(floor / max) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>VAAT {brlCents(cell.vaat)}</span>
            <span>VAAT-MIN {brlCents(floor)}</span>
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="VAAT por aluno" value={missing ? "sem dado" : brlCents(cell.vaat)} sub="antes da complementação" />
        <Stat label="VAAT-MIN" value={floor == null ? "sem dado" : brlCents(floor)} sub="piso nacional do exercício" />
        <Stat
          label="Complementação VAAT"
          value={missing ? "sem dado" : brlCents(cell.comp)}
          sub={missing ? undefined : cell.comp > 0 ? `eleva para ${brlCents(cell.vaatCom)}` : "não recebe"}
        />
        <Stat label="Educação infantil (IEI)" value={missing ? "sem dado" : pct(cell.iei)} sub="da complementação" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        <Term k="vaar">VAAR</Term>: {vaar}
      </p>
    </Panel>
  );
}
