import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Compass, Download } from "lucide-react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/kit/page-header";
import { Button } from "@/components/ui/button";
import UfDashboard from "@/components/UfDashboard";
import { YEARS, brStats, citiesOf, defaultYear, int, regionStats, rowsIn, stateGov, topDeficits, ufStats } from "@/lib/data";
import { UFS, getRegion, getUf, ofUf } from "@/lib/geo";
import { toColumns } from "@/components/territory/pack";

// Every UF is known at build time; an unknown sigla must be a real 404 (not a streamed soft 404), so the
// page validates its param above any Suspense boundary and the whole route is required to be static.
// `instant = false`: the param is read outside <Suspense> on purpose (the page is fully static either way).
export const ensureStatic = "navigation";
export const instant = false;

export function generateStaticParams() {
  return UFS.map((u) => ({ uf: u.uf.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps<"/[uf]">): Promise<Metadata> {
  const { uf: raw } = await params;
  const u = raw === raw.toLowerCase() ? getUf(raw) : undefined;
  return u
    ? {
        title: u.name,
        description: `Quanto cada município ${ofUf(u.uf)} aplica em educação (MDE) e quem fica abaixo do mínimo constitucional de 25%.`,
        alternates: { canonical: `/${u.uf.toLowerCase()}` },
      }
    : { title: "Página não encontrada" };
}

export default async function Page({ params }: PageProps<"/[uf]">) {
  const { uf: raw } = await params;
  // "/SP" → "/sp" happens in src/proxy.ts; here only the canonical lowercase form resolves
  const u = raw === raw.toLowerCase() ? getUf(raw) : undefined;
  if (!u) notFound();
  // The Distrito Federal has a single "municipality" (Brasília): its page is the dashboard
  if (u.uf === "DF") redirect(`/df/${citiesOf("DF")[0].slug}`);
  const cities = citiesOf(u.uf);
  const gov = stateGov(u.uf);
  const pop = cities.reduce((s, c) => s + c.pop, 0);
  return (
    <>
      <PageHeader
        eyebrow={<Breadcrumbs uf={u.uf} />}
        title={u.name}
        description={
          <>
            Quanto cada um dos {int(cities.length)} municípios {ofUf(u.uf)} aplica em educação e quem fica abaixo do mínimo constitucional de 25%.
            <span className="mt-1 block text-[13px] text-muted-foreground tnum">
              {int(cities.length)} municípios · {int(pop)} habitantes · Região {getRegion(u.region).name}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" render={<a href={`/dados/csv/${u.uf.toLowerCase()}`} download />} nativeButton={false}>
              <Download className="text-muted-foreground" /> Baixar CSV
            </Button>
            <Button variant="outline" render={<Link href={`/explorar?uf=${u.uf}`} />} nativeButton={false}>
              <Compass className="text-muted-foreground" /> Explorar
            </Button>
          </>
        }
      />
      <UfDashboard
        uf={u.uf}
        years={YEARS}
        initialYear={defaultYear()}
        rows={toColumns(rowsIn({ level: "uf", uf: u.uf }))}
        stats={ufStats(u.uf)}
        regionStats={regionStats(u.region)}
        brStats={brStats()}
        gov={{ mde: YEARS.map((y) => gov?.years[y]?.mde ?? null), fun: YEARS.map((y) => gov?.years[y]?.fun ?? null) }}
        deficits={topDeficits({ level: "uf", uf: u.uf }, 20)}
        deficitsReal={topDeficits({ level: "uf", uf: u.uf }, 20, { real: true })}
      />
    </>
  );
}
