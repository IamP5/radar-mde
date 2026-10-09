import { ArrowUpRight, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { META, YEARS, allCities, dateBR, int, stateGov } from "@/lib/data";
import { stageFieldYears } from "@/lib/etapas";
import { STAGE_FIELDS } from "@/lib/etapas-fields";
import { fundebFile } from "@/lib/fundeb";
import { UFS } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Metodologia",
  description: "De onde vêm os números do Radar MDE, quais indicadores do SIOPE são usados, como o painel calcula o que faltou aplicar e quais são os limites dos dados.",
  alternates: { canonical: "/sobre" },
};

const fmtFactor = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function yearPhrase(years: number[]) {
  const s = [...years].sort((a, b) => a - b);
  if (!s.length) return "em nenhum ano";
  const contiguous = s.every((y, i) => i === 0 || y === s[i - 1] + 1);
  if (contiguous && s.length > 1) return `de ${s[0]} a ${s[s.length - 1]}`;
  return `em ${s.join(", ")}`;
}

/** SIOPE indicators used, with how the panel uses each one. */
const INDICATORS: [string, string, string][] = [
  ["1.1", "% de aplicação das receitas de impostos e transferências em MDE", "Percentual principal (mínimo 25%)"],
  ["1.2", "% do Fundeb aplicado na remuneração dos profissionais da educação", "Fundeb para profissionais (mínimo 60% até 2020, 70% desde 2021)"],
  ["1.4", "% do Fundeb não aplicado no exercício", "Fundeb deixado para o ano seguinte (máximo 5% / 10%)"],
  ["2.8", "% da despesa com educação na despesa total do ente", "Só no CSV (educacao_pct_despesa_total); ainda não aparece nas páginas"],
  ["4.9", "Investimento educacional por aluno (R$)", "Por aluno; o número de alunos é o declarado pelo próprio ente ao SIOPE"],
  ["8.1", "Mínimo de 25% das receitas de impostos a aplicar em MDE (R$)", "Receita de impostos (base) = 8.1 ÷ 0,25, desde 2020"],
  ["8.2", "Valor aplicado em MDE (R$)", "R$ aplicado, desde 2020"],
];

