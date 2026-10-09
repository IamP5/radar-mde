import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YEARS, allCities, existedIn, getCity, latestYear, type City } from "@/lib/data";
import type { YearSnapshot } from "@/lib/caqm";
import { THESIS_SANTO_ANDRE_ID } from "@/lib/thesis";
import { Simulator } from "./simulator";

export const ensureStatic = "navigation";
export const instant = false;

const PRERENDER_POP = 200_000;

export function generateStaticParams() {
  return allCities()
    .filter((c) => c.capital || c.pop >= PRERENDER_POP)
    .map((c) => ({ uf: c.uf.toLowerCase(), slug: c.slug }));
}

const resolve = (uf: string, slug: string) => (uf === uf.toLowerCase() ? getCity(uf, slug) : undefined);

const positive = (v: number | undefined) => (v == null || v <= 0 ? null : v);

function snapshots(c: City): YearSnapshot[] {
  return YEARS.map((year) => {
    const r = c.years[year];
    const existed = existedIn(c, year);
    const declared = existed && r?.s === "ok";
    return {
      year,
      existed,
      mde: declared ? (r?.mde ?? null) : null,
      mdeV: declared ? positive(r?.mdeV) : null,
      base: declared ? positive(r?.base) : null,
      perAluno: declared ? positive(r?.perAluno) : null,
      fun: declared ? (r?.fun ?? null) : null,
      estimatedSpending: Boolean(declared && r?.mdeVEst === 1),
    };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ uf: string; slug: string }> }): Promise<Metadata> {
  const { uf, slug } = await params;
  const c = resolve(uf, slug);
  if (!c) return { title: "Página não encontrada" };
  const title = `CAQM de ${c.name} (${c.uf})`;
  const description = `Simulação cidadã do Custo Aluno-Qualidade municipal de ${c.name}. Não é o CAQ oficial.`;
  const url = `/${c.uf.toLowerCase()}/${c.slug}/caqm`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · Radar MDE`, description, url, type: "website", locale: "pt_BR", siteName: "Radar MDE" },
  };
}

export default async function Page({ params }: { params: Promise<{ uf: string; slug: string }> }) {
  const { uf, slug } = await params;
  const c = resolve(uf, slug);
  if (!c) notFound();
  const initialYear = latestYear(c) ?? YEARS[YEARS.length - 1];
  return (
    <Simulator
      city={c.name}
      uf={c.uf}
      slug={c.slug}
      pop={c.pop}
      initialYear={initialYear}
      years={snapshots(c)}
      thesis={c.id === THESIS_SANTO_ANDRE_ID}
    />
  );
}
