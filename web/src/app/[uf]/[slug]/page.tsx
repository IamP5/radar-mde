import { CircleAlert, ExternalLink, Info, MessageSquareText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ActionKit from "@/components/ActionKit";
import Breadcrumbs from "@/components/Breadcrumbs";
import TrendChart from "@/components/TrendChart";
import { ChartActions } from "@/components/kit/chart-actions";
import WatchButton from "@/components/WatchButton";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { EmptyState, Panel } from "@/components/kit/panel";
import { StatusBadge, StatusDot } from "@/components/kit/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MDE_MIN,
  PANDEMIC_YEARS,
  YEARS,
  allCities,
  brStats,
  brl,
  brlShort,
  citiesOf,
  cityHasHealth,
  IPCA_BASE,
  deficitTrail,
  existedIn,
  fundebLeftMax,
  funMin,
  getCity,
  latestYear,
  mdeStatus,
  pct,
  periodBalance,
  siconfiUrl,
  siopeUrl,
  ufStats,
  type City,
} from "@/lib/data";
import { cityPath, getRegion, getUf, ofUf } from "@/lib/geo";
import { buildTemplates, cityFacts, emAnos, inUf, listYears } from "@/lib/templates";
import { THESIS_SANTO_ANDRE, THESIS_SANTO_ANDRE_ID, THESIS_URL } from "@/lib/thesis";
import { cn } from "@/lib/utils";
import {
  AtypicalCallout,
  CityYearProvider,
  DistributionPanel,
  HeaderShare,
  HeaderSource,
  HeaderStatus,
  MapPanel,
  PeersPanel,
  RankPanel,
  YearBar,
  YearKpis,
  PeriodBalanceCard,
} from "./city-year";
import { Term } from "./glossary";
import { type CityYearData, type Rank, type St, type YearPoint, summary } from "./verdict";

// The page validates its params above any Suspense boundary (so an unknown slug is a real 404, not a streamed soft
// 404) and the whole route must stay static. The selected year (?ano=) is applied on the client from data already in
// the page. `instant = false`: the params are read outside <Suspense> on purpose (nothing actually blocks).
export const ensureStatic = "navigation";
export const instant = false;

/** Cities prerendered at build: capitals and those with ≥ 200 mil habitantes (~160 pages, ~0.6 MB each). */
const PRERENDER_POP = 200_000;

// Prerendering all 5.570 cities made every deployment ~3.5 GB (Vercel stores each one in full). The rest render on
// their first visit: `ensureStatic = "navigation"` makes that request wait for the complete static page, which is
// then cached (ISR) for everyone after; cities nobody opens are never stored.
export function generateStaticParams() {
  return allCities()
    .filter((c) => c.capital || c.pop >= PRERENDER_POP)
    .map((c) => ({ uf: c.uf.toLowerCase(), slug: c.slug }));
}

/** Only the canonical lowercase address resolves; other casings redirect, anything else is a 404. */
const resolve = (uf: string, slug: string) => (uf === uf.toLowerCase() ? getCity(uf, slug) : undefined);

