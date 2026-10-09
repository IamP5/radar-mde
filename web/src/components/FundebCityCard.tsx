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
    cell == null
      ? "sem dado"
      : cell.vaar === 1
        ? "esta rede está na lista oficial de beneficiárias"
        : "esta rede não está na lista oficial de beneficiárias";
  const yearsLabel = data.years.join(" e ");

  return (
    <Panel
      id="fundeb"
      title="Fundeb: quanto há por aluno e quanto vem da União"
      description={
        <>
          Quanto a rede tem por aluno e se a União manda um acréscimo para chegar ao piso. Não é o percentual do Fundeb pago aos profissionais, que aparece mais abaixo. O{" "}
          <Term k="vaat">VAAT</Term> é esse valor por aluno. Abaixo do <Term k="vaatMin">VAAT-MIN</Term>, a União complementa. Parte desse acréscimo (
          <Term k="iei">IEI</Term>) deve ir para creches e pré-escolas. O <Term k="vaar">VAAR</Term> é outra complementação, só para quem a publicação lista.
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
        {missing ? `Sem dado para ${shown}. Há publicação para ${yearsLabel}.` : fundebSentence(cell, floor)}
        {shown !== pageYear && !missing && <span className="text-muted-foreground"> O restante da página segue {pageYear}.</span>}
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
        <Stat wrap label={<Term k="vaat">Por aluno</Term>} value={missing ? "sem dado" : brlCents(cell.vaat)} sub="antes da complementação da União" />
        <Stat wrap label={<Term k="vaatMin">Piso nacional</Term>} value={floor == null ? "sem dado" : brlCents(floor)} sub="valor por aluno neste exercício" />
        <Stat
          wrap
          label={<Term k="comp">Complementação da União</Term>}
          value={missing ? "sem dado" : brlCents(cell.comp)}
          sub={missing ? undefined : cell.comp > 0 ? `total da rede; o valor por aluno vai a ${brlCents(cell.vaatCom)}` : "esta rede não recebe este acréscimo"}
        />
        <Stat
          wrap
          label={<Term k="iei">Para a educação infantil</Term>}
          value={missing ? "sem dado" : pct(cell.iei)}
          sub={missing ? undefined : cell.comp > 0 ? "desta complementação, para creches e pré-escola" : "sem complementação, o índice publicado é zero"}
        />
      </div>
      {!missing && (
        <p className="mt-3 text-sm text-foreground">
          {cell.comp > 0
            ? `Para uma reunião ou um ofício: a União destinou ${brlCents(cell.comp)} à rede em ${shown}, e ${pct(cell.iei)} desse valor deve ir para a educação infantil.`
            : `Para uma reunião ou um ofício: em ${shown} a publicação não prevê complementação da União para esta rede.`}
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        <Term k="vaar">VAAR</Term>: {vaar}
      </p>
    </Panel>
  );
}
