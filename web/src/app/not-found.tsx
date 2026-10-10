import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchButton } from "@/components/SearchPalette";

export const metadata: Metadata = { title: "Página não encontrada" };

const LINKS = [
  { href: "/", label: "Painel", sub: "Brasil, regiões e estados" },
  { href: "/explorar", label: "Explorar", sub: "Tabela com os 5.570 municípios" },
  { href: "/dados", label: "Dados abertos", sub: "CSV por estado e dicionário" },
  { href: "/sobre", label: "Metodologia", sub: "Fontes, cálculos e limites" },
];

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <span className="rounded-full border bg-background px-2.5 py-0.5 font-mono text-xs text-muted-foreground">404</span>
      <h1 className="mt-4 text-2xl leading-8 font-medium tracking-[-0.04em] md:text-[2rem] md:leading-10">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-pretty text-muted-foreground">
        O endereço pode ter mudado ou o município foi digitado de outro jeito. Busque pelo nome ou volte por um dos atalhos abaixo.
      </p>
      <SearchButton variant="default" className="mt-6">
        Buscar município, estado ou região
      </SearchButton>
      <ul className="mt-10 grid w-full gap-2 text-left sm:grid-cols-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors duration-150 hover:bg-accent/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{l.label}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{l.sub}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
