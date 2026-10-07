import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import Watchlist from "@/components/Watchlist";

export const metadata: Metadata = { title: "Acompanhando" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Acompanhando"
        description="Os municípios que você salvou, com o percentual aplicado em MDE em cada ano. A lista fica guardada só neste navegador."
      />
      <PageBody>
        <Watchlist />
      </PageBody>
    </>
  );
}
