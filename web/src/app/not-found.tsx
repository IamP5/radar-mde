import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/arc/badge/badge";
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
      <Badge>404</Badge>
      <h1 className="mt-4 font-heading text-2xl leading-8 font-medium tracking-(--tracking-display) text-balance md:text-3xl md:leading-10">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-base leading-6 text-pretty text-muted-foreground">
        O endereço pode ter mudado ou o município foi digitado de outro jeito. Busque pelo nome ou volte por um dos atalhos abaixo.
      </p>
      <SearchButton variant="primary" size="md" className="mt-6">
        Buscar município, estado ou região
      </SearchButton>
      <ul className="mt-10 grid w-full gap-3 text-left sm:grid-cols-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card transition-colors duration-150 hover:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{l.label}</span>
                <span className="block truncate text-sm text-muted-foreground">{l.sub}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
