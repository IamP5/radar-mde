import { CircleAlert, ExternalLink, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import ActionKit from "@/components/ActionKit";
import Breadcrumbs from "@/components/Breadcrumbs";
import CityMap, { type CityMapValue } from "@/components/CityMap";
import Histogram from "@/components/Histogram";
import ShareButton from "@/components/ShareButton";
import TrendChart from "@/components/TrendChart";
import WatchButton from "@/components/WatchButton";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { EmptyState, Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { StatusBadge, StatusDot, type StatusKind } from "@/components/kit/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MDE_MIN,
  PANDEMIC_YEARS,
  STATUS_LABEL,
  YEARS,
  fundebLeftMax,
  brl,
  brStats,
  brlShort,
  allCities,
  citiesOf,
  deficitTrail,
  funMin,
  getCity,
  isAtypical,
  latestYear,
  mdeStatus,
  pct,
  rankIn,
  siconfiUrl,
  siopeUrl,
  ufStats,
  yearsBelow,
  type City,
  type Status,
} from "@/lib/data";
import { cityPath, getRegion, getUf, ofUf } from "@/lib/geo";
import { buildTemplates } from "@/lib/templates";
import { THESIS_SANTO_ANDRE, THESIS_SANTO_ANDRE_ID, THESIS_URL } from "@/lib/thesis";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return allCities().map((c) => ({ uf: c.uf.toLowerCase(), slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[uf]/[slug]">): Promise<Metadata> {
  const { uf, slug } = await params;
  const c = getCity(uf, slug);
  if (!c) return {};
  const ly = latestYear(c);
  return {
    title: `${c.name} (${c.uf})`,
    description: ly
      ? `${c.name} aplicou ${pct(c.years[ly]!.mde)} da receita de impostos em educação em ${ly}. Veja a série histórica.`
      : `Aplicação em educação de ${c.name}.`,
  };
}

export default function CityPage({ params }: PageProps<"/[uf]/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto my-8 h-96 max-w-7xl animate-pulse rounded-xl bg-muted" aria-label="Carregando" />}>
      <CityContent params={params} />
    </Suspense>
  );
}

const KIND: Record<Status, StatusKind> = { below: "below", edge: "edge", ok: "ok", nodata: "nd", notdelivered: "below" };
const pp = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;

async function CityContent({ params }: { params: Promise<{ uf: string; slug: string }> }) {
  const { uf, slug } = await params;
  const c = uf === uf.toLowerCase() ? getCity(uf, slug) : undefined;
  if (!c) notFound();
  const ufName = getUf(c.uf)!.name;
  const regionName = getRegion(getUf(c.uf)!.region).name;
  // Distrito Federal: Brasília is the only "municipality", so state-level comparisons don't apply
  const single = citiesOf(c.uf).length === 1;

  const ly = latestYear(c);
  const lr = ly ? c.years[ly]! : undefined;
  const lyi = ly ? YEARS.indexOf(ly) : -1;
  const below = yearsBelow(c);
  const trail = deficitTrail(c);
  const carry = trail[trail.length - 1].carry;
  const firstBase = YEARS.find((y) => c.years[y]?.base != null);
  const belowNoBase = below.filter((y) => c.years[y]?.base == null);
  const hasAny = YEARS.some((y) => c.years[y]?.mde != null);
  const notDelivered = YEARS.filter((y) => c.years[y]?.s === "nd");
  const lastYear = YEARS[YEARS.length - 1];
  const missingLast = ly !== lastYear && c.years[lastYear]?.s === "nd";

  const peers = citiesOf(c.uf)
    .filter((p) => p.imediata === c.imediata && ly && p.years[ly]?.mde != null)
    .map((p) => ({ name: p.name, slug: p.slug, v: p.years[ly!]!.mde! }))
    .sort((a, b) => a.v - b.v);

  const mapValues: CityMapValue[] = citiesOf(c.uf).map((p) => {
    const r = ly ? p.years[ly] : undefined;
    return [p.id, r?.mde ?? null, r?.s === "nd" ? 1 : 0];
  });

  const status = mdeStatus(lr);
  const rankUf = ly ? rankIn(c, { level: "uf", uf: c.uf }, ly) : null;
  const rankBr = ly ? rankIn(c, { level: "br" }, ly) : null;
  const ufMed = ufStats(c.uf).map((s) => s.median);
  const brMed = brStats().map((s) => s.median);
  const ufDist = ly ? citiesOf(c.uf).map((x) => x.years[ly]?.mde).filter((v): v is number => v != null) : [];
  const prevY = ly ? [...YEARS].reverse().find((y) => y < ly && c.years[y]?.mde != null) : undefined;
  const dMde = prevY != null && lr?.mde != null ? lr.mde - c.years[prevY]!.mde! : null;

  const flags: string[] = [];
  if (below.length) flags.push(`Aplicou menos de 25% em MDE em ${below.join(", ")}.`);
  if (carry > 0) flags.push(`Déficit estimado ainda não compensado: ${brlShort(carry)}.`);
  const funBelow = YEARS.filter((y) => c.years[y]?.fun != null && c.years[y]!.fun! < funMin(y));
  if (funBelow.length) flags.push(`Pagou aos profissionais menos que o mínimo do Fundeb em ${funBelow.join(", ")}.`);
  const left = YEARS.filter((y) => (c.years[y]?.funLeft ?? 0) > fundebLeftMax(y));
  if (left.length) flags.push(`Deixou mais Fundeb sem usar do que a lei permite (5% até 2020, 10% depois) em ${left.join(", ")}.`);
  const div = YEARS.filter((y) => c.years[y]?.alt != null);
  if (div.length) flags.push(`Percentual informado ao Tesouro diverge do SIOPE em ${div.join(", ")}: os relatórios oficiais não batem.`);
  if (notDelivered.length) flags.push(`Não declarou dados de MDE em ${notDelivered.join(", ")}.`);
  const edge = YEARS.filter((y) => mdeStatus(c.years[y]) === "edge");
  if (edge.length >= 3) flags.push(`Ficou “no limite” (25–26%) em ${edge.length} anos: aplica o mínimo, quase nada além.`);
  const verdict = !lr
    ? "Ainda não há dados de MDE para este município."
    : status === "below"
      ? `Em ${ly}, aplicou ${pct(lr.mde)} — abaixo do mínimo de ${MDE_MIN}%.`
      : status === "edge"
        ? `Em ${ly}, aplicou ${pct(lr.mde)} — cumpriu, mas no limite.`
        : `Em ${ly}, aplicou ${pct(lr.mde)} — acima do mínimo de ${MDE_MIN}%.`;
  const badge = !lr
    ? "Sem dados"
    : status === "below"
      ? `Abaixo de 25% em ${ly}`
      : status === "edge"
        ? `No limite em ${ly}`
        : `Cumpre 25% em ${ly}`;
  const sourceHref = ly && lr ? (lr.src === "siconfi" ? siconfiUrl(c.id, ly) : siopeUrl(c.id, c.uf, ly)) : null;

  return (
    <>
      <PageHeader
        eyebrow={<Breadcrumbs uf={c.uf} city={c.name} />}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span>{c.name}</span>
            <span className="inline-flex items-center gap-1.5 tracking-normal">
              <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">{c.uf}</Badge>
              {c.capital && <Badge variant="secondary">Capital</Badge>}
            </span>
          </span>
        }
        description={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind={KIND[status]}>{badge}</StatusBadge>
              {missingLast && <StatusBadge kind="below">Não declarou {lastYear}</StatusBadge>}
              {below.length > 0 && (
                <span className="text-[13px] text-muted-foreground">
                  Abaixo dos 25% em <span className="font-medium text-critical">{below.length} {below.length === 1 ? "ano" : "anos"}</span>
                </span>
              )}
            </div>
            <p className="text-foreground">{verdict}</p>
          </div>
        }
        actions={
          <>
            <WatchButton id={`${c.uf.toLowerCase()}/${c.slug}`} />
            <ShareButton text={`${c.name} (${c.uf}): ${verdict} Veja no Radar MDE:`} path={cityPath(c.uf, c.slug)} />
            {sourceHref && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                render={<a href={sourceHref} target="_blank" rel="noreferrer" title={`Dados de ${ly} na fonte oficial`} />}
                nativeButton={false}
              >
                {lr?.src === "siconfi" ? "Tesouro" : "SIOPE"} <ExternalLink className="size-3.5" />
              </Button>
            )}
          </>
        }
      >
        <dl className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <Meta label="População">{c.pop.toLocaleString("pt-BR")} hab.</Meta>
          <Meta label="Localização">{single ? `Região ${regionName}` : `${ufName}, Região ${regionName}`}</Meta>
          {c.imediata && !single && <Meta label="Região imediata">região imediata {c.imediata}</Meta>}
          <Meta label="Código IBGE"><span className="font-mono text-xs">IBGE {c.id}</span></Meta>
        </dl>
      </PageHeader>

      <PageBody>
        {!hasAny ? (
          <EmptyState title="Sem dados de aplicação em educação" className="bg-card">
            {notDelivered.length
              ? `O município não declarou dados de MDE ao SIOPE/Tesouro em ${notDelivered.join(", ")}. A falta de envio também é um sinal de alerta de transparência.`
              : "Os dados deste município ainda estão sendo coletados. Volte mais tarde."}
          </EmptyState>
        ) : (
          <>
            <section aria-label={`Indicadores de ${ly}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label={`MDE ${ly}`}
                value={pct(lr?.mde)}
                tone={status === "below" ? "bad" : "neutral"}
                delta={dMde != null ? `${pp(dMde)} vs ${prevY}` : undefined}
                deltaTone={dMde == null || Math.abs(dMde) < 0.05 ? "neutral" : dMde > 0 ? "good" : "bad"}
                sub={`mínimo ${MDE_MIN}% da receita de impostos`}
                context={lyi >= 0 && brMed[lyi] != null ? `Mediana ${single ? "" : `${c.uf} ${pct(ufMed[lyi], 1)} · `}Brasil ${pct(brMed[lyi], 1)}` : undefined}
              />
              <Stat
                label={`Fundeb em salários ${ly}`}
                value={pct(lr?.fun)}
                sub={`mínimo ${funMin(ly!)}%`}
                tone={lr?.fun != null && lr.fun < funMin(ly!) ? "bad" : "neutral"}
              />
              <Stat
                label={`Por aluno ${ly}`}
                value={lr?.perAluno ? brl(lr.perAluno) : "—"}
                sub={lr?.mdeV ? `${brlShort(lr.mdeV)} aplicados em MDE` : "por ano, educação básica"}
              />
              <Stat
                label="Déficit não compensado"
                value={firstBase == null ? "—" : carry > 0 ? brlShort(carry) : "R$ 0"}
                tone={carry > 0 ? "bad" : "neutral"}
                sub={
                  firstBase == null
                    ? "sem receita declarada para estimar"
                    : `estimativa acumulada desde ${firstBase}${belowNoBase.length ? ` · sem base em ${belowNoBase.join(", ")}` : ""}`
                }
              />
            </section>

            {(isAtypical(lr?.mde) || div.length > 0 || notDelivered.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {isAtypical(lr?.mde) && (
                  <Callout icon={<TriangleAlert className="text-warning" />} title="Valor atípico">
                    Percentuais muito distantes da faixa usual (25–40%) às vezes indicam erro de preenchimento no relatório. Confira na fonte
                    (coluna “Fonte” da tabela ano a ano) e, se for o caso, peça esclarecimento à prefeitura com os modelos abaixo.
                  </Callout>
                )}
                {div.length > 0 && (
                  <Callout title="SIOPE e Tesouro não batem">
                    Em {div.join(", ")}, o percentual enviado ao Tesouro (SICONFI) difere em 1 p.p. ou mais do declarado ao SIOPE. O painel usa o SIOPE;
                    o valor do Tesouro aparece na tabela ano a ano.
                  </Callout>
                )}
                {notDelivered.length > 0 && (
                  <Callout title="Anos sem declaração">
                    O município não enviou dados de MDE em {notDelivered.join(", ")}. A falta de envio também é um sinal de alerta de transparência.
                  </Callout>
                )}
              </div>
            )}

            <section className="grid gap-6 lg:grid-cols-3">
              <Panel
                className="lg:col-span-2"
                title="% da receita de impostos aplicado em educação (MDE)"
                description="Série declarada ao SIOPE. A linha tracejada marca o mínimo constitucional de 25%."
              >
                <TrendChart
                  points={YEARS.map((y) => ({ year: y, value: c.years[y]?.mde ?? null, min: MDE_MIN }))}
                  label={c.name}
                  thresholdLabel="mínimo 25%"
                  height={260}
                  refs={[
                    ...(single ? [] : [{ label: `Mediana ${c.uf}`, color: "var(--series-2)", values: ufMed }]),
                    { label: "Mediana Brasil", color: "var(--ink)", values: brMed },
                  ]}
                />
              </Panel>
              <Panel title={`Posição em ${ly}`} description="Ranking pelo % aplicado em MDE (1º = quem mais aplicou).">
                <div className="space-y-5 pt-1">
                  {rankUf && !single && (
                    <Rank scope={`Entre os municípios ${ofUf(c.uf)}`} pos={rankUf.pos} of={rankUf.of} />
                  )}
                  {rankBr && <Rank scope="Entre os municípios do Brasil" pos={rankBr.pos} of={rankBr.of} />}
                  {lr?.mde != null && lyi >= 0 && (
                    <dl className="divide-y rounded-lg border text-[13px]">
                      {!single && ufMed[lyi] != null && (
                        <Compare label={`Mediana ${c.uf}`} value={ufMed[lyi]!} diff={lr.mde - ufMed[lyi]!} />
                      )}
                      {brMed[lyi] != null && <Compare label="Mediana Brasil" value={brMed[lyi]!} diff={lr.mde - brMed[lyi]!} />}
                      <Compare label="Mínimo legal" value={MDE_MIN} diff={lr.mde - MDE_MIN} />
                    </dl>
                  )}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title="% do Fundeb pago aos profissionais da educação" description="Mínimo de 60% (magistério) até 2020; 70% (profissionais) desde 2021.">
                <TrendChart
                  points={YEARS.map((y) => ({ year: y, value: c.years[y]?.fun ?? null, min: funMin(y) }))}
                  label="Fundeb"
                  thresholdLabel="mínimo legal"
                />
              </Panel>
              <Panel title="Investimento por aluno (R$/ano)" description="Valores nominais declarados ao SIOPE, sem correção pela inflação.">
                <TrendChart points={YEARS.map((y) => ({ year: y, value: c.years[y]?.perAluno ?? null }))} label="Por aluno" unit="R$" />
              </Panel>
            </section>

            <section className={cn("grid gap-6", ufDist.length > 1 && lr?.mde != null && "lg:grid-cols-5")}>
              {ly && ufDist.length > 1 && lr?.mde != null && (
                <Panel
                  className="lg:col-span-3"
                  title={`${c.name} entre os ${ufDist.length.toLocaleString("pt-BR")} municípios ${ofUf(c.uf)}`}
                  description={`Quantos municípios do estado aplicaram cada percentual em MDE em ${ly}; a marca indica ${c.name}.`}
                >
                  <Histogram values={ufDist} mark={{ value: lr.mde, label: c.name }} height={220} ariaLabel={`Distribuição do MDE em ${ufName}, ${ly}, com ${c.name} destacado`} />
                </Panel>
              )}
              <Panel
                className={ufDist.length > 1 && lr?.mde != null ? "lg:col-span-2" : undefined}
                title="Sinais de alerta"
                description="Tudo o que os dados declarados indicam, em toda a série."
              >
                {flags.length === 0 ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <StatusDot kind="ok" /> Nenhum sinal de alerta nos dados declarados.
                  </div>
                ) : (
                  <ul className="space-y-2.5 text-sm leading-6">
                    {flags.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <CircleAlert aria-hidden className="mt-1 size-4 shrink-0 text-critical" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>

            {c.id === THESIS_SANTO_ANDRE_ID && <ThesisComparison c={c} />}

            <Panel
              title="Ano a ano"
              description="Todos os valores declarados, do mais recente ao mais antigo. A coluna Fonte leva ao dado original."
              divided
              bodyClassName="p-0"
              footer={
                <>
                  “Fundeb não usado”: parcela do Fundeb que ficou para o ano seguinte (máximo 5% até 2020 e 10% desde 2021). “Saldo devedor” é uma
                  estimativa: soma o que faltou para 25% em cada ano e abate o que foi aplicado acima de 25% nos anos seguintes. * Em 2020–2021, a EC
                  119/2022 afastou a punição desde que a diferença fosse compensada até 2023.
                </>
              }
            >
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap tnum">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent [&>th]:h-10 [&>th]:px-3 [&>th]:text-right [&>th]:text-[13px] [&>th]:font-medium [&>th]:text-muted-foreground">
                      <TableHead scope="col" className="pl-4! text-left! sm:pl-5!">Ano</TableHead>
                      <TableHead scope="col">MDE</TableHead>
                      <TableHead scope="col">Aplicado</TableHead>
                      <TableHead scope="col">Receita de impostos</TableHead>
                      <TableHead scope="col">Faltou</TableHead>
                      <TableHead scope="col">Saldo devedor</TableHead>
                      <TableHead scope="col">Fundeb salários</TableHead>
                      <TableHead scope="col">Fundeb não usado</TableHead>
                      <TableHead scope="col">Por aluno</TableHead>
                      <TableHead scope="col">Saúde</TableHead>
                      <TableHead scope="col" className="pr-4! text-left! sm:pr-5!">Fonte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...trail].reverse().map(({ year, rec, shortfall, carry }) => {
                      const st = mdeStatus(rec);
                      return (
                        <TableRow key={year} className="text-right hover:bg-accent/60 [&>td]:px-3 [&>td]:py-2">
                          <TableCell className="pl-4! text-left font-medium sm:pl-5!">
                            {year}
                            {PANDEMIC_YEARS.has(year) && <span title="EC 119/2022: anos da pandemia" className="ml-0.5 text-xs text-muted-foreground">*</span>}
                          </TableCell>
                          <TableCell className={st === "below" ? "font-medium text-critical" : undefined}>
                            <span className="inline-flex items-center gap-1.5">
                              {isAtypical(rec?.mde) && (
                                <TriangleAlert aria-label="Valor atípico: confira na fonte" className="size-3.5 text-warning">
                                  <title>Valor atípico: confira na fonte</title>
                                </TriangleAlert>
                              )}
                              {st === "notdelivered" ? <span className="text-critical">não declarou</span> : pct(rec?.mde)}
                            </span>
                            {rec?.alt != null && (
                              <div className="text-xs font-normal text-muted-foreground" title="O relatório enviado ao Tesouro (SICONFI) traz outro percentual">
                                Tesouro: {pct(rec.alt)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{rec?.mdeV ? brlShort(rec.mdeV) : <Dash />}</TableCell>
                          <TableCell>{rec?.base ? brlShort(rec.base) : <Dash />}</TableCell>
                          <TableCell className={shortfall > 0 ? "text-critical" : undefined}>{shortfall > 0 ? brlShort(shortfall) : <Dash />}</TableCell>
                          <TableCell className={carry > 0 ? "text-critical" : undefined}>{carry > 0 ? brlShort(carry) : <Dash />}</TableCell>
                          <TableCell className={rec?.fun != null && rec.fun < funMin(year) ? "text-critical" : undefined}>{pct(rec?.fun)}</TableCell>
                          <TableCell className={rec?.funLeft != null && rec.funLeft > fundebLeftMax(year) ? "text-critical" : undefined}>{pct(rec?.funLeft)}</TableCell>
                          <TableCell>{rec?.perAluno ? brl(rec.perAluno) : <Dash />}</TableCell>
                          <TableCell>{pct(rec?.sau)}</TableCell>
                          <TableCell className="pr-4! text-left sm:pr-5!">
                            {rec?.src === "siope" ? (
                              <SourceLink href={siopeUrl(c.id, c.uf, year)}>SIOPE</SourceLink>
                            ) : rec?.src === "siconfi" ? (
                              <SourceLink href={siconfiUrl(c.id, year)}>Tesouro</SourceLink>
                            ) : (
                              <span className="text-muted-foreground">{STATUS_LABEL.nodata}</span>
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

        {!single && (
          <section className="grid gap-6 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title={`Onde fica${ly ? ` · ${ly}` : ""}`} description={`${c.name} em destaque entre os municípios ${ofUf(c.uf)}. Clique num município para abri-lo.`}>
              <CityMap uf={c.uf} values={mapValues} highlight={c.id} />
            </Panel>
            <Panel
              className="lg:col-span-2"
              title="Vizinhos"
              description={`Municípios da região imediata ${c.imediata ?? ""}${ly ? `, MDE em ${ly}` : ""}. Do menor para o maior.`}
              divided
            >
              <ol className="scroll-thin max-h-[30rem] overflow-y-auto p-1.5 text-sm tnum">
                {peers.map((p) => {
                  const me = p.slug === c.slug;
                  const w = Math.max(2, Math.min(100, ((p.v - 15) / 25) * 100));
                  return (
                    <li key={p.slug}>
                      <Link
                        href={cityPath(c.uf, p.slug)}
                        aria-current={me ? "page" : undefined}
                        className={cn(
                          "grid grid-cols-[minmax(0,1fr)_5rem_4rem] items-center gap-3 rounded-md px-2.5 py-1.5 transition-colors duration-150",
                          me ? "bg-brand-soft font-medium text-brand-ink" : "hover:bg-accent/60",
                        )}
                      >
                        <span className="truncate">{p.name}</span>
                        <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: p.v < MDE_MIN ? "var(--critical)" : me ? "var(--brand)" : "var(--subtle)" }} />
                          <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: "40%" }} />
                        </span>
                        <span className={cn("text-right", p.v < MDE_MIN && "text-critical")}>{pct(p.v)}</span>
                      </Link>
                    </li>
                  );
                })}
                {peers.length === 0 && <li className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">Sem dados de vizinhos para este ano.</li>}
              </ol>
            </Panel>
          </section>
        )}

        <Panel
          id="agir"
          title="O que você pode fazer"
          description={
            <>
              Dados só mudam algo quando chegam a quem fiscaliza. Escolha um modelo, copie e envie — já vem preenchido com os números de {c.name}.
              Conselheiros do CACS-Fundeb, vereadores e famílias têm direito a essas informações.
            </>
          }
          divided
          bodyClassName="p-0"
        >
          <ActionKit templates={buildTemplates(c)} />
        </Panel>
      </PageBody>
    </>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 after:text-muted-foreground/40 after:content-['·'] last:after:content-none">
      <dt className="sr-only">{label}</dt>
      <dd className="tnum">{children}</dd>
    </div>
  );
}

function Callout({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border bg-muted/50 px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Info />}</span>
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function Rank({ scope, pos, of }: { scope: string; pos: number; of: number }) {
  // share of municipalities that applied the same or less (left = least, right = most)
  const p = of > 1 ? (of - pos) / (of - 1) : 1;
  return (
    <div>
      <div className="text-[13px] text-muted-foreground">{scope}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[26px] leading-8 font-semibold tracking-[-0.04em] tnum">{pos.toLocaleString("pt-BR")}º</span>
        <span className="text-[13px] text-muted-foreground tnum">de {of.toLocaleString("pt-BR")}</span>
      </div>
      <div className="relative mt-2.5 h-1.5 rounded-full bg-muted" role="img" aria-label={`Aplicou tanto ou mais que ${Math.round(p * 100)}% dos municípios`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand/30" style={{ width: `${p * 100}%` }} />
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-brand" style={{ left: `${p * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>aplicou menos</span>
        <span>aplicou mais</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground tnum">
        {pos === 1 ? "Quem mais aplicou." : pos === of ? "Quem menos aplicou." : `Aplicou mais que ${Math.round(p * 100)}% dos municípios.`}
      </p>
    </div>
  );
}

function Compare({ label, value, diff }: { label: string; value: number; diff: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 tnum">
        <span>{pct(value, 1)}</span>
        <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 text-xs font-medium", Math.abs(diff) < 0.05 ? "bg-muted text-muted-foreground" : diff > 0 ? "bg-good-soft text-good-ink" : "bg-critical-soft text-critical")}>
          {pp(diff)}
        </span>
      </dd>
    </div>
  );
}

const Dash = () => <span className="text-muted-foreground">—</span>;

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-ink hover:underline">
      {children}
      <ExternalLink className="size-3" />
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
      footer="Fontes da tese: Figura 42 (TCE-SP, 2020) e Figura 40 (MEC/Inep, 2020). Diferença = declarado − apurado."
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
      <p className="max-w-4xl px-4 py-4 text-[13px] leading-6 text-muted-foreground sm:px-5">
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
          <TableHeader>
            <TableRow className="hover:bg-transparent [&>th]:h-10 [&>th]:px-3 [&>th]:text-right [&>th]:text-[13px] [&>th]:font-medium [&>th]:text-muted-foreground">
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
              const d = t.mde != null && r?.mde != null ? r.mde - t.mde : null;
              const split = t.mde != null && r?.mde != null && t.mde < MDE_MIN !== r.mde < MDE_MIN;
              return (
                <TableRow key={y} className={cn("text-right hover:bg-accent/60 [&>td]:px-3 [&>td]:py-2", split && "bg-warning-soft/60")}>
                  <TableCell className="pl-4! text-left font-medium sm:pl-5!">
                    {y}
                    {split && <span className="ml-2 align-middle"><StatusBadge kind="edge" dot={false}>divergem</StatusBadge></span>}
                  </TableCell>
                  <TableCell className={t.mde != null && t.mde < MDE_MIN ? "font-medium text-critical" : undefined}>{pct(t.mde)}</TableCell>
                  <TableCell className={r?.mde != null && r.mde < MDE_MIN ? "font-medium text-critical" : undefined}>{pct(r?.mde)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d == null ? "—" : Math.abs(d) < 0.005 ? "igual" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2).replace(".", ",")} p.p.`}
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
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-[17px] font-semibold tracking-[-0.02em] tnum", tone === "bad" && "text-critical")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
