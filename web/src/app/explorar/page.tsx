import type { Metadata } from "next";
import Explorer from "@/components/Explorer";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { YEARS, defaultYear } from "@/lib/data";

export const metadata: Metadata = { title: "Explorar municípios" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Explorar municípios"
        description={
          <>
            Os 5.570 municípios em uma tabela: filtre por região, estado, porte e situação, ordene qualquer coluna, compare{" "}
            {YEARS[0]}–{YEARS[YEARS.length - 1]} e exporte o recorte em CSV.
          </>
        }
      />
      <PageBody>
        <Explorer years={YEARS} initialYear={defaultYear()} />
      </PageBody>
    </>
  );
}
