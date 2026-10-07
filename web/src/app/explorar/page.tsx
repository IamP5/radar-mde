import type { Metadata } from "next";
import Explorer from "@/components/Explorer";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { YEARS, defaultYear } from "@/lib/data";

const DESCRIPTION =
  "Tabela com os 5.570 municípios: filtre por região, estado, porte, situação e capitais, ordene, compare 2008–2025 e exporte em CSV (também para Excel).";

export const metadata: Metadata = {
  title: "Explorar municípios",
  description: DESCRIPTION,
  alternates: { canonical: "/explorar" },
  openGraph: { title: "Explorar municípios · Radar MDE", description: DESCRIPTION, url: "/explorar" },
};

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
