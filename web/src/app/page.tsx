import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/kit/page-header";
import { ButtonLink } from "@/components/kit/button-link";
import { SearchFieldButton } from "@/components/SearchPalette";
import TerritoryDashboard from "@/components/territory/TerritoryDashboard";
import { YEARS, brBalance, brStats, regionBalances, ufBalances, defaultYear, int, regionSummaries, rowsIn, topDeficits, ufSummaries } from "@/lib/data";
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
            <SearchFieldButton>Digite o nome da sua cidade</SearchFieldButton>
            <p className="mt-2 text-sm text-muted-foreground">Veja quanto a sua prefeitura aplica em educação, ano a ano.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:h-11">
            <ButtonLink href="/dados/csv/brasil" download external variant="ghost">
              <Download aria-hidden className="size-4" />
              Baixar CSV
            </ButtonLink>
            <ButtonLink href="/mapa" variant="primary">
              Mapa interativo
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="/explorar">
              Explorar municípios
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
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
      />
    </>
  );
}
