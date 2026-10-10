import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import { ButtonLink } from "@/components/kit/button-link";
import { PageHeader } from "@/components/kit/page-header";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { histCounts } from "@/lib/bins";
import { csvHref } from "@/lib/csv";
import { YEARS, brStats, scopeBalance, ufBalances, citiesIn, defaultYear, int, regionStats, rowsIn, topDeficits, ufSummaries } from "@/lib/data";
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
            <ButtonLink href={csvHref(`regiao-${r.slug}`)} download external variant="ghost">
              <Download aria-hidden className="size-4" />
              Baixar CSV da região
            </ButtonLink>
            <ButtonLink href={`/explorar?regiao=${r.slug}`}>
              Explorar municípios
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </>
        }
      >
        <nav aria-label="Regiões" className="mt-5 -mb-1">
          <ul className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border bg-accent p-[3px] [scrollbar-width:none]">
            {REGIONS.map((x) => {
              const on = x.key === r.key;
              return (
                <li key={x.key} className="shrink-0">
                  <Link
                    href={regionPath(x.key)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-9 items-center rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                      on ? "bg-card text-foreground shadow-[0_0_0_1px_var(--border),var(--shadow-resting)]" : "text-muted-foreground hover:text-foreground",
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
      />
    </>
  );
}
