import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YEARS, existedIn, getCity, latestYear } from "@/lib/data";
import { CouncilSheetView } from "./sheet";

// One real params object keeps the build's "must be fully static" check armed: reading searchParams here fails the
// build, where a placeholder object would let it through.
export const ensureStatic = "navigation";
export const instant = false;

export function generateStaticParams() {
  return [{ uf: "sp", slug: "santo-andre" }];
}

const resolve = (uf: string, slug: string) => (uf === uf.toLowerCase() ? getCity(uf, slug) : undefined);

export async function generateMetadata({ params }: PageProps<"/[uf]/[slug]/conselho">): Promise<Metadata> {
  const { uf, slug } = await params;
  const c = resolve(uf, slug);
  if (!c) return { title: "Página não encontrada" };
  return { title: `Ficha para o conselho · ${c.name} (${c.uf})`, robots: { index: false } };
}

export default async function CouncilPage({ params }: PageProps<"/[uf]/[slug]/conselho">) {
  const { uf, slug } = await params;
  const c = resolve(uf, slug);
  if (!c) notFound();
  const years = YEARS.filter((y) => existedIn(c, y));
  return <CouncilSheetView city={c} years={years} initial={latestYear(c) ?? years[years.length - 1]} />;
}