const TOC = [
  { id: "origem", label: "Origem" },
  { id: "o-que-e-medido", label: "O que é medido" },
  { id: "fontes", label: "De onde vêm os dados" },
  { id: "indicadores", label: "Indicadores do SIOPE" },
  { id: "niveis", label: "Do Brasil ao município" },
  { id: "calculos", label: "Cálculos" },
  { id: "limites", label: "Limites" },
  { id: "como-citar", label: "Versão e como citar" },
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
  const newer = allCities().filter((c) => c.since);
  const mgGaps = YEARS.filter((y) => stateGov("MG")?.years[y]?.mde == null);
  const otherGaps = UFS.filter((u) => u.uf !== "MG")
    .map((u) => ({ name: u.name, ys: YEARS.filter((y) => stateGov(u.uf)?.years[y]?.mde == null) }))
    .filter((x) => x.ys.length);
  const nSau = allCities().filter((c) => Object.values(c.years).some((r) => r?.sau != null)).length;
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
            Este painel tenta resolver a parte da transparência para os {int(allCities().length)} municípios brasileiros, permitindo ir do retrato nacional às
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
              <TableCaption className="sr-only">Regras legais de aplicação mínima até 2020 e desde 2021</TableCaption>
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
            na API de dados abertos do FNDE. Até 2016 a declaração era anual; desde 2017 usamos o 6º bimestre (ano fechado). Os indicadores
            usados estão na <a href="#indicadores">tabela abaixo</a>. A participação da educação no gasto total (2.8) está só no CSV; as
            páginas ainda não a mostram.
          </p>
          <p>
            <strong>Checagem cruzada: SICONFI</strong>, o Relatório Resumido da Execução Orçamentária (RREO, Anexo 14) enviado ao Tesouro
            Nacional. Por ora, só foi baixado para os municípios de São Paulo. Quando o percentual do Tesouro difere do SIOPE em 1 ponto ou
            mais, o painel mostra os dois (marcados com ≠): relatórios oficiais que não batem também são um problema de transparência. Para
            poucos municípios de São Paulo sem declaração ao SIOPE, o SICONFI é a fonte do percentual. O mesmo relatório traz o % aplicado em
            saúde, mas só para {int(nSau)} municípios paulistas e de forma irregular (a maioria em 2016 e 2025); fora de SP não há dado de
            saúde.
          </p>
          <Callout title="Números declarados">
            Os números são <strong>declarados pelo próprio município</strong>. A mesma base traz a declaração de cada{" "}
            <strong>governo estadual</strong>, mostrada nas páginas dos estados. Brasília usa a declaração do Distrito Federal, que acumula as
            competências de estado e município. Grandes regiões, estados, regiões intermediárias e imediatas, população e malhas dos mapas vêm
            do IBGE.
          </Callout>
          <p>
            <strong>População</strong>: uma única estimativa, do {META.popSource}, usada em todos os anos. Totais como “moram nesses
            municípios” em anos antigos usam a população de hoje.
          </p>

          <h3 className="text-base font-semibold">Complementação da União no Fundeb</h3>
          <p>
            Desde a Lei 14.113/2020 (arts. 5, 13 e 16), a União complementa redes cujo valor anual total por aluno (VAAT) fica abaixo de um piso
            nacional (VAAT-MIN). Uma parcela dessa complementação (IEI) deve ir para a educação infantil. Outra parcela (VAAR) só aparece para as
            redes que a publicação oficial lista como beneficiárias. Os números são os da portaria, em reais nominais do exercício, sem correção pelo
            IPCA. Um município ausente do arquivo aparece como “sem dado”.
          </p>
          <ul>
            {fundebFile().years.map((y) => {
              const pub = fundebFile().publications[String(y)];
              return (
                <li key={y}>
                  {y}: {pub.label}, {pub.portaria}.{" "}
                  <a href={pub.page} target="_blank" rel="noreferrer">
                    Fonte no FNDE
                  </a>
                  {pub.note ? ` ${pub.note}` : ""}
                </li>
              );
            })}
          </ul>

          <h2 id="indicadores">Indicadores do SIOPE usados</h2>
          <p>
            Códigos e nomes como aparecem na API de dados abertos do FNDE (<code>Indicadores_Siope</code>), para quem quiser refazer a série.
          </p>
          <div className="my-6 overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableCaption className="sr-only">Indicadores do SIOPE usados no painel: código, nome e uso</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={`${head} w-14`}>Código</TableHead>
                  <TableHead scope="col" className={head}>Indicador</TableHead>
                  <TableHead scope="col" className={head}>Uso no painel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[14px]">
                {INDICATORS.map(([code, name, use]) => (
                  <TableRow key={code} className="hover:bg-accent/60">
                    <TableCell className="px-4 align-top font-mono text-[13px] text-foreground">{code}</TableCell>
                    <TableCell className="px-4 align-top whitespace-normal">{name}</TableCell>
                    <TableCell className="px-4 align-top whitespace-normal">{use}</TableCell>
                  </TableRow>
                ))}
                {STAGE_FIELDS.map((f) => (
                  <TableRow key={f.siope} className="hover:bg-accent/60">
                    <TableCell className="px-4 align-top font-mono text-[13px] text-foreground">{f.siope}</TableCell>
                    <TableCell className="px-4 align-top whitespace-normal">{f.dict.split(". O 0")[0]}</TableCell>
                    <TableCell className="px-4 align-top whitespace-normal">
                      {f.kind === "money"
                        ? "Gasto por etapa, por aluno"
                        : f.id === "fuEi" || f.id === "fuEf"
                          ? "Parte do Fundeb nesta etapa. Pode passar de 100% e não soma 100% com a outra."
                          : "Parte do gasto total com educação"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p>
            Os valores por aluno de cada etapa usam a matrícula que o município declarou ao SIOPE, não o Censo Escolar. O 0 é tratado como
            ausente, assim como um valor fora da faixa esperada. O gasto por aluno das etapas fica de fora abaixo de R$ 100 ou acima de
            R$ 200.000. Material didático por aluno fica de fora acima de R$ 5.000, porque o valor típico fica perto de R$ 30. A parcela
            do Fundeb em uma etapa pode passar de 100%, como o percentual pago a profissionais, e fica de fora acima de 200%. Os
            indicadores 4.14 e 4.15 não existem nos anos mais antigos da série. Na base, 4.14 ocorre {yearPhrase(stageFieldYears("cre"))} e
            4.15 ocorre {yearPhrase(stageFieldYears("pre"))}.
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
              <strong>R$ aplicado</strong>: desde 2020, o valor declarado (8.2). Antes de 2020 o SIOPE não publica esse valor, e o painel{" "}
              <strong>estima</strong> receita × percentual (marcado como estimado; no CSV, <code>aplicado_estimado = 1</code>). Também é
              estimado quando o valor declarado não bate com o percentual declarado (diferença acima de 1 ponto); o percentual é o número
              oficial.
            </li>
            <li>
              <strong>Faltou</strong> = (25% − percentual aplicado) × base, quando o percentual é menor que 25%. Sem declaração, ou abaixo de
              25% sem receita declarada, o valor não é estimável e fica vazio (nunca zero).
            </li>
            <li>
              <strong>Por aluno</strong>: indicador 4.9 do SIOPE. O denominador é o número de matrículas que o próprio ente declarou ao SIOPE,
              não o Censo Escolar; erros nessa contagem geram valores muito altos ou muito baixos.
            </li>
            <li>
              <strong>Valores monetários</strong>: os R$ mostrados são, por padrão, <strong>nominais</strong> (reais de cada ano). Somas
              de vários anos (saldo devedor, maiores déficits acumulados, série do que faltou) misturam reais de anos diferentes; por isso
              o painel também oferece esses valores <strong>corrigidos pelo IPCA</strong>, em R$ de {META.ipca.base}. A correção usa o
              número-índice do IPCA do IBGE (SIDRA, tabela 1737), baixado em {dateBR(META.ipca.fetched)}: cada valor é multiplicado pela
              média anual do índice em {META.ipca.base} dividida pela média anual do índice no seu ano. Por exemplo, R$ 1 de {YEARS[0]}{" "}
              equivale a R$ {fmtFactor(META.ipca.factor[String(YEARS[0])])} de {META.ipca.base}. No CSV, a coluna <code>ipca_fator</code> e
              as colunas terminadas em <code>_real</code> trazem a conversão.
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
              declarou”; investimento por aluno abaixo de R$ 100 ou acima de R$ 200 mil é descartado como erro de preenchimento. Fernando de
              Noronha (PE) é distrito estadual, sem orçamento municipal, e fica fora da contagem.
            </li>
            <li>
              <strong>Valores fora do padrão</strong> são marcados, não apagados, e continuam nos totais e medianas. A marca compara o valor
              com a <strong>própria história do município</strong>, não com uma faixa fixa:
              <ul>
                <li>
                  <strong>% em MDE</strong>: um ano isolado que se afasta 10 pontos ou mais da mediana dos dois anos anteriores e dos dois
                  seguintes e fica abaixo de 15% ou acima de 40%. Aplicação baixa que se repete por vários anos é tratada como real, e não
                  é marcada.
                </li>
                <li>
                  <strong>Por aluno</strong>: valor muito acima (mais de 2,5 vezes) ou abaixo (menos de 0,4 vez) do nível habitual do
                  município (comparado à mediana nacional de cada ano), ou um salto de mais de 2,5 vezes (ou queda para menos de 0,4 vez)
                  em relação ao ano anterior que não seja a volta ao nível de dois anos antes. Também é marcado o pico (ou vale) de um
                  ano só: valor mais de 2 vezes acima (ou abaixo da metade) dos dois anos vizinhos, ou um salto de 2,5 vezes para dentro
                  ou para fora do ano quando o ano anterior e o seguinte estão no mesmo nível.
                </li>
                <li>
                  <strong>Receita de impostos</strong>: 2,5 vezes acima ou abaixo da mediana dos anos vizinhos (o valor em R$ que faltou
                  fica duvidoso).
                </li>
              </ul>
              A marca diz “fora do padrão — confirme na fonte”. Só quando o valor é fisicamente improvável (MDE abaixo de 5% ou acima de 60%,
              ou por aluno mais de 8 vezes a mediana nacional do ano) o painel fala em possível erro de declaração.
            </li>
            <li>
              <strong>Municípios criados depois de 2008</strong>:{" "}
              {newer.map((c, i) => (
                <span key={c.id}>
                  {i ? (i === newer.length - 1 ? " e " : ", ") : ""}
                  {c.name} ({c.uf}, instalado em {c.since})
                </span>
              ))}
              . Nos anos anteriores eles não existiam: aparecem como “não existia”, não como “não declarou”, e ficam fora do total de
              municípios daqueles anos.
            </li>
            <li>
              <strong>Governos estaduais</strong>: os dados abertos do SIOPE não trazem a declaração do governo de Minas Gerais em{" "}
              {mgGaps.join(", ")}
              {otherGaps.length > 0 && (
                <>
                  {" "}
                  (nem de {otherGaps.map((g) => `${g.name} em ${g.ys.join(", ")}`).join("; ")})
                </>
              )}
              . Nesses anos o painel mostra “sem dado” para o estado.
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

          <h2 id="como-citar">Versão e como citar</h2>
          <p>
            Versão dos dados <code>{META.version}</code>: arquivos do SIOPE extraídos em {dateBR(META.extracted)}. Os dados derivados estão
            sob a licença{" "}
            <a href={META.licenseUrl} target="_blank" rel="noreferrer">
              {META.license}
            </a>
            . Cite as fontes originais (FNDE/SIOPE, Tesouro Nacional/SICONFI e IBGE) e o Radar MDE como forma de acesso; a{" "}
            <Link href="/dados#citar">página de dados</Link> tem a referência pronta em ABNT e BibTeX.
          </p>

          <h2 id="proximos-passos">Próximos passos</h2>
          <ul>
            <li>Alertas por e-mail quando um município acompanhado publicar novo relatório.</li>
            <li>Conferir o gasto por aluno com as matrículas do Censo Escolar/INEP e comparar com o CAQ.</li>
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
