import type { Metadata } from "next";
import MapaApp from "@/components/mapa/MapaApp";
import { YEARS, brStats, defaultYear, ufSummaries } from "@/lib/data";

export const metadata: Metadata = {
  title: "Mapa",
  description:
    "Navegue pelo mapa dos 5.570 municípios brasileiros: aproxime um estado, escolha uma cidade e veja, ano a ano, se ela aplica o mínimo de 25% da receita em educação.",
  alternates: { canonical: "/mapa" },
};

export default function MapaPage() {
  return <MapaApp years={YEARS} initialYear={defaultYear()} brStats={brStats()} ufs={ufSummaries()} />;
}
