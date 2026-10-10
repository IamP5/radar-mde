import { Braces, Download, FileSpreadsheet, Info } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CSV_COLUMNS, csvHref } from "@/lib/csv";
import { SITE_URL } from "@/lib/site";
import { Citations } from "./cite";
import { META, YEARS, allCities, brStats, dateBR, int, stateGov, ufStats } from "@/lib/data";
import { REGIONS, UFS, getUf } from "@/lib/geo";

export const metadata: Metadata = {
  title: "Dados abertos",
  description: "Baixe a base do Radar MDE em CSV (padrão ou Excel Brasil) ou JSON: um registro por município e ano, com dicionário e forma de citar.",
  alternates: { canonical: "/dados" },
};

const pctFmt = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const head = "h-10 px-4 text-[13px] font-medium text-muted-foreground";


/** State governments' years without an MDE declaration in the SIOPE open data (JOR-13). */
function stateGaps() {
  return UFS.map((u) => ({ u, gaps: YEARS.filter((y) => stateGov(u.uf)?.years[y]?.mde == null) })).filter((x) => x.gaps.length);
}

/** Collapse [2016, 2017, 2018, 2020] into "2016–2018, 2020". */
function yearRanges(ys: number[]) {
  const out: string[] = [];
  for (let i = 0; i < ys.length; i++) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    out.push(j > i ? `${ys[i]}–${ys[j]}` : String(ys[i]));
    i = j;
  }
  return out.join(", ");
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-[12.5px] leading-5 break-words whitespace-pre-wrap text-foreground">
      {children}
    </pre>
  );
}

