"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useId, useSyncExternalStore } from "react";
import YearPicker from "@/components/YearPicker";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { StatusBadge } from "@/components/kit/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, brlSigned, funMin, int, pct } from "@/lib/format";
import { IPCA_BASE, IPCA_LABEL, toReal } from "@/lib/rows";
import { THESIS_URL } from "@/lib/thesis";
import {
  DEFAULT_MIX,
  DEFAULT_PARAMS,
  LABOR,
  STAGES,
  THESIS_CRECHE_QUEUE,
  annualTeacherCost,
  classSize,
  clampParams,
  impliedEnrolment,
  parseScenario,
  proposalCsv,
  scenarioQuery,
  simulate,
  type Mix,
  type QualityParams,
  type Scenario,
  type YearSnapshot,
} from "@/lib/caqm";

const PQR_URL = "https://simcaq.ufg.br/assets/20260903_PQR_alterado.remuneracao_VF.pdf";
const PISO_URL = "https://in.gov.br/en/web/dou/-/portaria-mec-n-82-de-29-de-janeiro-de-2026-684167441";

type Props = {
  city: string;
  uf: string;
  slug: string;
  pop: number;
  initialYear: number;
  years: YearSnapshot[];
  thesis: boolean;
};

const pctField = (fraction: number) => String(Math.round(fraction * 1000) / 10);