export async function generateMetadata({ params }: PageProps<"/[uf]/[slug]">): Promise<Metadata> {
  const { uf, slug } = await params;
  const c = resolve(uf, slug);
  if (!c) return { title: "Página não encontrada" };
  const d = cityYearData(c);
  const s = summary(d, d.points[YEARS.indexOf(d.initial)]);
  const title = `${c.name} (${c.uf})`;
  const description = `${s.verdict} Série 2008–${YEARS[YEARS.length - 1]}, comparação com vizinhos e modelos de pedido de informação.`;
  const url = cityPath(c.uf, c.slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · Radar MDE`, description, url, type: "website", locale: "pt_BR", siteName: "Radar MDE" },
    twitter: { card: "summary_large_image", title: `${title} · Radar MDE`, description },
  };
}

export default async function CityPage({ params }: PageProps<"/[uf]/[slug]">) {
  const { uf, slug } = await params;
  const c = resolve(uf, slug);
  // mixed-case URLs are redirected to lowercase in src/proxy.ts, before they reach the render cache
  if (!c) notFound();
  return <CityContent c={c} />;
}

/* ------------------------------------------------------------------ year data */

// Sorted MDE values per scope and year, computed once per process: ranks for 18 years × 5.570 pages stay cheap.
const sortedCache = new Map<string, number[]>();
function sorted(key: string, cities: () => City[], y: number) {
  const k = `${key}:${y}`;
  let v = sortedCache.get(k);
  if (!v) {
    v = cities()
      .map((x) => x.years[y]?.mde)
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    sortedCache.set(k, v);
  }
  return v;
}
function rankOf(v: number, arr: number[]): Rank {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < v) lo = m + 1;
    else hi = m;
  }
  const less = lo;
  hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= v) lo = m + 1;
    else hi = m;
  }
  const more = arr.length - lo;
  return { pos: more + 1, of: arr.length, less };
}

const dataCache = new Map<number, CityYearData>();
function cityYearData(c: City): CityYearData {
  const hit = dataCache.get(c.id);
  if (hit) return hit;
  const f = cityFacts(c);
  const trail = deficitTrail(c);
  const ufS = ufStats(c.uf);
  const brS = brStats();
  const state = citiesOf(c.uf);
  const single = state.length === 1;
  const points: YearPoint[] = YEARS.map((y, i) => {
    const r = c.years[y];
    const status = mdeStatus(r);
    const st: St = !existedIn(c, y)
      ? "na"
      : status === "notdelivered"
        ? "nd"
        : status === "nodata"
          ? "none"
          : status;
    const mde = r?.mde ?? null;
    // out-of-pattern flags come from the data build (own-history outliers / implausible values only)
    const atip = [...(r?.atip ?? [])];
    return {
      y,
      st,
      mde,
      fun: r?.fun ?? null,
      funMin: funMin(y),
      aluno: r?.perAluno ?? null,
      mdeV: r?.mdeV ?? null,
      mdeVEst: r?.mdeVEst === 1,
      src: r?.src ?? null,
      atip,
      impl: r?.atipImpl === 1,
      medUf: ufS[i]?.median ?? null,
      medBr: brS[i]?.median ?? null,
      rUf: mde != null && !single ? rankOf(mde, sorted(`uf:${c.uf}`, () => state, y)) : null,
      rBr: mde != null ? rankOf(mde, sorted("br", allCities, y)) : null,
      carry: Math.round(trail[i].carry),
      carryReal: Math.round(trail[i].carryReal ?? trail[i].carry),
    };
  });
  const d: CityYearData = {
    id: c.id,
    name: c.name,
    uf: c.uf,
    slug: c.slug,
    ufName: getUf(c.uf)!.name,
    ofUf: ofUf(c.uf),
    inUf: inUf(c.uf),
    single,
    since: c.since ?? null,
    balance: periodBalance(c),
    years: YEARS,
    initial: latestYear(c) ?? YEARS[YEARS.length - 1],
    points,
    stopped: f.stopped,
    firstBase: YEARS.find((y) => c.years[y]?.base != null) ?? null,
    shaky: f.shakyYears,
    peers:
      single || !c.imediata
        ? []
        : state
            .filter((p) => p.imediata === c.imediata)
            .map((p) => ({ name: p.name, slug: p.slug, v: YEARS.map((y) => p.years[y]?.mde ?? null) })),
    map: { ids: [], initial: [] },
  };
  const y0 = d.initial;
  d.map = {
    ids: state.map((p) => p.id),
    initial: state.map((p) => (!existedIn(p, y0) ? null : p.years[y0]?.s === "nd" ? -1 : (p.years[y0]?.mde ?? null))),
  };
  dataCache.set(c.id, d);
  return d;
}

/* ------------------------------------------------------------------ page */

function CityContent({ c }: { c: City }) {
  const u = getUf(c.uf)!;
  const ufName = u.name;
  const regionName = getRegion(u.region).name;
  const d = cityYearData(c);
  const f = cityFacts(c);
  const single = d.single;
  const trailAll = deficitTrail(c);
  const trail = trailAll.filter(({ year }) => existedIn(c, year));
  const hasAny = f.reported.length > 0;
  const ufMed = d.points.map((p) => p.medUf);
  const brMed = d.points.map((p) => p.medBr);

  const flags: ReactNode[] = [];
  if (f.below.length) {
    const comp = f.pandemic?.state === "compensated";
    flags.push(
      <>
        Aplicou menos de 25% em <Term k="mde">MDE</Term> {emAnos(f.below)}.
        {f.belowPandemic.length > 0 && (
          <>
            {" "}
            Para {listYears(f.belowPandemic)} vale a <Term k="ec119">EC 119/2022</Term>
            {comp
              ? ": pelos dados declarados, a diferença foi compensada até 2023."
              : f.pandemic?.state === "open"
                ? ": pelos dados declarados, a diferença não foi totalmente compensada até 2023."
                : "."}
          </>
        )}
      </>,
    );
  }
  if (f.carry > 0)
    flags.push(
      <>
        <Term k="deficit">Déficit</Term> estimado ainda não compensado: {brlShort(f.carry)} em R$ da época, ou{" "}
        {brlShort(trailAll[trailAll.length - 1].carryReal)} em R$ de {IPCA_BASE} corrigidos pelo IPCA
        {f.carryShaky ? `. A estimativa depende de valores fora do padrão em ${listYears(f.shakyYears)}: confirme na fonte` : ""}.
      </>,
    );
  if (f.funBelow.length) flags.push(<>Pagou aos profissionais menos que o mínimo do <Term k="fundeb">Fundeb</Term> {emAnos(f.funBelow.map((x) => x.year))}.</>);
  if (f.funLeft.length) flags.push(<>Deixou mais Fundeb sem usar do que a lei permite (5% até 2020, 10% depois) {emAnos(f.funLeft.map((x) => x.year))}.</>);
  if (f.diverge.length) flags.push(<>Percentual informado ao Tesouro diverge do <Term k="siope">SIOPE</Term> {emAnos(f.diverge)}: os relatórios oficiais não batem.</>);
  if (f.notDelivered.length) flags.push(<><Term k="nd">Não declarou</Term> dados de MDE {emAnos(f.notDelivered)}.</>);
  if (f.atypMde.length) flags.push(<>Percentual de MDE fora do padrão do próprio município {emAnos(f.atypMde)}: confirme na fonte.</>);
  if (f.atypAluno.length) flags.push(<>Valor por aluno fora do padrão do próprio município {emAnos(f.atypAluno)}: confirme na fonte.</>);
  if (f.edge.length >= 3) flags.push(<>Ficou “no limite” (25–26%) em {f.edge.length} anos: aplica o mínimo, quase nada além.</>);

  const who = `${c.name} (${c.uf})`;
  const span = `${YEARS[0]}–${YEARS[YEARS.length - 1]}`;
  // health (ASPS) only exists for some municipalities (SICONFI, mostly SP): hide the column when it's all empty
  const hasSau = cityHasHealth(c);
  const hasStaticCallouts = f.diverge.length > 0 || f.notDelivered.length > 0;
  const hasAtip = d.points.some((p) => p.atip.length > 0);

  return (
    <CityYearProvider data={d}>
      <PageHeader
        eyebrow={<Breadcrumbs uf={c.uf} city={c.name} />}
        title={
          <>
            {c.name}
            <span className="sr-only">
              {" "}
              ({single ? "Distrito Federal" : ufName}
              {c.capital && !single ? ", capital" : ""})
            </span>
            <span aria-hidden className="ml-2.5 inline-flex translate-y-[-3px] items-center gap-1.5 align-middle tracking-normal">
              <Badge variant="outline" className="font-mono text-[0.6875rem] text-muted-foreground">
                {c.uf}
              </Badge>
              {c.capital && <Badge variant="secondary">Capital</Badge>}
            </span>
          </>
        }
        description={<HeaderStatus belowCount={f.below.length} />}
        actions={
          <>
            <Button variant="outline" render={<a href="#agir" />} nativeButton={false} className="print:hidden">
              <MessageSquareText className="text-muted-foreground" />O que posso fazer?
            </Button>
            <WatchButton id={`${c.uf.toLowerCase()}/${c.slug}`} />
            <HeaderShare />
            <HeaderSource />
          </>
        }
      >
        <ul aria-label="Sobre o município" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
          <Meta>{c.pop.toLocaleString("pt-BR")} hab.</Meta>
          <Meta>{single ? `Região ${regionName}` : `${ufName}, Região ${regionName}`}</Meta>
          {c.imediata && !single && (
            <Meta>
              <Term k="imediata">Região imediata</Term> de {c.imediata}
            </Meta>
          )}
          <Meta>
            <span className="font-mono text-xs">IBGE {c.id}</span>
          </Meta>
        </ul>
      </PageHeader>

      <YearBar />

      <PageBody>
        {!hasAny ? (
          <EmptyState title="Sem dados de aplicação em educação" className="bg-card">
            {f.notDelivered.length
              ? `O município não declarou dados de MDE ao SIOPE/Tesouro ${emAnos(f.notDelivered)}${c.since ? ` (foi instalado em ${c.since})` : ""}. A falta de envio também é um sinal de alerta de transparência.`
              : "Os dados deste município ainda estão sendo coletados. Volte mais tarde."}
          </EmptyState>
        ) : (
          <>
            <YearKpis />
            <PeriodBalanceCard />

            {(hasStaticCallouts || hasAtip) && (
              <div className="grid gap-3 empty:hidden md:grid-cols-2">
                {hasAtip && <AtypicalCallout />}
                {f.diverge.length > 0 && (
                  <Callout title="SIOPE e Tesouro não batem">
                    Em {listYears(f.diverge)}, o percentual enviado ao Tesouro (SICONFI) difere em 1 p.p. ou mais do declarado ao SIOPE. O painel usa o SIOPE;
                    o valor do Tesouro aparece na tabela ano a ano.
                  </Callout>
                )}
                {f.notDelivered.length > 0 && (
                  <Callout title="Anos sem declaração">
                    O município não enviou dados de MDE {emAnos(f.notDelivered)}. A falta de envio também é um sinal de alerta de transparência.
                  </Callout>
                )}
              </div>
            )}

            <section className="grid gap-6 lg:grid-cols-3">
              <Panel
                className="lg:col-span-2"
                title={
                  <>
                    % da receita de impostos aplicado em educação (<Term k="mde">MDE</Term>)
                  </>
                }
                description={
                  <>
                    Série declarada ao <Term k="siope">SIOPE</Term>. A linha tracejada marca o mínimo constitucional de 25%; a faixa cinza, os anos da{" "}
                    <Term k="ec119">EC 119/2022</Term> (2020–2021).
                  </>
                }
                action={
                  <ChartActions
                    title={`% da receita de impostos aplicado em MDE — ${who}, ${span}`}
                    filename={[c.uf.toLowerCase(), c.slug, "mde"]}
                    legend={[
                      { label: c.name, color: "var(--series-1)" },
                      { label: "mínimo 25%", color: "var(--foreground)", dash: "4 4" },
                      ...(single ? [] : [{ label: `Mediana ${c.uf}`, color: "var(--series-2)", dash: "2 3" }]),
                      { label: "Mediana Brasil", color: "var(--ink)", dash: "2 3" },
                      ...(f.below.length ? [{ label: "abaixo de 25%", color: "var(--critical)", kind: "dot" as const }] : []),
                      ...(f.atypMde.length ? [{ label: `fora do padrão (${listYears(f.atypMde)})`, color: "var(--warning)", kind: "ring" as const }] : []),
                    ]}
                    note={`Linha tracejada: mínimo de 25%. Medianas: ${single ? "" : `${c.uf} e `}Brasil.`}
                    csv={{
                      columns: ["ano", "mde_pct", "fora_do_padrao", ...(single ? [] : ["mediana_uf_pct"]), "mediana_brasil_pct", "minimo_pct"],
                      rows: YEARS.map((y, i) => ({
                        ano: y,
                        mde_pct: c.years[y]?.mde ?? null,
                        fora_do_padrao: f.atypMde.includes(y) ? 1 : 0,
                        ...(single ? {} : { mediana_uf_pct: ufMed[i] }),
                        mediana_brasil_pct: brMed[i],
                        minimo_pct: MDE_MIN,
                      })),
                    }}
                  />
                }
              >
                <TrendChart
                  points={YEARS.map((y) => ({ year: y, value: c.years[y]?.mde ?? null, min: MDE_MIN }))}
                  label={c.name}
                  thresholdLabel="mínimo 25%"
                  flagged={f.atypMde}
                  height={260}
                  band={{ from: 2020, to: 2021, label: "EC 119" }}
                  refs={[
                    ...(single ? [] : [{ label: `Mediana ${c.uf}`, color: "var(--series-2)", values: ufMed }]),
                    { label: "Mediana Brasil", color: "var(--ink)", values: brMed },
                  ]}
                />
              </Panel>
              <RankPanel />
            </section>
          </>
        )}

        {!single && (
          <section className="grid gap-6 lg:grid-cols-5">
            <MapPanel />
            <PeersPanel imediata={c.imediata} />
          </section>
        )}

        {hasAny && (
          <section className={cn("grid gap-6", !single && "lg:grid-cols-5")}>
            <Panel className={single ? undefined : "lg:col-span-2"} title="Sinais de alerta" description="Tudo o que os dados declarados indicam, em toda a série.">
              {flags.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <StatusDot kind="ok" /> Nenhum sinal de alerta nos dados declarados.
                </div>
              ) : (
                <ul className="space-y-2.5 text-sm leading-6">
                  {flags.map((x, i) => (
                    <li key={i} className="flex gap-2.5">
                      <CircleAlert aria-hidden className="mt-1 size-4 shrink-0 text-critical" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            {!single && <DistributionPanel />}
          </section>
        )}

        <Panel
          id="agir"
          className="scroll-mt-28 print:hidden"
          title="O que você pode fazer"
          description={
            <>
              Dados só mudam algo quando chegam a quem fiscaliza. Escolha o que quer fazer: o texto já vem preenchido com os números de {c.name}. Revise,
              coloque seu nome e envie: um pedido pelo <Term k="esic">e-SIC</Term>, um aviso ao <Term k="cacs">CACS-Fundeb</Term>, um requerimento na Câmara ou
              uma comunicação ao <span className="whitespace-nowrap"><Term k="tc">Tribunal de Contas</Term>.</span> Qualquer pessoa tem direito a essas informações.
            </>
          }
          divided
          bodyClassName="p-0"
        >
          <ActionKit templates={buildTemplates(c)} />
        </Panel>

        {hasAny && (
          <>
            <section className="grid gap-6 lg:grid-cols-2">
              <Panel
                title={
                  <>
                    % do <Term k="fundeb">Fundeb</Term> pago aos profissionais da educação
                  </>
                }
                description="Mínimo de 60% (magistério) até 2020; 70% (profissionais) desde 2021. Pode passar de 100% quando a prefeitura usa saldo de anos anteriores."
                action={
                  <ChartActions
                    title={`% do Fundeb pago aos profissionais da educação — ${who}, ${span}`}
                    filename={[c.uf.toLowerCase(), c.slug, "fundeb"]}
                    legend={[
                      { label: `${c.name} — Fundeb`, color: "var(--series-1)" },
                      { label: "mínimo legal", color: "var(--foreground)", dash: "4 4" },
                    ]}
                    note="Mínimo legal: 60% até 2020; 70% desde 2021."
                    csv={{
                      columns: ["ano", "fundeb_profissionais_pct", "minimo_pct"],
                      rows: YEARS.map((y) => ({ ano: y, fundeb_profissionais_pct: c.years[y]?.fun ?? null, minimo_pct: funMin(y) })),
                    }}
                  />
                }
              >
                <TrendChart points={YEARS.map((y) => ({ year: y, value: c.years[y]?.fun ?? null, min: funMin(y) }))} label="Fundeb" thresholdLabel="mínimo legal" />
              </Panel>
              <Panel
                title="Investimento por aluno (R$/ano)"
                description="Valores nominais (R$ da época) declarados ao SIOPE, sem correção pela inflação."
                action={
                  <ChartActions
                    title={`Investimento por aluno (R$/ano, nominal) — ${who}, ${span}`}
                    filename={[c.uf.toLowerCase(), c.slug, "por-aluno"]}
                    legend={[
                      { label: `${c.name} — por aluno`, color: "var(--series-1)" },
                      ...(f.atypAluno.length ? [{ label: `fora do padrão (${listYears(f.atypAluno)})`, color: "var(--warning)", kind: "ring" as const }] : []),
                    ]}
                    note="Valores nominais, sem correção pela inflação."
                    csv={{
                      columns: ["ano", "por_aluno_rs", "fora_do_padrao"],
                      rows: YEARS.map((y) => ({ ano: y, por_aluno_rs: c.years[y]?.perAluno ?? null, fora_do_padrao: f.atypAluno.includes(y) ? 1 : 0 })),
                    }}
                  />
                }
              >
                <TrendChart points={YEARS.map((y) => ({ year: y, value: c.years[y]?.perAluno ?? null }))} label="Por aluno" unit="R$" flagged={f.atypAluno} />
              </Panel>
            </section>

            {c.id === THESIS_SANTO_ANDRE_ID && <ThesisComparison c={c} />}

            <Panel
              title="Ano a ano"
              description="Todos os valores declarados, do mais recente ao mais antigo. A coluna Fonte leva aos dados brutos (JSON) no sistema oficial."
              divided
              bodyClassName="p-0"
              footer={
                <>
                  Valores em R$ da época, sem correção pela inflação. “≈” = estimado pelo Radar (receita × %), não declarado. “Fundeb não usado”: parcela
                  do Fundeb que ficou para o ano seguinte (máximo 5% até 2020 e 10% desde 2021). “Saldo devedor” é uma estimativa: soma o que faltou para 25%
                  em cada ano e abate o que foi aplicado acima de 25% nos anos seguintes. * Em 2020–2021, a <Term k="ec119">EC 119/2022</Term> afastou a
                  punição desde que a diferença fosse compensada até 2023.
                  {c.since ? ` O município foi instalado em ${c.since}.` : ""}
                </>
              }
            >
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap tnum">
                  <caption className="sr-only">Indicadores de {c.name} por ano, do mais recente ao mais antigo</caption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent [&>th]:h-10 [&>th]:px-3 [&>th]:text-right [&>th]:text-[0.8125rem] [&>th]:font-medium [&>th]:text-muted-foreground">
                      <TableHead scope="col" className="pl-4! text-left! sm:pl-5!">Ano</TableHead>
                      <TableHead scope="col">MDE</TableHead>
                      <TableHead scope="col">Aplicado</TableHead>
                      <TableHead scope="col">Receita de impostos</TableHead>
                      <TableHead scope="col">Faltou</TableHead>
                      <TableHead scope="col">Saldo devedor</TableHead>
                      <TableHead scope="col">Fundeb salários</TableHead>
                      <TableHead scope="col">Fundeb não usado</TableHead>
                      <TableHead scope="col">Por aluno</TableHead>
                      {hasSau && <TableHead scope="col">Saúde</TableHead>}
                      <TableHead scope="col" className="pr-4! text-left! sm:pr-5!">Fonte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...trail].reverse().map(({ year, rec, shortfall, carry }) => {
                      const st = mdeStatus(rec);
                      const atipMde = !!rec?.atip?.includes("mde");
                      const atipAluno = !!rec?.atip?.includes("aluno");
                      const shaky = !!rec?.atip?.includes("base");
                      return (
                        <TableRow key={year} className="text-right hover:bg-accent/60 [&>td]:px-3 [&>td]:py-2">
                          <TableHead scope="row" className="h-auto pl-4! text-left font-medium text-foreground sm:pl-5!">
                            {year}
                            {PANDEMIC_YEARS.has(year) && (
                              <span title="EC 119/2022: anos da pandemia" className="ml-0.5 text-xs text-muted-foreground">
                                *
                              </span>
                            )}
                          </TableHead>
                          <TableCell className={st === "below" ? "font-medium text-critical-ink" : undefined}>
                            <span className="inline-flex items-center gap-1.5">
                              {atipMde && <Warn label="Valor fora do padrão do município: confira na fonte" />}
                              {st === "notdelivered" ? <span className="text-critical-ink">não declarou</span> : pct(rec?.mde)}
                            </span>
                            {rec?.alt != null && (
                              <div className="text-xs font-normal text-muted-foreground" title="O relatório enviado ao Tesouro (SICONFI) traz outro percentual">
                                Tesouro: {pct(rec.alt)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {rec?.mdeV ? (
                              <span title={rec.mdeVEst ? "Estimado pelo Radar: receita × %" : undefined}>
                                {rec.mdeVEst ? "≈ " : ""}
                                {brlShort(rec.mdeV)}
                              </span>
                            ) : (
                              <Dash />
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              {shaky && <Warn label="Receita muito diferente dos anos vizinhos: o valor que faltou pode estar errado" />}
                              {rec?.base ? brlShort(rec.base) : <Dash />}
                            </span>
                          </TableCell>
                          <TableCell className={shortfall > 0 ? "text-critical-ink" : undefined}>{shortfall > 0 ? brlShort(shortfall) : <Dash />}</TableCell>
                          <TableCell className={carry > 0 ? "text-critical-ink" : undefined}>{carry > 0 ? brlShort(carry) : <Dash />}</TableCell>
                          <TableCell className={rec?.fun != null && rec.fun < funMin(year) ? "text-critical-ink" : undefined}>{pct(rec?.fun)}</TableCell>
                          <TableCell className={rec?.funLeft != null && rec.funLeft > fundebLeftMax(year) ? "text-critical-ink" : undefined}>{pct(rec?.funLeft)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              {atipAluno && <Warn label="Valor por aluno fora do padrão do município: confira na fonte" />}
                              {rec?.perAluno ? brl(rec.perAluno) : <Dash />}
                            </span>
                          </TableCell>
                          {hasSau && <TableCell>{pct(rec?.sau)}</TableCell>}
                          <TableCell className="pr-4! text-left sm:pr-5!">
                            {rec?.src === "siope" ? (
                              <SourceLink href={siopeUrl(c.id, c.uf, year)} label={`Dados brutos de ${year} no SIOPE (JSON, abre em nova aba)`}>
                                SIOPE
                              </SourceLink>
                            ) : rec?.src === "siconfi" ? (
                              <SourceLink href={siconfiUrl(c.id, year)} label={`Dados brutos de ${year} no Tesouro/SICONFI (JSON, abre em nova aba)`}>
                                Tesouro
                              </SourceLink>
                            ) : (
                              <span className="text-muted-foreground">{st === "notdelivered" ? "—" : "sem dados"}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </PageBody>
    </CityYearProvider>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 tnum after:text-muted-foreground/40 after:content-['·'] last:after:content-none">
      <span>{children}</span>
    </li>
  );
}

function Callout({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border bg-muted/50 px-3.5 py-3 text-[0.8125rem] leading-5 text-muted-foreground">
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Info aria-hidden />}</span>
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

const Dash = () => <span className="text-muted-foreground">—</span>;

function Warn({ label }: { label: string }) {
  return (
    <TriangleAlert role="img" aria-label={label} className="size-3.5 shrink-0 text-warning">
      <title>{label}</title>
    </TriangleAlert>
  );
}

function SourceLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="inline-flex min-h-6 items-center gap-1 text-brand-ink hover:underline">
      {children}
      <ExternalLink aria-hidden className="size-3" />
    </a>
  );
}

/** Santo André only: the thesis' audited (TCE-SP) series next to what the city declared to SIOPE. */
function ThesisComparison({ c }: { c: City }) {
  const years = Object.keys(THESIS_SANTO_ANDRE).map(Number);
  const tceBelow = years.filter((y) => (THESIS_SANTO_ANDRE[y].mde ?? 99) < MDE_MIN);
  const both = years.filter((y) => THESIS_SANTO_ANDRE[y].mde != null && c.years[y]?.mde != null);
  const disagree = both.filter((y) => THESIS_SANTO_ANDRE[y].mde! < MDE_MIN !== c.years[y]!.mde! < MDE_MIN);
  // Same carry-over logic as the panel, run on each series up to the thesis' last year
  const carryUntil = (pctOf: (y: number) => number | undefined) =>
    both.reduce((carry, y) => {
      const v = pctOf(y);
      const base = c.years[y]?.base;
      return v == null || base == null ? carry : Math.max(0, carry + ((MDE_MIN - v) / 100) * base);
    }, 0);
  const lastY = both[both.length - 1];
  const carryTce = carryUntil((y) => THESIS_SANTO_ANDRE[y].mde);
  const carryDecl = carryUntil((y) => c.years[y]?.mde);
  return (
    <Panel
      id="tese"
      title="Comparação com a pesquisa"
      description={
        <>
          Tese de Adriana Zanini da Silva (UNINOVE, 2021), que usou a apuração do TCE-SP.{" "}
          <a href={THESIS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-ink hover:underline">
            Ler a tese <ExternalLink className="size-3" />
          </a>
        </>
      }
      action={<Badge variant="outline" className="text-muted-foreground">Santo André</Badge>}
      divided
      bodyClassName="p-0"
      footer="Fontes da tese: Figura 42 (TCE-SP, 2020) e Figura 40 (MEC/Inep, 2020). Diferença = declarado − apurado. Valores em R$ da época."
    >
      <div className="grid grid-cols-1 divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Mini label="Anos abaixo de 25% (TCE)" value={tceBelow.join(", ") || "nenhum"} tone={tceBelow.length ? "bad" : undefined} />
        <Mini
          label={`Fontes concordam sobre os 25%`}
          value={`${both.length - disagree.length} de ${both.length} anos`}
          sub={disagree.length ? `divergem em ${disagree.join(", ")}` : undefined}
        />
        <Mini
          label={`Saldo devedor ao fim de ${lastY}`}
          value={`${brlShort(carryTce)} · ${brlShort(carryDecl)}`}
          sub="pelos números do TCE · pelos declarados"
          tone={carryTce > 0 || carryDecl > 0 ? "bad" : undefined}
        />
      </div>
      <p className="max-w-4xl px-4 py-4 text-[0.8125rem] leading-6 text-muted-foreground sm:px-5">
        A tese encontrou aplicação abaixo de 25% em {tceBelow.join(", ")}, sem compensação posterior suficiente. O painel mostra o que o município{" "}
        <em>declarou</em> ao SIOPE. Quando o declarado é maior, em geral o Tribunal não aceitou parte dos gastos como educação; quando é menor, a
        apuração final do TCE considerou valores diferentes dos enviados ao SIOPE. Nos {both.length} anos comparáveis, as duas fontes concordam sobre
        cumprir ou não os 25% em {both.length - disagree.length}
        {disagree.length > 0 && (
          <>
            {" "}e divergem em <strong className="font-medium text-foreground">{disagree.join(", ")}</strong>
          </>
        )}
        . Os percentuais do Fundeb vêm do próprio SIOPE na tese e coincidem com o painel. Saldo devedor estimado ao fim de {lastY}:{" "}
        <strong className="font-medium text-foreground">{brlShort(carryTce)}</strong> pelos números do TCE e{" "}
        <strong className="font-medium text-foreground">{brlShort(carryDecl)}</strong> pelos declarados
        {carryTce > 0 && carryDecl > 0 ? " — nas duas fontes, a falta de compensação apontada na tese se confirma." : "."}
      </p>
      <div className="scroll-thin overflow-x-auto border-t">
        <table className="w-full text-sm whitespace-nowrap tnum">
          <caption className="sr-only">MDE apurado pelo TCE-SP na tese e declarado ao SIOPE, por ano</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent [&>th]:h-10 [&>th]:px-3 [&>th]:text-right [&>th]:text-[0.8125rem] [&>th]:font-medium [&>th]:text-muted-foreground">
              <TableHead scope="col" className="pl-4! text-left! sm:pl-5!">Ano</TableHead>
              <TableHead scope="col">MDE apurado pelo TCE (tese)</TableHead>
              <TableHead scope="col">MDE declarado (SIOPE)</TableHead>
              <TableHead scope="col">Diferença</TableHead>
              <TableHead scope="col">Fundeb salários (tese)</TableHead>
              <TableHead scope="col" className="pr-4! sm:pr-5!">Fundeb salários (SIOPE)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((y) => {
              const t = THESIS_SANTO_ANDRE[y];
              const r = c.years[y];
              const dv = t.mde != null && r?.mde != null ? r.mde - t.mde : null;
              const split = t.mde != null && r?.mde != null && t.mde < MDE_MIN !== r.mde < MDE_MIN;
              return (
                <TableRow key={y} className={cn("text-right hover:bg-accent/60 [&>td]:px-3 [&>td]:py-2", split && "bg-warning-soft/60")}>
                  <TableCell className="pl-4! text-left font-medium sm:pl-5!">
                    {y}
                    {split && (
                      <span className="ml-2 align-middle">
                        <StatusBadge kind="edge" dot={false}>
                          divergem
                        </StatusBadge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={t.mde != null && t.mde < MDE_MIN ? "font-medium text-critical-ink" : undefined}>{pct(t.mde)}</TableCell>
                  <TableCell className={r?.mde != null && r.mde < MDE_MIN ? "font-medium text-critical-ink" : undefined}>{pct(r?.mde)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dv == null ? "—" : Math.abs(dv) < 0.005 ? "igual" : `${dv > 0 ? "+" : "−"}${Math.abs(dv).toFixed(2).replace(".", ",")} p.p.`}
                  </TableCell>
                  <TableCell>{pct(t.fun)}</TableCell>
                  <TableCell className="pr-4! sm:pr-5!">{pct(r?.fun)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </Panel>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="text-[0.8125rem] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-[1.0625rem] font-semibold tracking-[-0.02em] tnum", tone === "bad" && "text-critical-ink")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
