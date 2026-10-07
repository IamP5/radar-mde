import { Braces, Download, FileSpreadsheet, Info } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { Panel } from "@/components/kit/panel";
import { Stat } from "@/components/kit/stat";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YEARS, UPDATED, brStats, int, ufStats } from "@/lib/data";
import { REGIONS, getUf } from "@/lib/geo";

export const metadata: Metadata = { title: "Dados abertos" };

const pctFmt = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const head = "h-10 px-4 text-[13px] font-medium text-muted-foreground";

const FIELDS: [string, ReactNode][] = [
  ["ibge", "Código IBGE do município (7 dígitos)."],
  ["municipio, uf, regiao", "Nome do município, sigla da UF e grande região."],
  ["regiao_intermediaria, regiao_imediata", "Regiões geográficas do IBGE (2017)."],
  ["populacao", "População do município (IBGE)."],
  ["ano", "Exercício a que se referem os valores."],
  ["situacao", <><code>nao_declarou</code> quando o município não tem dados de MDE para o ano; <code>declarou</code> nos demais casos.</>],
  ["mde_pct", "% da receita de impostos e transferências aplicado em Manutenção e Desenvolvimento do Ensino (mínimo 25%)."],
  ["mde_aplicado_rs", "Valor apurado em MDE no exercício."],
  ["receita_impostos_rs", "Base de cálculo (impostos + transferências constitucionais). Desde 2020, indicador do SIOPE; antes, soma das receitas declaradas ao SIOPE (impostos, FPM, ITR, ICMS, IPVA, IPI-exportação, LC 87/96, dívida ativa e multas de impostos)."],
  ["faltou_rs", "Quanto faltou para atingir 25% (0 se cumpriu)."],
  ["fundeb_pessoal_pct", "% do Fundeb pago aos profissionais (mínimo 60% até 2020, 70% desde 2021)."],
  ["fundeb_minimo_pct", "Mínimo legal de Fundeb para pessoal vigente no ano."],
  ["fundeb_nao_usado_pct", "Parcela do Fundeb deixada para o ano seguinte (máximo 5% até 2020, 10% desde 2021)."],
  ["por_aluno_rs", "Investimento por aluno declarado ao SIOPE (indicador 4.9, valor nominal)."],
  ["saude_pct", "% aplicado em saúde (mínimo 15%), só para municípios de SP (SICONFI)."],
  ["fonte", "Sistema de origem do registro."],
];

function Callout({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card px-4 py-3.5 text-[14px] leading-6 text-muted-foreground">
      <Info className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function H2({ id, children, description }: { id: string; children: ReactNode; description?: ReactNode }) {
  return (
    <div className="max-w-3xl pt-4">
      <h2 id={id} className="scroll-mt-24 text-xl font-semibold tracking-[-0.02em]">{children}</h2>
      {description && <p className="mt-1.5 text-[15px] leading-[26px] text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function Page() {
  const st = brStats();
  const last = YEARS.length - 1;
  const lastYear = YEARS[last];
  const updated = new Date(UPDATED + "T12:00:00").toLocaleDateString("pt-BR");
  const cov = (s: { reported: number; n: number }) => (s.n ? (s.reported / s.n) * 100 : 0);

  return (
    <>
      <PageHeader
        title="Dados abertos"
        description={
          <>
            Toda a base usada no painel, um registro por município e ano ({YEARS[0]}–{lastYear}). Use à vontade em reportagens, pesquisas e
            conselhos, citando as fontes originais.
          </>
        }
        actions={
          <>
            <Button nativeButton={false} render={<a href="/dados/csv/brasil" download />}>
              <Download data-icon="inline-start" />
              CSV · Brasil inteiro
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
          <Stat label="Municípios" value={int(st[last].n)} sub="um arquivo por UF ou o país inteiro" />
          <Stat label="Exercícios" value={<span className="tnum">{YEARS.length}</span>} sub={`${YEARS[0]} a ${lastYear}`} />
          <Stat label={`Cobertura em ${lastYear}`} value={pctFmt(cov(st[last]))} sub={`${int(st[last].reported)} com dados de MDE`} />
          <Stat label="Atualizado em" value={<span className="tnum">{updated}</span>} sub="FNDE/SIOPE, Tesouro/SICONFI e IBGE" />
        </div>

        <div className="max-w-3xl">
          <Callout title="Como citar">
            Os números são declarados pelos próprios municípios ao FNDE/SIOPE, com checagem pelo Tesouro Nacional/SICONFI e territórios e
            população do IBGE. Cite as fontes originais e, se quiser, o Radar MDE como forma de acesso.
          </Callout>
        </div>

        <H2 id="por-estado" description={`CSV com todas as colunas do dicionário abaixo. A barra mostra a cobertura de ${lastYear}: municípios com dados de MDE sobre o total.`}>
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
                        href={`/dados/csv/${uf.toLowerCase()}`}
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

        <H2 id="cobertura" description="Um ano só entra no painel quando ao menos 85% dos municípios do país têm dados.">
          Cobertura nacional por exercício
        </H2>
        <Panel divided className="max-w-3xl">
          <Table className="tnum">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={head}>Ano</TableHead>
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

        <H2 id="dicionario" description="Colunas dos arquivos CSV, na ordem em que aparecem. Valores em R$ são nominais.">
          Dicionário
        </H2>
        <Panel divided className="max-w-3xl">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={`${head} w-56`}>Campo</TableHead>
                <TableHead scope="col" className={head}>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELDS.map(([k, d]) => (
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

        <div className="max-w-3xl">
          <Callout title="Brasília e Fernando de Noronha">
            Brasília (DF) usa a declaração do Distrito Federal, que acumula competências de estado e município. Fernando de Noronha (PE) é
            distrito estadual, sem orçamento municipal, e fica fora da contagem.
          </Callout>
        </div>

        <p className="flex max-w-3xl items-center gap-2 pb-4 text-[13px] text-muted-foreground">
          <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
          Arquivos em UTF-8 com BOM, separados por vírgula: abrem direto no Excel, LibreOffice e Google Planilhas.
        </p>
      </PageBody>
    </>
  );
}