function readNumber(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const urlBus = new EventTarget();

function subscribeUrl(onChange: () => void) {
  const notify = () => onChange();
  urlBus.addEventListener("change", notify);
  window.addEventListener("popstate", notify);
  return () => {
    urlBus.removeEventListener("change", notify);
    window.removeEventListener("popstate", notify);
  };
}

function publishUrl() {
  urlBus.dispatchEvent(new Event("change"));
}

export function Simulator({ city, uf, slug, pop, initialYear, years, thesis }: Props) {
  const yearList = years.map((y) => y.year);
  const search = useSyncExternalStore(subscribeUrl, () => window.location.search, () => "");
  const scenario = parseScenario(search, yearList, initialYear);
  const snap = years.find((y) => y.year === scenario.year) ?? years[years.length - 1];
  const implied = impliedEnrolment(snap.mdeV, snap.perAluno);

  const commit = (next: Scenario) => {
    const nextSnap = years.find((y) => y.year === next.year) ?? years[years.length - 1];
    const nextImplied = impliedEnrolment(nextSnap.mdeV, nextSnap.perAluno);
    const q = scenarioQuery(next, initialYear, nextImplied);
    const path = `${window.location.pathname}${q}`;
    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.replaceState(window.history.state, "", path);
    }
    publishUrl();
  };

  const stated = scenario.enrolment.kind === "stated" ? scenario.enrolment.total : null;
  const enrolment = stated ?? implied;
  const result = enrolment != null && enrolment > 0 ? simulate(enrolment, scenario.mix, scenario.params) : null;
  const spending = toReal(snap.mdeV, snap.year);
  const baseReal = toReal(snap.base, snap.year);
  const floor25 = baseReal == null ? null : baseReal * 0.25;
  const floor30 = baseReal == null ? null : baseReal * 0.3;
  const gap = result && spending != null ? result.total - spending : null;
  const perNow = toReal(snap.perAluno, snap.year);

  const setParams = (patch: Partial<QualityParams>) => commit({ ...scenario, params: clampParams({ ...scenario.params, ...patch }) });
  const setMix = (id: keyof Mix, raw: string) => {
    const n = readNumber(raw);
    if (n == null) return;
    commit({ ...scenario, mix: { ...scenario.mix, [id]: Math.min(100, Math.max(0, n)) } });
  };

  const download = () => {
    if (!result) return;
    const body = proposalCsv(city, uf, scenario.year, result);
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caqm-${uf.toLowerCase()}-${slug}-${scenario.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/${uf.toLowerCase()}/${slug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Voltar para {city}
          </Link>
        }
        title={`CAQM de ${city}`}
        description={
          <>
            Simulação cidadã para discutir um Custo Aluno-Qualidade municipal na revisão do PME. Não é o CAQ oficial da Lei Complementar
            220/2025, nem o cálculo do SimCAQ.
          </>
        }
        actions={
          <>
            <StatusBadge kind="info">Simulação</StatusBadge>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer />
              Imprimir proposta
            </Button>
            <Button type="button" variant="outline" onClick={download} disabled={!result}>
              Baixar CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => commit({ ...scenario, params: DEFAULT_PARAMS, mix: DEFAULT_MIX, enrolment: { kind: "implied" } })}
            >
              Restaurar parâmetros
            </Button>
          </>
        }
      >
        <p className="mt-4 text-[0.8125rem] text-muted-foreground">
          {city} ({uf}) · {int(pop)} hab. · o endereço desta página guarda o cenário
        </p>
      </PageHeader>

      <div data-subbar className="sticky top-(--header-h) z-30 border-b bg-(--header-bg) backdrop-blur-md backdrop-saturate-150 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <YearPicker years={yearList} year={scenario.year} onChange={(year) => commit({ ...scenario, year })} />
          <p className="text-[0.8125rem] text-muted-foreground">
            Gasto de {scenario.year} em {IPCA_LABEL}. Parâmetros em preços de 2026.
          </p>
        </div>
      </div>

      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={`Gasto em MDE, ${scenario.year}`} value={spending == null ? "sem dado" : brl(spending)} sub={snap.estimatedSpending ? "estimativa do painel (receita × %)" : IPCA_LABEL} />
          <Stat label="R$ por aluno declarado" value={perNow == null ? "sem dado" : brl(perNow)} sub="SIOPE 4.9, corrigido pelo IPCA" />
          <Stat label="Matrícula implícita" value={implied == null ? "sem dado" : int(implied)} sub="gasto em MDE ÷ R$ por aluno" />
          <Stat label="Fundeb na remuneração" value={snap.fun == null ? "sem dado" : pct(snap.fun)} sub={`mínimo legal ${funMin(scenario.year)}%`} />
        </div>

        {!snap.existed && (
          <p className="text-sm text-muted-foreground" role="status">
            {city} ainda não existia em {scenario.year}. Dá para simular um custo, sem gasto declarado para comparar.
          </p>
        )}

        <div className="print:hidden">
          <Panel
            title="Matrícula de partida"
            description="O painel não traz a matrícula por etapa. O total implícito reparte o gasto declarado pelo R$ por aluno do SIOPE. Troque pelos números da secretaria."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Matrícula total"
                value={enrolment == null ? "" : String(enrolment)}
                onChange={(raw) => {
                  const n = readNumber(raw);
                  if (n == null || n <= 0) return;
                  commit({ ...scenario, enrolment: { kind: "stated", total: Math.min(2_000_000, Math.round(n)) } });
                }}
                hint={implied == null ? "Sem R$ por aluno neste exercício: informe a matrícula." : `Implícita neste exercício: ${int(implied)}.`}
              />
              {STAGES.map((stage) => (
                <Field
                  key={stage.id}
                  label={`Parcela em ${stage.label} (%)`}
                  value={String(scenario.mix[stage.id])}
                  onChange={(raw) => setMix(stage.id, raw)}
                  hint="Ponto de partida da simulação, não é o Censo."
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => commit({ ...scenario, enrolment: { kind: "implied" } })} disabled={implied == null}>
                Usar a matrícula implícita
              </Button>
              {thesis && (
                <Button type="button" variant="outline" onClick={() => setParams({ crecheExtra: THESIS_CRECHE_QUEUE })}>
                  Incluir a fila da creche citada na tese ({int(THESIS_CRECHE_QUEUE)}, ano 2019)
                </Button>
              )}
            </div>
          </Panel>
        </div>

        <div className="print:hidden">
          <Panel
            title="Parâmetros de qualidade"
            description="Oito pontos de partida, no desenho do Padrão de Qualidade de Referência do SimCAQ. A comunidade escolar pode alterar cada um."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Alunos por turma na creche" value={String(scenario.params.crecheClass)} onChange={(raw) => patchInt(raw, "crecheClass", setParams)} hint="PQR urbano, faixas de 10, 16, 20 e 24 alunos, com 2 docentes. O padrão 18 é a média arredondada." />
              <Field label="Alunos por turma na pré-escola" value={String(scenario.params.preClass)} onChange={(raw) => patchInt(raw, "preClass", setParams)} hint="PQR urbano: 20 alunos e 1 docente." />
              <Field label="Alunos por turma no fundamental" value={String(scenario.params.efClass)} onChange={(raw) => patchInt(raw, "efClass", setParams)} hint="Média do PQR urbano: 20 nos anos iniciais e 25 nos finais." />
              <Field label="Remuneração mensal do professor" value={String(scenario.params.teacherMonthly)} onChange={(raw) => patchDecimal(raw, "teacherMonthly", setParams)} hint="Padrão R$ 7.687,01 (PQR, PNAD 1º trimestre de 2026, formação superior, 40 horas). O piso de 2026 é R$ 5.130,63." />
              <Field label="Hora-atividade (% da jornada)" value={pctField(scenario.params.planningShare)} onChange={(raw) => patchPercent(raw, "planningShare", setParams)} hint="Lei 11.738/2008: no máximo 2/3 da jornada com os estudantes. O padrão é 1/3." />
              <Field label="Matrículas em tempo integral (%)" value={pctField(scenario.params.fullTimeShare)} onChange={(raw) => patchPercent(raw, "fullTimeShare", setParams)} hint="PQR: 25% das matrículas. Creche e pré-escola passam de 4 para 10 horas; o fundamental, de 4 para 7. A EJA permanece em 4 horas." />
              <Field label="Vagas a mais na creche" value={String(scenario.params.crecheExtra)} onChange={(raw) => patchInt(raw, "crecheExtra", setParams)} hint="Soma à creche, sem reduzir as outras etapas." />
              <Field label="Materiais e manutenção (% da folha docente)" value={pctField(scenario.params.overheadShare)} onChange={(raw) => patchPercent(raw, "overheadShare", setParams)} hint="PQR: 22,5% da folha da escola para insumos e manutenção. Aqui a base é só a folha docente." />
            </div>
          </Panel>
        </div>

        <section aria-label="Resultado da simulação" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
            <Stat label="Custo simulado" value={result ? brl(result.total) : "sem dado"} sub="soma das etapas, preços dos parâmetros" />
            <Stat label="R$ por aluno simulado" value={result?.perStudent == null ? "sem dado" : brl(result.perStudent)} sub={result ? `${int(result.enrolment)} matrículas` : "informe a matrícula"} />
            <Stat
              label="Diferença contra o gasto"
              value={gap == null ? "sem dado" : brlSigned(gap)}
              sub={gap == null ? "falta o gasto declarado" : gap > 0 ? "o custo simulado supera o gasto" : "o gasto supera o custo simulado"}
            />
            <Stat label="Piso de 25% da receita" value={floor25 == null ? "sem dado" : brl(floor25)} sub={floor30 == null ? "referência constitucional" : `referência de 30%: ${brl(floor30)}`} />
          </div>

          <Panel title="Custo por etapa" description={`Exercício de comparação: ${scenario.year}. Valores do custo em preços dos parâmetros (2026).`} divided bodyClassName="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[0.8125rem] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Etapa</th>
                  <th className="px-2 py-2 font-medium">Matrículas</th>
                  <th className="px-2 py-2 font-medium">Turmas</th>
                  <th className="px-2 py-2 font-medium">R$ por aluno</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">Total</th>
                </tr>
              </thead>
              <tbody>
                {(result?.stages ?? STAGES.map((s) => ({ id: s.id, label: s.label, enrolment: null as number | null, classes: null as number | null, perStudent: null as number | null, total: null as number | null }))).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2 sm:px-5">{s.label}</td>
                    <td className="px-2 py-2 tnum">{s.enrolment == null ? "sem dado" : int(s.enrolment)}</td>
                    <td className="px-2 py-2 tnum">{s.classes == null ? "sem dado" : int(s.classes)}</td>
                    <td className="px-2 py-2 tnum">{s.perStudent == null ? "sem dado" : brl(s.perStudent)}</td>
                    <td className="px-4 py-2 text-right tnum sm:px-5">{s.total == null ? "sem dado" : brl(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </section>

        <Panel id="proposta" title="Proposta para a revisão do PME">
          <div className="print-only mb-4 text-sm">
            <p className="font-medium">Parâmetros deste cenário</p>
            <ul className="mt-2 space-y-1">
              <li>Creche: {scenario.params.crecheClass} alunos por turma. Pré-escola: {scenario.params.preClass}. Fundamental: {scenario.params.efClass}. EJA: {classSize("eja", scenario.params)}.</li>
              <li>Remuneração mensal: {brl(scenario.params.teacherMonthly)}. Hora-atividade: {pctField(scenario.params.planningShare)}%. Tempo integral: {pctField(scenario.params.fullTimeShare)}%.</li>
              <li>Vagas a mais na creche: {int(scenario.params.crecheExtra)}. Materiais e manutenção: {pctField(scenario.params.overheadShare)}% da folha docente.</li>
              <li>
                Reparto inicial: {STAGES.map((s) => `${s.label} ${scenario.mix[s.id]}%`).join(", ")}. Matrícula usada: {enrolment == null ? "sem dado" : int(enrolment)}.
              </li>
            </ul>
          </div>
          <div className="space-y-3 text-sm leading-6">
            <p>
              {city} ({uf}), exercício {scenario.year}. A comunidade escolar registra abaixo um custo por aluno para subsidiar a revisão do plano municipal de educação, na janela aberta pela Lei 15.388/2026 (PNE 2026–2036). O número é uma simulação. O CAQ oficial depende da comissão tripartite prevista na Lei Complementar 220/2025.
            </p>
            <p>
              {result ? (
                <>
                  O custo simulado é {brl(result.total)} ({result.perStudent == null ? "sem dado" : brl(result.perStudent)} por aluno), para {int(result.enrolment)} matrículas, das quais {int(result.crechePlaces)} na creche.
                </>
              ) : (
                <>Falta a matrícula para fechar o custo.</>
              )}{" "}
              {spending == null ? (
                <>Não há gasto em MDE declarado neste exercício para comparar.</>
              ) : gap != null && gap > 0 ? (
                <>Esse custo supera o gasto em MDE ({brl(spending)}, {IPCA_LABEL}) em {brl(gap)}.</>
              ) : gap != null ? (
                <>O gasto em MDE ({brl(spending)}, {IPCA_LABEL}) supera esse custo em {brl(Math.abs(gap))}. A diferença não mede aprendizado: a simulação não inclui funcionários não docentes nem transporte, e o PQR aplica o percentual de insumos sobre a folha inteira da escola.</>
              ) : null}
            </p>
            <p>
              {floor25 == null ? (
                <>Não há receita de impostos neste exercício para comparar com os pisos.</>
              ) : (
                <>
                  A receita correspondente a 25% (piso constitucional) é {brl(floor25)}
                  {floor30 == null ? "" : `, e a referência de 30% é ${brl(floor30)}`}. Os 30% vêm da meta da Lei municipal 9.723/2015 de Santo André. {thesis ? "Ela vale para este município." : "Não é regra deste município. Entra só como comparação."}
                </>
              )}
            </p>
            <p>
              {snap.fun == null ? (
                <>Não há percentual do Fundeb na remuneração neste exercício.</>
              ) : (
                <>
                  No exercício, {pct(snap.fun)} do Fundeb foi para a remuneração dos profissionais (mínimo legal {funMin(scenario.year)}%). O painel não traz o Fundeb em reais, só esse percentual (SIOPE 1.2).
                </>
              )}
            </p>
            {thesis && (
              <p>
                A pesquisa que originou este painel (Silva, 2021) descreve, em Santo André, gasto por aluno alto e uma fila de creche de {int(THESIS_CRECHE_QUEUE)} crianças em 2019. A fila não é a demanda atual.{" "}
                <a href={THESIS_URL} target="_blank" rel="noreferrer">
                  Tese
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
                .
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Como a conta é feita">
          <div className="space-y-3 text-sm leading-6 text-pretty">
            <p>
              Para cada etapa, o número de turmas é a matrícula dividida pelos alunos por turma, arredondada para cima. A jornada docente é de {LABOR.weeklyHours} horas, com a hora-atividade fora da sala. Um docente em tempo integral na conta custa {LABOR.salaryMonths} remunerações mensais (12 meses, 13º e 1/3 de férias) mais {pct(LABOR.employerRate * 100, 0)} de encargos patronais. Com o padrão, isso é {brl(annualTeacherCost(scenario.params.teacherMonthly))} por docente no ano.
            </p>
            <p>
              A creche conta 2 docentes com a turma. As outras etapas contam 1. O tempo integral alonga o dia e, por isso, pede mais docentes para cobrir as horas. A alimentação usa os valores por dia do PQR (dobro do PNAE de 2026) em {LABOR.schoolDays} dias. Materiais e manutenção são o percentual informado sobre a folha docente. A secretaria entra com mais {pct(LABOR.adminShare * 100, 1)}, também sobre a folha docente.
            </p>
            <p>
              O gasto comparado é o valor aplicado em MDE (SIOPE 8.2, ou a estimativa do painel quando o declarado falta), levado a reais de {IPCA_BASE}. A matrícula implícita divide esse valor, ainda nominal, pelo R$ por aluno do mesmo ano (SIOPE 4.9). Não é o Censo Escolar. Onde o dado não existe, a tela mostra “sem dado”.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <a href={PQR_URL} target="_blank" rel="noreferrer">
                  SimCAQ, Padrão de Qualidade de Referência, 3 set. 2026
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </li>
              <li>
                <a href={PISO_URL} target="_blank" rel="noreferrer">
                  Portaria MEC nº 82/2026, piso de R$ 5.130,63
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </li>
              <li>Lei 11.738/2008, art. 2º, § 4º (hora-atividade). Lei Complementar 220/2025 (CAQ). Lei 15.388/2026 (PNE). Lei municipal 9.723/2015 de Santo André (meta de 30%).</li>
            </ul>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}

function patchInt(raw: string, key: "crecheClass" | "preClass" | "efClass" | "crecheExtra", setParams: (patch: Partial<QualityParams>) => void) {
  const n = readNumber(raw);
  if (n == null) return;
  setParams({ [key]: Math.round(n) });
}

function patchDecimal(raw: string, key: "teacherMonthly", setParams: (patch: Partial<QualityParams>) => void) {
  const n = readNumber(raw);
  if (n == null) return;
  setParams({ [key]: n });
}

function patchPercent(raw: string, key: "planningShare" | "fullTimeShare" | "overheadShare", setParams: (patch: Partial<QualityParams>) => void) {
  const n = readNumber(raw);
  if (n == null) return;
  const fraction = n / 100;
  setParams({ [key]: key === "planningShare" && Math.abs(fraction - 1 / 3) < 0.0006 ? 1 / 3 : fraction });
}

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (raw: string) => void; hint: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-[0.8125rem] leading-5 text-muted-foreground">
        {label}
      </label>
      <Input id={id} className="mt-1 tnum" inputMode="decimal" aria-describedby={`${id}-hint`} value={value} onChange={(e) => onChange(e.target.value)} />
      <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
