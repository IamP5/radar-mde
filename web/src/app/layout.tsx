import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import SearchPalette from "@/components/SearchPalette";
import { Logo } from "@/components/kit/logo";
import { NavLinks } from "@/components/kit/nav";
import { NAV } from "@/components/kit/nav-items";
import { ThemeProvider, ThemeSwitcher, ThemeToggle } from "@/components/kit/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Radar MDE · Brasil", template: "%s · Radar MDE" },
  description:
    "Quanto cada um dos 5.570 municípios brasileiros aplica em educação, e se cumpre o mínimo constitucional de 25%. Do Brasil às regiões, estados e cidades, de 2008 a 2025.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delay={150}>
            <a
              href="#conteudo"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-pop"
            >
              Pular para o conteúdo
            </a>
            <header className="sticky top-0 z-40 border-b bg-(--header-bg) backdrop-blur-md backdrop-saturate-150">
              <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
                <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md text-[15px] font-semibold tracking-[-0.02em]">
                  <Logo className="size-6 text-foreground" />
                  <span>Radar MDE</span>
                  <span className="hidden rounded-full border px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground sm:inline">BR</span>
                </Link>
                <div className="hidden min-w-0 md:block">
                  <NavLinks />
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <SearchPalette />
                  <ThemeToggle />
                </div>
              </div>
              <div className="border-t px-3 py-1 md:hidden">
                <NavLinks />
              </div>
            </header>
            <main id="conteudo" className="flex-1">
              {children}
            </main>
            <footer className="border-t bg-background">
              <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr]">
                <div className="space-y-3">
                  <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
                    <Logo className="size-5 text-foreground" /> Radar MDE · Brasil
                  </Link>
                  <p className="max-w-xl text-[13px] leading-5 text-muted-foreground">
                    Dados: FNDE/SIOPE (indicadores e receitas declarados pelos municípios e estados, 2008 em diante), Tesouro
                    Nacional/SICONFI (RREO, Anexo 14, municípios de SP) e IBGE (territórios, malhas e população). Inspirado em Silva,
                    A. Z. (2021), <em>O financiamento da Educação Básica no Brasil contemporâneo</em>, UNINOVE. Ferramenta
                    independente, sem vínculo com órgãos públicos.
                  </p>
                </div>
                <div className="flex flex-col justify-between gap-6 md:items-end">
                  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
                    {NAV.map((n) => (
                      <li key={n.href}>
                        <Link href={n.href} className="transition-colors hover:text-foreground">
                          {n.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <ThemeSwitcher />
                </div>
              </div>
            </footer>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
