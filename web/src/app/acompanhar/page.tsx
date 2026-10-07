import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import Watchlist from "@/components/Watchlist";

export const metadata: Metadata = {
  title: "Acompanhando",
  description: "Os municípios que você salvou neste navegador, com o percentual aplicado em educação ano a ano.",
  alternates: { canonical: "/acompanhar" },
  // personal list kept in this browser: nothing to index
  robots: { index: false, follow: true },
};

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
