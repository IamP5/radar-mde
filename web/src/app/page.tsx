import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/kit/page-header";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { buttonVariants } from "@/components/ui/button";
import { YEARS, brStats, defaultYear, int, regionSummaries, topDeficits, ufSummaries } from "@/lib/data";

export default function Home() {
  const stats = brStats();
  const n = stats[stats.length - 1].n;
  return (
    <>
      <PageHeader
        title="A educação recebe o que a Constituição manda?"
        description={
          <>
            Todo município deve aplicar <strong className="font-medium text-foreground">no mínimo 25%</strong> da receita de impostos na manutenção e
            desenvolvimento do ensino (MDE, art. 212 da CF). Acompanhe os <strong className="font-medium text-foreground">{int(n)} municípios</strong> do
            país de {YEARS[0]} a {YEARS[YEARS.length - 1]}, do Brasil às regiões, estados e cidades, com os dados que eles mesmos declararam ao
            governo federal (SIOPE/FNDE).
          </>
        }
        actions={
          <>
            <a href="/dados/csv/brasil" download className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <Download aria-hidden />
              Baixar CSV
            </a>
            <Link href="/explorar" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Explorar municípios
              <ArrowRight aria-hidden />
            </Link>
          </>
        }
      />
      <TerritoryDashboard
        years={YEARS}
        initialYear={defaultYear()}
        stats={stats}
        ufs={ufSummaries()}
        regions={regionSummaries()}
        deficits={topDeficits({ level: "br" }, 25)}
      />
    </>
  );
}
