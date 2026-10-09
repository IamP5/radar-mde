import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/kit/page-header";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { buttonVariants } from "@/components/ui/button";
import { histCounts } from "@/lib/bins";
import { csvHref } from "@/lib/csv";
import { YEARS, brStats, scopeBalance, ufBalances, citiesIn, defaultYear, int, regionStats, rowsIn, topDeficits, ufSummaries } from "@/lib/data";
import { fundebMap } from "@/lib/fundeb";
import { REGIONS, getRegionBySlug, regionPath } from "@/lib/geo";
import { cn } from "@/lib/utils";

// Five known regions: an unknown slug must be a real 404, so validate above any Suspense boundary and
// require the route to be fully static (an unlisted slug waits for its render instead of streaming a shell).
export const ensureStatic = "navigation";
export const instant = false;

export function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/regiao/[slug]">): Promise<Metadata> {
  const r = getRegionBySlug((await params).slug);
  return r
    ? {
        title: `Região ${r.name}`,
        description: `Aplicação em educação (MDE) dos municípios da Região ${r.name}, por estado e município.`,
        alternates: { canonical: regionPath(r.key) },
      }
    : { title: "Página não encontrada" };
}

export default async function Page({ params }: PageProps<"/regiao/[slug]">) {
  const { slug } = await params;
  const r = getRegionBySlug(slug);
  // "/regiao/Sul" → "/regiao/sul" happens in src/proxy.ts
  if (!r) notFound();
  const scope = { level: "region" as const, region: r.key };
  const cities = citiesIn(scope);
  const rows = rowsIn(scope);
  return (
    <>
      <PageHeader
        eyebrow={<Breadcrumbs region={r.key} />}
        title={`Região ${r.name}`}
        description={
          <span className="tnum">
            {r.ufs.length} estados · {int(cities.length)} municípios · {int(cities.reduce((s, c) => s + c.pop, 0))} habitantes
          </span>
        }
        actions={
          <>
            <a href={csvHref(`regiao-${r.slug}`)} download className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <Download aria-hidden />
              Baixar CSV da região
            </a>
            <Link href={`/explorar?regiao=${r.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Explorar municípios
              <ArrowRight aria-hidden />
            </Link>
          </>
        }
      >
        <nav aria-label="Regiões" className="mt-5 -mb-1">
          <ul className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none]">
            {REGIONS.map((x) => {
              const on = x.key === r.key;
              return (
                <li key={x.key} className="shrink-0">
                  <Link
                    href={regionPath(x.key)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 items-center rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
                      on ? "bg-background text-foreground shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {x.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </PageHeader>
      <TerritoryDashboard
        region={r.key}
        years={YEARS}
        initialYear={defaultYear()}
        stats={regionStats(r.key)}
        parent={brStats()}
        ufs={ufSummaries(r.ufs)}
        deficits={topDeficits(scope, 25)}
        deficitsReal={topDeficits(scope, 25, { real: true })}
        balanceTotal={scopeBalance(scope)}
        balanceGroups={[{ key: "uf", label: "Estados", noun: "Estado", items: ufBalances(r.ufs) }]}
        hist={YEARS.map((_, i) => histCounts(rows.map((x) => x.mde[i])))}
        fundeb={fundebMap(citiesIn(scope))}
      />
    </>
  );
}
