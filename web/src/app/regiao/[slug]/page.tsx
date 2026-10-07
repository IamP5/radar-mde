import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { YEARS, brStats, citiesIn, defaultYear, int, regionStats, topDeficits, ufSummaries } from "@/lib/data";
import { REGIONS, getRegionBySlug, regionPath } from "@/lib/geo";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/regiao/[slug]">): Promise<Metadata> {
  const r = getRegionBySlug((await params).slug);
  return r ? { title: `Região ${r.name}`, description: `Aplicação em educação (MDE) dos municípios da Região ${r.name}, por estado e município.` } : {};
}

export default function Page({ params }: PageProps<"/regiao/[slug]">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Content params={params} />
    </Suspense>
  );
}

function Fallback() {
  return (
    <>
      <div className="border-b bg-background">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-8 sm:px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
      </div>
      <PageBody>
        <div role="status" aria-label="Carregando" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[520px] rounded-xl" />
      </PageBody>
    </>
  );
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const r = getRegionBySlug((await params).slug);
  if (!r) notFound();
  const scope = { level: "region" as const, region: r.key };
  const cities = citiesIn(scope);
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
            <a href="/dados/csv/brasil" download className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <Download aria-hidden />
              Baixar CSV
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
      />
    </>
  );
}
