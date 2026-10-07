import { ArrowUpRight, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Metodologia" };

const TOC = [
  { id: "origem", label: "Origem" },
  { id: "o-que-e-medido", label: "O que é medido" },
  { id: "fontes", label: "De onde vêm os dados" },
  { id: "niveis", label: "Do Brasil ao município" },
  { id: "calculos", label: "Cálculos" },
  { id: "limites", label: "Limites" },
  { id: "proximos-passos", label: "Próximos passos" },
];

function Callout({ tone = "info", title, children }: { tone?: "info" | "warning"; title?: ReactNode; children: ReactNode }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div className={cn("my-6 flex gap-3 rounded-lg border px-4 py-3.5 text-[14px] leading-6", tone === "warning" ? "border-warning/30 bg-warning-soft" : "bg-card")}>
      <Icon className={cn("mt-1 size-4 shrink-0", tone === "warning" ? "text-warning-ink" : "text-brand")} aria-hidden />
      <div className="text-muted-foreground">
        {title && <div className="font-medium text-foreground">{title}</div>}
        {children}
      </div>
    </div>
  );
}

const head = "h-10 px-4 text-[13px] font-medium text-muted-foreground";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Metodologia"
        description="De onde vêm os números, como o painel calcula o que faltou aplicar e o que ele ainda não consegue dizer."
      />
      <PageBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-12 lg:space-y-0">
        <article
          className={cn(
            "max-w-3xl min-w-0 text-[15px] leading-[26px] text-muted-foreground",
            "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground [&_h2:first-child]:mt-0",
            "[&_p]:my-4 [&_strong]:font-medium [&_strong]:text-foreground",
            "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:pl-1 [&_li]:marker:text-subtle",
            "[&_code]:rounded-sm [&_code]:border [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground",
            "[&_a]:font-medium [&_a]:text-brand-ink [&_a]:underline-offset-2 [&_a:hover]:underline",
          )}
        >
          <h2 id="origem">Origem</h2>
          <p>
            O Radar MDE nasceu da tese de doutorado de <strong>Adriana Zanini da Silva</strong>,{" "}
            <a href="https://bibliotecatede.uninove.br/bitstream/tede/2464/2/Adriana%20Zanini%20da%20Silva.pdf" target="_blank" rel="noreferrer">
              <em>
                O financiamento da Educação Básica no Brasil contemporâneo: avanços e contradições revelados nos gastos da educação de Santo
                André
              </em>
              <ArrowUpRight className="ml-0.5 inline size-3.5 align-[-2px]" aria-hidden />
            </a>{" "}
            (UNINOVE, 2021). Analisando Santo André de 2010 a 2019, a autora encontrou anos com aplicação abaixo dos 25% sem compensação
            posterior, um portal da transparência “de difícil acesso e compreensão” e conselhos de controle social sem informação para agir.
            Este painel tenta resolver a parte da transparência para os 5.570 municípios brasileiros, permitindo ir do retrato nacional às
            regiões, aos estados e a cada cidade.
          </p>

          <h2 id="o-que-e-medido">O que é medido</h2>
          <p>
            <strong>MDE (art. 212 da Constituição):</strong> municípios devem aplicar ao menos 25% da receita resultante de impostos, incluindo
            transferências, na manutenção e desenvolvimento do ensino. O descumprimento pode levar à intervenção estadual (art. 35, III).
          </p>
          <p>
            <strong>Fundeb em remuneração:</strong> ao menos 70% dos recursos do Fundeb devem pagar profissionais da educação básica (Lei
            14.113/2020). Até 2020 a regra era 60% para o magistério.
          </p>
          <div className="my-6 overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={head}>Regra</TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>Até 2020</TableHead>
                  <TableHead scope="col" className={`${head} text-right`}>Desde 2021</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[14px] tnum">
                <TableRow className="hover:bg-accent/60">
                  <TableCell className="px-4 whitespace-normal text-foreground">Aplicação mínima em MDE</TableCell>
                  <TableCell className="px-4 text-right">25%</TableCell>
                  <TableCell className="px-4 text-right">25%</TableCell>
                </TableRow>
                <TableRow className="hover:bg-accent/60">
                  <TableCell className="px-4 whitespace-normal text-foreground">Fundeb para profissionais (mínimo)</TableCell>
                  <TableCell className="px-4 text-right">60%</TableCell>
                  <TableCell className="px-4 text-right">70%</TableCell>
                </TableRow>
                <TableRow className="hover:bg-accent/60">
                  <TableCell className="px-4 whitespace-normal text-foreground">Fundeb deixado para o ano seguinte (máximo)</TableCell>
                  <TableCell className="px-4 text-right">5%</TableCell>
                  <TableCell className="px-4 text-right">10%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <h2 id="fontes">De onde vêm os dados</h2>
          <p>
            <strong>Fonte principal: SIOPE</strong> (Sistema de Informações sobre Orçamentos Públicos em Educação, do FNDE), sistema oficial
            onde cada município declara suas receitas e despesas com educação. A série começa em <strong>2008</strong>, primeiro ano publicado
            na API de dados abertos do FNDE. Até 2016 a declaração era anual; desde 2017 usamos o 6º bimestre (ano fechado). Indicadores: %
            aplicado em MDE, % do Fundeb em remuneração, Fundeb não utilizado, investimento por aluno e participação da educação no gasto
            total.
          </p>
          <p>
            <strong>Checagem cruzada e anos anteriores: SICONFI</strong>, o Relatório Resumido da Execução Orçamentária (RREO, Anexo 14)
            enviado ao Tesouro Nacional. Quando o percentual do Tesouro difere do SIOPE em 1 ponto ou mais, o painel mostra os dois (marcados
            com ≠): relatórios oficiais que não batem também são um problema de transparência. O SICONFI também fornece o % aplicado em saúde
            (desde 2015).
          </p>
          <Callout title="Números declarados">
            Os números são <strong>declarados pelo próprio município</strong>. A mesma base traz a declaração de cada{" "}
            <strong>governo estadual</strong>, mostrada nas páginas dos estados. Brasília usa a declaração do Distrito Federal, que acumula as
            competências de estado e município. Grandes regiões, estados, regiões intermediárias e imediatas, população e malhas dos mapas vêm
            do IBGE.
          </Callout>
          <p>
            O cruzamento com o Tesouro (SICONFI) e o percentual em saúde estão disponíveis, por ora, apenas para os municípios de São Paulo,
            onde o painel começou.
          </p>

          <h2 id="niveis">Do Brasil ao município</h2>
          <ul>
            <li>
              <strong>Brasil e regiões</strong>: quantos municípios ficaram abaixo de 25%, quanto deixou de ir para a educação, a mediana
              aplicada e a evolução desde 2008. O mapa alterna entre estados e os 5.570 municípios.
            </li>
            <li>
              <strong>Estados</strong>: os municípios do estado no mapa e em tabela filtrável, comparados com a região e o país, e o percentual
              aplicado pelo próprio governo estadual.
            </li>
            <li>
              <strong>Municípios</strong>: série completa, posição no estado e no país, vizinhos e modelos de pedidos de informação.
            </li>
            <li>
              O ano escolhido acompanha a navegação (parâmetro <code>?ano=</code> no endereço), para comparar o mesmo exercício em todos os
              níveis.
            </li>
          </ul>

          <h2 id="calculos">Cálculos</h2>
          <ul>
            <li>
              <strong>Receita de impostos (base)</strong>: desde 2020, o próprio indicador do SIOPE. De 2008 a 2019, somamos as receitas
              realizadas declaradas ao SIOPE que compõem a base do art. 212: impostos municipais (IPTU, ISS, ITBI, IRRF), multas e dívida ativa
              de impostos, FPM, ITR, cota-parte de ICMS, IPVA e IPI-exportação e a compensação da LC 87/96. Em 2020, essa soma coincide com o
              indicador oficial (diferença menor que 2%) em 97% dos municípios.
            </li>
            <li>
              <strong>Faltou</strong> = (25% − percentual aplicado) × base, quando o percentual é menor que 25%.
            </li>
            <li>
              <strong>Saldo devedor (estimativa)</strong>: acumula o que faltou em cada ano e abate o que foi aplicado acima de 25% nos anos
              seguintes, nunca ficando negativo. É a lógica de compensação discutida na tese; não substitui a apuração oficial do Tribunal de
              Contas.
            </li>
            <li>
              <strong>Pandemia</strong>: pela EC 119/2022, a aplicação abaixo do mínimo em 2020 e 2021 não gera punição se compensada até
              2023. Os anos aparecem marcados.
            </li>
          </ul>

          <h2 id="limites">Limites</h2>
          <Callout tone="warning" title="Declarado não é apurado">
            Os Tribunais de Contas (dos estados ou, na BA, GO e PA, dos municípios) podem <strong>glosar despesas</strong> declaradas como MDE.
            O percentual apurado pode ser menor que o declarado; foi o que a tese observou em Santo André com o TCE-SP.
          </Callout>
          <ul>
            <li>
              Antes de 2020 o valor que faltou é uma estimativa feita com a base reconstruída (acima). Quando a receita não foi declarada, o
              painel mostra o percentual mas não estima o valor (—).
            </li>
            <li>
              Até 2020 o Fundeb podia deixar no máximo 5% para o ano seguinte e exigia 60% para o magistério; desde 2021 os limites são 10% e
              70% (Lei 14.113/2020). O painel aplica a regra de cada ano.
            </li>
            <li>
              Um ano só entra no painel quando ao menos 85% dos municípios do país têm dados, para que os totais sejam comparáveis. Na prática,
              a cobertura passa de 97% em todos os anos de 2008 a 2025; a <Link href="/dados#cobertura">página de dados</Link> mostra os
              números exatos.
            </li>
            <li>
              <strong>Limpeza da base</strong>: declarações com 0% em MDE e nenhum outro dado são formulários vazios e contam como “não
              declarou”; investimento por aluno abaixo de R$ 100 ou acima de R$ 200 mil é tratado como erro de preenchimento; o valor aplicado
              em R$ só é mostrado quando bate com o percentual declarado. Fernando de Noronha (PE) é distrito estadual, sem orçamento
              municipal, e fica fora da contagem.
            </li>
            <li>
              Quando um município ficou abaixo de 25% mas não declarou a receita daquele ano, o valor que faltou não é estimado: os totais em
              R$ aparecem como “ao menos” ou “não estimado”.
            </li>
            <li>Retificações enviadas depois da coleta podem não estar refletidas até a próxima atualização.</li>
            <li>
              Cumprir 25% não significa educação de qualidade. A tese defende o Custo Aluno-Qualidade (CAQ) como referência de quanto{" "}
              <em>deveria</em> ser gasto. Uma comparação com o CAQ está no roadmap.
            </li>
          </ul>

          <h2 id="proximos-passos">Próximos passos</h2>
          <ul>
            <li>Alertas por e-mail quando um município acompanhado publicar novo relatório.</li>
            <li>Gasto por aluno (com matrículas do Censo Escolar/INEP) e comparação com o CAQ.</li>
            <li>Percentual apurado pelos Tribunais de Contas ao lado do declarado.</li>
            <li>Cruzamento com o Tesouro (SICONFI) e percentual em saúde para todos os estados.</li>
          </ul>
        </article>

        <aside className="hidden lg:block" aria-label="Nesta página">
          <nav className="sticky top-[calc(var(--header-h)+2rem)]">
            <div className="mb-3 text-[13px] font-medium">Nesta página</div>
            <ul className="space-y-0.5 border-l text-[13px]">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-3 text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground"
                  >
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t pt-4 text-[13px]">
              <Link href="/dados" className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
                Baixar os dados
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </nav>
        </aside>
      </PageBody>
    </>
  );
}
