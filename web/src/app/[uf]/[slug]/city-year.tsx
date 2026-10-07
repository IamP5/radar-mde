"use client";

/**
 * Year-dependent parts of the city page. The page HTML stays static (latest year); `?ano=` is read after mount
 * (useYear) and every island below re-renders from data already in the page. Only the state map / histogram of
 * a non-default year need the other municipalities' values, fetched once per year from ./ano/[ano].
 */
import { ExternalLink, Info, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import CityMap, { type CityMapValue } from "@/components/CityMap";
import Histogram from "@/components/Histogram";
import ShareButton from "@/components/ShareButton";
import YearPicker, { useYear, withYear } from "@/components/YearPicker";
import { EmptyState, Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { StatusBadge } from "@/components/kit/status";
import { Button } from "@/components/ui/button";
import { MDE_MIN, brl, brlShort, pct, siconfiUrl, siopeUrl } from "@/lib/format";
import { cityPath } from "@/lib/geo";
import { ATIP_LABEL } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { Term } from "./glossary";
import { type CityYearData, type Rank, type YearPoint, prevPoint, pts, summary } from "./verdict";

type Ctx = {
  d: CityYearData;
  year: number;
  setYear: (y: number) => void;
  p: YearPoint;
  /** other municipalities of the state in the selected year (null while loading); -1 = não declarou */
  uf: { vals: (number | null)[] | null; shownYear: number; loading: boolean; failed: boolean };
};
const CityCtx = createContext<Ctx | null>(null);
const useCity = () => {
  const c = useContext(CityCtx);
  if (!c) throw new Error("CityYearProvider missing");
  return c;
};

export function CityYearProvider({ data: d, children }: { data: CityYearData; children: ReactNode }) {
  const [year, setYear] = useYear(d.years, d.initial);
  const [cache, setCache] = useState(() => new Map([[d.initial, d.map.initial]]));
  const [last, setLast] = useState(d.initial);
  const [failed, setFailed] = useState<number | null>(null);
  useEffect(() => {
    if (cache.has(year)) return;
    let live = true;
    fetch(`${cityPath(d.uf, d.slug)}/ano/${year}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ v: (number | null)[] }>;
      })
      .then((j) => {
        if (!live || j.v.length !== d.map.ids.length) throw new Error("shape");
        setCache((m) => new Map(m).set(year, j.v));
        setLast(year);
      })
      .catch(() => live && setFailed(year));
    return () => {
      live = false;
    };
  }, [year, cache, d.uf, d.slug, d.map.ids.length]);

  const p = d.points.find((x) => x.y === year) ?? d.points[d.points.length - 1];
  const vals = cache.get(year) ?? null;
  const value: Ctx = {
    d,
    year,
    setYear,
    p,
    uf: { vals: vals ?? cache.get(last) ?? null, shownYear: vals ? year : last, loading: !vals && failed !== year, failed: !vals && failed === year },
  };
  return <CityCtx.Provider value={value}>{children}</CityCtx.Provider>;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/* ---------------------------------------------------------------- header */

export function HeaderStatus({ belowCount }: { belowCount: number }) {
  const { d, p } = useCity();
  const s = summary(d, p);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {s.badges.map((b) => (
          <StatusBadge key={b.text} kind={b.kind}>
            {b.text}
          </StatusBadge>
        ))}
        {belowCount > 0 && (
          <span className="text-[13px] text-muted-foreground">
            Abaixo dos 25% em <span className="font-medium text-critical-ink">{plural(belowCount, "ano", "anos")}</span> desde {d.points.find((x) => x.mde != null)?.y}
          </span>
        )}
      </div>
      <p className="text-foreground" aria-live="polite">
        {s.verdict}
      </p>
    </div>
  );
}

export function HeaderShare() {
  const { d, p } = useCity();
  return <ShareButton text={`${d.name} (${d.uf}): ${summary(d, p).verdict} Veja no Radar MDE:`} path={cityPath(d.uf, d.slug)} />;
}

export function HeaderSource() {
  const { d, p } = useCity();
  if (!p.src) return null;
  const href = p.src === "siconfi" ? siconfiUrl(d.id, p.y) : siopeUrl(d.id, d.uf, p.y);
  const name = p.src === "siconfi" ? "Tesouro" : "SIOPE";
  return (
    <Button
      variant="ghost"
      className="text-muted-foreground print:hidden"
      render={<a href={href} target="_blank" rel="noreferrer" aria-label={`Dados brutos de ${p.y} no ${name} (arquivo JSON, abre em nova aba)`} />}
      nativeButton={false}
    >
      {name} <ExternalLink className="size-3.5" />
    </Button>
  );
}

/* ---------------------------------------------------------------- year bar */

export function YearBar() {
  const { d, year, setYear } = useCity();
  return (
    <div className="sticky top-(--header-h) z-30 border-b bg-(--header-bg) backdrop-blur-md backdrop-saturate-150 print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2 sm:px-6">
        <YearPicker years={d.years} year={year} onChange={setYear} className="max-w-full" />
        <p className={cn("text-[13px] text-muted-foreground", year === d.initial && "hidden sm:block")} aria-live="polite">
          {year === d.initial ? (
            "Gráficos e tabela mostram a série completa."
          ) : (
            <>
              Mostrando {year}.{" "}
              <button type="button" onClick={() => setYear(d.initial)} className="font-medium text-brand-ink hover:underline">
                Voltar para {d.initial}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- KPIs */

export function YearKpis() {
  const { d, p } = useCity();
  const prev = prevPoint(d, p.y);
  const dv = p.mde != null && prev ? p.mde - prev.mde! : null;
  const y = p.y;
  const noValue = p.st === "nd" ? "não declarou" : p.st === "na" ? "o município ainda não existia" : "sem dados";
  return (
    <section aria-label={`Indicadores de ${y}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label={
          <>
            <Term k="mde">MDE</Term> em {y}
          </>
        }
        value={pct(p.mde)}
        tone={p.st === "below" ? "bad" : "neutral"}
        delta={dv != null ? `${dv > 0 ? "+" : dv < 0 ? "−" : "±"}${pts(dv)} ${Math.abs(dv) < 1.95 ? "ponto" : "pontos"}` : undefined}
        deltaTone={dv == null || Math.abs(dv) < 0.05 ? "neutral" : dv > 0 ? "good" : "bad"}
        sub={
          p.mde == null ? (
            <span className={p.st === "nd" ? "text-critical-ink" : undefined}>{noValue}</span>
          ) : prev ? (
            `${pct(prev.mde)} em ${prev.y} · mínimo ${MDE_MIN}%`
          ) : (
            `mínimo ${MDE_MIN}% da receita de impostos`
          )
        }
        context={
          p.medBr != null ? (
            <>
              <Term k="mediana">Mediana</Term> {d.single ? "" : `${d.uf} ${pct(p.medUf, 1)} · `}Brasil {pct(p.medBr, 1)}
            </>
          ) : undefined
        }
      />
      <Stat
        label={
          <>
            <Term k="fundeb">Fundeb</Term> em salários {y}
          </>
        }
        value={pct(p.fun)}
        sub={`mínimo ${p.funMin}%${p.fun != null && p.fun > 100 ? " · acima de 100%: inclui saldo de anos anteriores" : ""}`}
        tone={p.fun != null && p.fun < p.funMin ? "bad" : "neutral"}
      />
      <Stat
        label={`Por aluno em ${y}`}
        icon={p.atip.includes("aluno") ? <TriangleAlert aria-label="Valor atípico" className="size-3.5 text-warning" /> : undefined}
        value={p.aluno ? brl(p.aluno) : "—"}
        sub={
          p.atip.includes("aluno")
            ? "valor atípico: possível erro nas matrículas declaradas"
            : p.mdeV
              ? `${p.mdeVEst ? "≈ " : ""}${brlShort(p.mdeV)} aplicados${p.mdeVEst ? " (estimado)" : ""} · R$ da época`
              : "por ano, educação básica · R$ da época"
        }
      />
      <Stat
        label={
          <>
            <Term k="deficit">Déficit</Term> até {y}
          </>
        }
        value={d.firstBase == null || d.firstBase > y ? "—" : p.carry > 0 ? brlShort(p.carry) : "R$ 0"}
        tone={p.carry > 0 ? "bad" : "neutral"}
        sub={
          d.firstBase == null
            ? "sem receita declarada para estimar"
            : d.firstBase > y
              ? `estimativa disponível a partir de ${d.firstBase}`
              : p.carry > 0
                ? `estimativa não compensada desde ${d.firstBase}, R$ da época`
                : "nada a compensar pela estimativa"
        }
      />
    </section>
  );
}

export function AtypicalCallout() {
  const { p } = useCity();
  if (!p.atip.length) return null;
  return (
    <div className="flex gap-2.5 rounded-lg border bg-muted/50 px-3.5 py-3 text-[13px] leading-5 text-muted-foreground">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <div className="font-medium text-foreground">Valor atípico em {p.y}</div>
        <ul className="mt-0.5 space-y-0.5">
          {p.atip.map((k) => (
            <li key={k}>{ATIP_LABEL[k]}.</li>
          ))}
        </ul>
        <div className="mt-1">Confira na fonte (coluna “Fonte” da tabela ano a ano) e, se for o caso, peça esclarecimento à prefeitura com os modelos abaixo.</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- rank */

export function RankPanel() {
  const { d, p } = useCity();
  return (
    <Panel title={`Posição em ${p.y}`} description="Comparação pelo % da receita de impostos aplicado em MDE.">
      {p.mde == null ? (
        <p className="py-2 text-sm text-muted-foreground">
          Sem posição em {p.y}: {p.st === "nd" ? "o município não declarou os dados" : p.st === "na" ? "o município ainda não existia" : "não há dados"}.
        </p>
      ) : (
        <div className="space-y-5 pt-1">
          {p.rUf && !d.single && <RankBlock scope={`Entre os municípios ${d.ofUf}`} r={p.rUf} name={d.name} />}
          {p.rBr && <RankBlock scope="Entre os municípios do Brasil" r={p.rBr} name={d.name} />}
          <dl className="divide-y rounded-lg border text-[13px]">
            {!d.single && p.medUf != null && <Compare label={`Mediana ${d.uf}`} value={p.medUf} diff={p.mde - p.medUf} />}
            {p.medBr != null && <Compare label="Mediana Brasil" value={p.medBr} diff={p.mde - p.medBr} />}
            <Compare label="Mínimo legal" value={MDE_MIN} diff={p.mde - MDE_MIN} />
          </dl>
          <p className="text-xs text-muted-foreground">
            Diferenças em <Term k="pp">pontos percentuais</Term>; a <Term k="mediana">mediana</Term> é o valor típico.
          </p>
        </div>
      )}
    </Panel>
  );
}

function RankBlock({ scope, r, name }: { scope: string; r: Rank; name: string }) {
  const more = r.pos - 1;
  const same = Math.max(0, r.of - 1 - more - r.less);
  // share of the others that applied less (left = least, right = most)
  const f = r.of > 1 ? r.less / (r.of - 1) : 1;
  return (
    <div>
      <div className="text-[13px] text-muted-foreground">
        {scope} com dados ({r.of.toLocaleString("pt-BR")})
      </div>
      <p className="mt-1 text-[15px] leading-6 text-pretty">
        <strong className="font-semibold tnum">{plural(r.less, "aplicou", "aplicaram")}</strong> menos e{" "}
        <strong className="font-semibold tnum">{plural(more, "aplicou", "aplicaram")}</strong> mais que {name}
        {same > 0 && `; ${plural(same, "aplicou", "aplicaram")} o mesmo`}.
      </p>
      <div className="relative mt-2.5 h-1.5 rounded-full bg-muted" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand/30" style={{ width: `${f * 100}%` }} />
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-brand" style={{ left: `${f * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>aplicou menos</span>
        <span>aplicou mais</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground tnum">
        Posição {r.pos.toLocaleString("pt-BR")}º de {r.of.toLocaleString("pt-BR")} (1º = quem mais aplicou)
      </p>
    </div>
  );
}

function Compare({ label, value, diff }: { label: string; value: number; diff: number }) {
  const same = Math.abs(diff) < 0.05;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 tnum">
        <span>{pct(value, 1)}</span>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full px-1.5 text-xs font-medium whitespace-nowrap",
            same ? "bg-muted text-muted-foreground" : diff > 0 ? "bg-good-soft text-good-ink" : "bg-critical-soft text-critical-ink",
          )}
          title={same ? "igual" : `${pts(diff)} pontos percentuais ${diff > 0 ? "acima" : "abaixo"}`}
        >
          {same ? "igual" : `${diff > 0 ? "+" : "−"}${pts(diff)} p.p.`}
          <span className="sr-only">{same ? "" : diff > 0 ? " acima" : " abaixo"}</span>
        </span>
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------- place: map + neighbours */

export function MapPanel() {
  const { d, year, uf } = useCity();
  const values = useMemo<CityMapValue[]>(
    () => (uf.vals ? d.map.ids.map((id, i) => [id, uf.vals![i] === -1 ? null : uf.vals![i], uf.vals![i] === -1 ? 1 : 0]) : []),
    [uf.vals, d.map.ids],
  );
  return (
    <Panel
      className="lg:col-span-3"
      title={`Onde fica · ${uf.shownYear}`}
      description={`${d.name} em destaque entre os municípios ${d.ofUf}. Toque ou passe o mouse num município para ver o valor; toque de novo ou clique para abri-lo.`}
      action={
        uf.loading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-3.5 animate-spin" /> Carregando {year}…
          </span>
        ) : uf.failed ? (
          <span className="text-xs text-critical-ink" role="status">
            Não foi possível carregar {year}.
          </span>
        ) : undefined
      }
    >
      <div className={cn("transition-opacity duration-150", uf.loading && "opacity-60")}>
        <CityMap uf={d.uf} values={values} highlight={d.id} query={year === d.initial ? "" : `?ano=${year}`} />
      </div>
      {d.since != null && d.since >= 2023 && (
        <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          {d.name} foi instalado em {d.since} e ainda não aparece na malha municipal do IBGE usada no mapa.
        </p>
      )}
    </Panel>
  );
}

export function PeersPanel({ imediata }: { imediata: string | null }) {
  const { d, year } = useCity();
  const yi = d.years.indexOf(year);
  const peers = d.peers
    .map((x) => ({ name: x.name, slug: x.slug, v: x.v[yi] ?? null }))
    .filter((x): x is { name: string; slug: string; v: number } => x.v != null)
    .sort((a, b) => a.v - b.v);
  const missing = d.peers.length - peers.length;
  return (
    <Panel
      className="lg:col-span-2"
      title="Vizinhos"
      description={
        <>
          Municípios da <Term k="imediata">região imediata</Term> {imediata ?? ""}, MDE em {year}. Do menor para o maior.
          {missing > 0 && ` ${plural(missing, "sem dado", "sem dados")} neste ano.`}
        </>
      }
      divided
    >
      <ol className="scroll-thin max-h-[30rem] overflow-y-auto p-1.5 text-sm tnum">
        {peers.map((x) => {
          const me = x.slug === d.slug;
          const w = Math.max(2, Math.min(100, ((x.v - 15) / 25) * 100));
          return (
            <li key={x.slug}>
              <Link
                href={withYear(cityPath(d.uf, x.slug), year, d.initial)}
                aria-current={me ? "page" : undefined}
                className={cn(
                  "grid min-h-11 grid-cols-[minmax(0,1fr)_5rem_4rem] items-center gap-3 rounded-md px-2.5 py-1.5 transition-colors duration-150 sm:min-h-8",
                  me ? "bg-brand-soft font-medium text-brand-ink" : "hover:bg-accent/60",
                )}
              >
                <span className="truncate">{x.name}</span>
                <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: x.v < MDE_MIN ? "var(--critical)" : me ? "var(--brand)" : "var(--subtle)" }} />
                  <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: "40%" }} />
                </span>
                <span className={cn("text-right", x.v < MDE_MIN && "text-critical-ink")}>
                  {pct(x.v)}
                  {x.v < MDE_MIN && <span className="sr-only"> (abaixo de 25%)</span>}
                </span>
              </Link>
            </li>
          );
        })}
        {peers.length === 0 && <li className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">Sem dados de vizinhos em {year}.</li>}
      </ol>
    </Panel>
  );
}

/* ---------------------------------------------------------------- distribution */

export function DistributionPanel() {
  const { d, p, uf } = useCity();
  const vals = (uf.vals ?? []).filter((v): v is number => v != null && v !== -1);
  const ready = uf.shownYear === p.y && p.mde != null && vals.length > 1;
  return (
    <Panel
      className="lg:col-span-3"
      title={ready ? `${d.name} entre os ${vals.length.toLocaleString("pt-BR")} municípios ${d.ofUf}` : `Municípios ${d.ofUf} em ${p.y}`}
      description={`Quantos municípios ${d.inUf} aplicaram cada percentual em MDE em ${p.y}; a marca indica ${d.name}.`}
    >
      {ready ? (
        <Histogram values={vals} mark={{ value: p.mde!, label: d.name }} height={220} ariaLabel={`Distribuição do MDE ${d.inUf}, ${p.y}, com ${d.name} destacado`} />
      ) : uf.loading ? (
        <div className="h-[220px] animate-pulse rounded-md bg-muted" aria-label="Carregando" />
      ) : (
        <EmptyState title={`Sem valor de ${d.name} em ${p.y}`} className="h-[220px]">
          {p.st === "nd" ? "O município não declarou os dados deste ano." : p.st === "na" ? "O município ainda não existia." : "Não há dados para comparar."}
        </EmptyState>
      )}
    </Panel>
  );
}
