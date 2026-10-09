import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import SearchPalette from "@/components/SearchPalette";
import { ChromeGate } from "@/components/kit/chrome-gate";
import { Logo } from "@/components/kit/logo";
import { NavLinks } from "@/components/kit/nav";
import { NAV } from "@/components/kit/nav-items";
import { ThemeProvider, ThemeSwitcher, ThemeToggle } from "@/components/kit/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { META, dateBR } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
/** display serif for the immersive /mapa view */
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif" });

const DESCRIPTION =
  "Quanto cada um dos 5.570 municípios brasileiros aplica em educação, e se cumpre o mínimo constitucional de 25%. Do Brasil às regiões, estados e cidades, de 2008 a 2025.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Radar MDE · Brasil", template: "%s · Radar MDE" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  // Link-preview defaults (WhatsApp, redes sociais). No og:title/description here: they would shadow each page's own
  // title (previews then fall back to <title>/description); app/opengraph-image.tsx is the default share image.
  openGraph: { type: "website", locale: "pt_BR", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delay={150}>
            <a
              href="#conteudo"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-pop"
            >
              Pular para o conteúdo
            </a>
            <ChromeGate>
            <header className="sticky top-0 z-40 border-b bg-(--header-bg) backdrop-blur-md backdrop-saturate-150">
              <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
                <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md text-[0.9375rem] font-semibold tracking-[-0.02em]">
                  <Logo className="size-6 text-foreground" />
                  <span>Radar MDE</span>
                  <span className="hidden rounded-full border px-1.5 py-px font-mono text-[0.6875rem] font-normal text-muted-foreground sm:inline">BR</span>
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
            </ChromeGate>
            <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <ChromeGate>
            <footer className="border-t bg-background">
              <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr]">
                <div className="space-y-3">
                  <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
                    <Logo className="size-5 text-foreground" /> Radar MDE · Brasil
                  </Link>
                  <p className="max-w-xl text-[0.8125rem] leading-5 text-muted-foreground">
                    Dados: FNDE/SIOPE (indicadores e receitas declarados pelos municípios e estados, 2008 em diante), Tesouro
                    Nacional/SICONFI (RREO, Anexo 14, municípios de SP) e IBGE (territórios, malhas e população). Inspirado em Silva,
                    A. Z. (2021), <em>O financiamento da Educação Básica no Brasil contemporâneo</em>, UNINOVE. Ferramenta
                    independente, sem vínculo com órgãos públicos.
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Dados extraídos em <time dateTime={META.extracted}>{dateBR(META.extracted)}</time> · versão{" "}
                    <span className="font-mono whitespace-nowrap">{META.version}</span> · licença{" "}
                    <a href={META.licenseUrl} rel="license noopener" target="_blank" className="underline-offset-2 hover:text-foreground hover:underline">
                      {META.license}
                    </a>
                  </p>
                </div>
                <div className="flex flex-col justify-between gap-6 md:items-end">
                  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground">
                    {NAV.map((n) => (
                      <li key={n.href}>
                        <Link href={n.href} prefetch={false} className="inline-flex min-h-6 items-center transition-colors hover:text-foreground">
                          {n.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <ThemeSwitcher className="w-fit self-start md:self-end" />
                </div>
              </div>
            </footer>
            </ChromeGate>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
