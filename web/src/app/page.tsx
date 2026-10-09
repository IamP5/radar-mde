import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/kit/page-header";
import { SearchButton } from "@/components/SearchPalette";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { buttonVariants } from "@/components/ui/button";
import { YEARS, allCities, brBalance, brStats, regionBalances, ufBalances, defaultYear, int, regionSummaries, rowsIn, topDeficits, ufSummaries } from "@/lib/data";
import { fundebMap } from "@/lib/fundeb";
import { histCounts } from "@/lib/bins";

export const metadata: Metadata = { alternates: { canonical: "/" } };

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
      >
        {/* CIT-01: the first thing most visitors want is their own city; secondary actions share its row (VIS-13) */}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between print:hidden">
          <div className="w-full max-w-xl">
            <SearchButton
              variant="outline"
              className="h-11 w-full justify-start gap-2.5 rounded-lg bg-background px-3.5 text-[0.9375rem] font-normal text-muted-foreground shadow-xs hover:text-foreground"
            >
              Digite o nome da sua cidade
            </SearchButton>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Veja quanto a sua prefeitura aplica em educação, ano a ano. Ou{" "}
              <a href="#fundeb-mapa" className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
                quem recebe complementação da União
              </a>
              .
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:h-11">
            <a href="/dados/csv/brasil" download className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <Download aria-hidden />
              Baixar CSV
            </a>
            <Link href="/mapa" className={buttonVariants({ variant: "default", size: "sm" })}>
              Mapa interativo
              <ArrowRight aria-hidden />
            </Link>
            <Link href="/explorar" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Explorar municípios
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </PageHeader>
      <TerritoryDashboard
        years={YEARS}
        initialYear={defaultYear()}
        stats={stats}
        ufs={ufSummaries()}
        regions={regionSummaries()}
        deficits={topDeficits({ level: "br" }, 25)}
        deficitsReal={topDeficits({ level: "br" }, 25, { real: true })}
        balanceTotal={brBalance()}
        balanceGroups={[
          { key: "reg", label: "Regiões", noun: "Região", items: regionBalances() },
          { key: "uf", label: "Estados", noun: "Estado", items: ufBalances() },
        ]}
        hist={YEARS.map((_, i) => histCounts(rows.map((r) => r.mde[i])))}
        fundeb={fundebMap(allCities())}
      />
    </>
  );
}