function Callout({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card px-4 py-3.5 text-[14px] leading-6 text-muted-foreground">
      <Info className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function H2({ id, children, description }: { id: string; children: ReactNode; description?: ReactNode }) {
  return (
    <div className="max-w-3xl pt-4">
      <h2 id={id} className="scroll-mt-24 text-xl font-medium tracking-[-0.02em]">{children}</h2>
      {description && <p className="mt-1.5 text-[15px] leading-[26px] text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function Page() {
  const st = brStats();
  const last = YEARS.length - 1;
  const lastYear = YEARS[last];
  const extracted = dateBR(META.extracted);
  const cov = (s: { reported: number; n: number }) => (s.n ? (s.reported / s.n) * 100 : 0);
  const newer = allCities().filter((c) => c.since);
  const gaps = stateGaps();
  const year = META.updated.slice(0, 4);
  const abnt = `RADAR MDE · BRASIL. Aplicação em manutenção e desenvolvimento do ensino nos municípios brasileiros, ${YEARS[0]}–${lastYear}. Base de dados, versão ${META.version}. Dados de FNDE/SIOPE, Tesouro Nacional/SICONFI e IBGE. Licença ${META.license}. Disponível em: ${SITE_URL}/dados.`;
  const bibtex = `@misc{radarmde${year},
  title        = {Radar MDE · Brasil: aplicação em MDE nos municípios brasileiros, ${YEARS[0]}--${lastYear}},
  year         = {${year}},
  note         = {Base de dados, versão ${META.version}. Fontes: FNDE/SIOPE, Tesouro Nacional/SICONFI, IBGE. Licença ${META.license}},
  howpublished = {\\url{${SITE_URL}/dados}}
}`;

  return (
    <>
      <PageHeader
        title="Dados abertos"
        description={
          <>
            Toda a base usada no painel, um registro por município e ano ({YEARS[0]}–{lastYear}). Use à vontade em reportagens, pesquisas e
            conselhos (licença {META.license}), citando as fontes originais.
          </>
        }
        actions={
          <>
            <Button nativeButton={false} render={<a href={csvHref("brasil")} download />}>
              <Download data-icon="inline-start" />
              CSV · Brasil inteiro
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href={csvHref("brasil", true)} download />}>
              <FileSpreadsheet data-icon="inline-start" />
              Excel Brasil
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/data/municipios.json" />}>
              <Braces data-icon="inline-start" />
              JSON compacto
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Municípios" value={int(st[last].n)} sub="um arquivo por UF, região ou o país inteiro" />
          <Stat label="Exercícios" value={<span className="tnum">{YEARS.length}</span>} sub={`${YEARS[0]} a ${lastYear}`} />
          <Stat label={`Cobertura em ${lastYear}`} value={pctFmt(cov(st[last]))} sub={`${int(st[last].reported)} com dados de MDE`} />
          <Stat label="Extraído em" value={<span className="tnum">{extracted}</span>} sub={`versão ${META.version}`} />
        </div>

        <div className="max-w-3xl">
          <Callout title="Formato dos arquivos">
            <p>
              <strong className="font-medium text-foreground">CSV padrão</strong>: UTF-8 com BOM, vírgula como separador e ponto decimal
              (padrão internacional, para R, Stata, Python e Google Planilhas). <strong className="font-medium text-foreground">Excel Brasil</strong>:
              ponto e vírgula como separador e vírgula decimal, abre direto em colunas no Excel em português. Valores em R$ são{" "}
              <strong className="font-medium text-foreground">nominais</strong> (reais da época); as colunas terminadas em{" "}
              <code className="font-mono text-[12.5px] text-foreground">_real</code> trazem os mesmos valores em R$ de {META.ipca.base},
              corrigidos pelo IPCA. Célula vazia = sem dado ou não
              estimável, nunca zero.
            </p>
            <Code>{`# R
d <- readr::read_csv("radar-mde-brasil.csv")
# Stata
import delimited "radar-mde-brasil.csv", encoding(utf8) clear
# Python
d = pandas.read_csv("radar-mde-brasil.csv", encoding="utf-8-sig")`}</Code>
          </Callout>
        </div>

        <H2 id="regioes" description="Mesmas colunas do arquivo do Brasil, só com os municípios da região. O arquivo de estados traz a declaração de cada governo estadual (e do Distrito Federal).">
          Por região e governos estaduais
        </H2>
        <ul className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...REGIONS.map((r) => ({ id: `regiao-${r.slug}`, label: `Região ${r.name}`, sub: `${r.ufs.length} UFs` })), { id: "estados", label: "Governos estaduais", sub: "27 declarações por ano" }].map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm">
              <a href={csvHref(f.id)} download className="flex min-w-0 flex-1 items-center gap-2 font-medium hover:underline">
                <Download className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{f.label}</span>
              </a>
              <a href={csvHref(f.id, true)} download className="shrink-0 rounded-sm px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline" aria-label={`${f.label}: CSV para Excel Brasil`}>
                Excel
              </a>
            </li>
          ))}
        </ul>

        <H2 id="por-estado" description={`CSV com todas as colunas do dicionário abaixo (para a versão Excel Brasil, acrescente “-excel” ao endereço, ex.: /dados/csv/sp-excel). A barra mostra a cobertura de ${lastYear}: municípios com dados de MDE sobre o total.`}>
          Por estado
        </H2>
        <div className="space-y-6">
          {REGIONS.map((r) => (
            <section key={r.key} aria-labelledby={`reg-${r.key}`}>
              <h3 id={`reg-${r.key}`} className="mb-2 text-[13px] font-medium text-muted-foreground">
                {r.name}
              </h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {r.ufs.map((uf) => {
                  const s = ufStats(uf)[last];
                  const c = cov(s);
                  return (
                    <li key={uf}>
                      <a
                        href={csvHref(uf)}
                        download
                        className="group flex flex-col gap-2.5 rounded-lg border bg-card p-3 transition-colors duration-150 hover:bg-accent/60"
                      >
                        <span className="flex items-center gap-2">
                          <span className="rounded-sm border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{uf}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{getUf(uf)!.name}</span>
                          <Download className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
                          <span className="sr-only">Baixar CSV</span>
                        </span>
                        <span className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Progress value={c} aria-label={`Cobertura ${pctFmt(c)}`} className="flex-1" />
                          <span className="shrink-0 tnum">
                            {int(s.n)} mun. · {pctFmt(c)}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <H2 id="cobertura" description="Um ano só entra no painel quando ao menos 85% dos municípios do país têm dados. O total de cada ano conta só os municípios que já existiam.">
          Cobertura nacional por exercício
        </H2>
        <Panel divided className="max-w-3xl">
          <Table className="tnum">
            <TableCaption className="sr-only">Cobertura nacional por exercício: municípios, com dados de MDE, que não declararam e cobertura</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={head}>Ano</TableHead>
                <TableHead scope="col" className={`${head} hidden text-right sm:table-cell`}>Municípios</TableHead>
                <TableHead scope="col" className={`${head} text-right`}>Com dados de MDE</TableHead>
                <TableHead scope="col" className={`${head} text-right`}>Não declararam</TableHead>
                <TableHead scope="col" className={`${head} w-48`}>Cobertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...YEARS].reverse().map((y) => {
                const s = st[YEARS.indexOf(y)];
                const c = cov(s);
                return (
                  <TableRow key={y} className="hover:bg-accent/60">
                    <TableCell className="px-4 font-mono text-[13px]">{y}</TableCell>
                    <TableCell className="hidden px-4 text-right text-muted-foreground sm:table-cell">{int(s.n)}</TableCell>
                    <TableCell className="px-4 text-right">{int(s.reported)}</TableCell>
                    <TableCell className="px-4 text-right text-muted-foreground">{int(s.nd + s.missing)}</TableCell>
                    <TableCell className="px-4">
                      <span className="flex items-center gap-3">
                        <Progress value={c} aria-label={`Cobertura ${pctFmt(c)}`} className="flex-1" />
                        <span className="w-12 text-right">{pctFmt(c)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>

        <H2 id="dicionario" description="Colunas dos arquivos CSV, na ordem em que aparecem. A exportação do Explorar usa os mesmos nomes e códigos, com parte das colunas. Valores em R$ são nominais.">
          Dicionário
        </H2>
        <Panel divided className="max-w-3xl">
          <Table>
            <TableCaption className="sr-only">Dicionário das colunas dos arquivos CSV</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={`${head} w-56`}>Campo</TableHead>
                <TableHead scope="col" className={head}>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CSV_COLUMNS.map(({ key: k, label: d }) => (
                <TableRow key={k} className="hover:bg-accent/60">
                  <TableCell className="px-4 py-3 align-top font-mono text-[12.5px] whitespace-normal text-foreground">{k}</TableCell>
                  <TableCell className="px-4 py-3 text-[13.5px] leading-[22px] whitespace-normal text-muted-foreground [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-foreground">
                    {d}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <div className="max-w-3xl space-y-3">
          <Callout title="Municípios criados depois de 2008">
            {newer.map((c, i) => (
              <span key={c.id}>
                {i ? (i === newer.length - 1 ? " e " : ", ") : ""}
                {c.name} ({c.uf}, {c.since})
              </span>
            ))}{" "}
            não têm registro nos anos anteriores à instalação: não existiam, então não entram como “não declarou” nem no total de
            municípios daqueles anos.
          </Callout>
          <Callout title="Brasília e Fernando de Noronha">
            Brasília (DF) usa a declaração do Distrito Federal, que acumula competências de estado e município. Fernando de Noronha (PE) é
            distrito estadual, sem orçamento municipal, e fica fora da contagem.
          </Callout>
          <Callout title="Lacunas dos governos estaduais">
            Os dados abertos do SIOPE não trazem declaração de MDE destes governos estaduais nestes anos:{" "}
            {gaps.map(({ u, gaps: g }, i) => (
              <span key={u.uf}>
                {i ? "; " : ""}
                {u.name} ({yearRanges(g)})
              </span>
            ))}
            . Nesses anos o painel mostra “sem dado” para o governo do estado.
          </Callout>
        </div>

        <H2 id="citar" description={`Cite as fontes originais (FNDE/SIOPE, Tesouro Nacional/SICONFI, IBGE) e o Radar MDE como forma de acesso. Os dados derivados estão sob a licença ${META.license}.`}>
          Como citar
        </H2>
        <div className="max-w-3xl space-y-4 pb-4 text-[14px] leading-6 text-muted-foreground">
          <Citations abnt={abnt} bibtex={bibtex} />
          <p>
            Versão dos dados <code className="font-mono text-[12.5px] text-foreground">{META.version}</code>: arquivos do SIOPE extraídos em{" "}
            {extracted}, base gerada em {dateBR(META.updated)}. População: {META.popSource}, a mesma para todos os anos. Licença:{" "}
            <a href={META.licenseUrl} className="font-medium text-brand-ink underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              {META.license}
            </a>
            .
          </p>
        </div>
      </PageBody>
    </>
  );
}
