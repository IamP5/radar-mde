import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/kit/page-header";
import { SearchButton } from "@/components/SearchPalette";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { buttonVariants } from "@/components/ui/button";
import { YEARS, brStats, defaultYear, int, regionSummaries, rowsIn, topDeficits, ufSummaries } from "@/lib/data";
import { histCounts } from "@/lib/bins";

export default function Home() {
  const stats = brStats();
  const n = stats[stats.length - 1].n;
  const rows = rowsIn({ level: "br" });
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
      >
        {/* CIT-01: the first thing most visitors want is their own city */}
        <div className="mt-6 max-w-xl print:hidden">
          <SearchButton
            variant="outline"
            className="h-11 w-full justify-start gap-2.5 rounded-lg bg-background px-3.5 text-[0.9375rem] font-normal text-muted-foreground shadow-xs hover:text-foreground"
          >
            Digite o nome da sua cidade
          </SearchButton>
          <p className="mt-2 text-[13px] text-muted-foreground">Veja quanto a sua prefeitura aplica em educação, ano a ano.</p>
        </div>
      </PageHeader>
      <TerritoryDashboard
        years={YEARS}
        initialYear={defaultYear()}
        stats={stats}
        ufs={ufSummaries()}
        regions={regionSummaries()}
        deficits={topDeficits({ level: "br" }, 25)}
        hist={YEARS.map((_, i) => histCounts(rows.map((r) => r.mde[i])))}
      />
    </>
  );
}
