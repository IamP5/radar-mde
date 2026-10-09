"use client";

import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Plain-language definitions for the jargon on the city page (CIT-05). Tap or click to open; no hover needed. */
export const GLOSSARY = {
  mde: {
    term: "MDE",
    text: "Manutenção e Desenvolvimento do Ensino: o dinheiro de impostos que a prefeitura usa em educação (escolas, professores, transporte escolar, material). A Constituição (art. 212) exige pelo menos 25% da receita de impostos.",
  },
  pp: {
    term: "Pontos percentuais",
    text: "A diferença entre duas porcentagens. Passar de 20% para 25% é subir 5 pontos percentuais (p.p.).",
  },
  fundeb: {
    term: "Fundeb",
    text: "Fundo que junta parte dos impostos e redistribui o dinheiro para a educação básica. Pelo menos 70% dele (60% até 2020) deve pagar os profissionais da educação. O percentual pode passar de 100% quando a prefeitura também usa saldo do ano anterior.",
  },
  deficit: {
    term: "Déficit não compensado",
    text: "Estimativa do Radar: soma o que faltou para chegar a 25% em cada ano abaixo do mínimo e desconta o que foi aplicado acima de 25% nos anos seguintes. Valores em reais da época, sem correção pela inflação.",
  },
  mediana: {
    term: "Mediana",
    text: "O valor do meio: metade dos municípios aplicou mais que isso e metade aplicou menos. Funciona como o “valor típico”.",
  },
  siope: {
    term: "SIOPE",
    text: "Sistema do FNDE (Ministério da Educação) onde estados e municípios declaram quanto gastam em educação. Os números deste painel vêm de lá; o Tesouro Nacional (SICONFI) é a fonte alternativa.",
  },
  cacs: {
    term: "CACS-Fundeb",
    text: "Conselho de Acompanhamento e Controle Social do Fundeb: pais, alunos, professores e servidores que fiscalizam o uso do dinheiro do Fundeb no município.",
  },
  esic: {
    term: "e-SIC",
    text: "Canal on-line para pedir informações públicas pela Lei de Acesso à Informação. Qualquer pessoa pode usar, sem explicar o motivo.",
  },
  tc: {
    term: "Tribunal de Contas",
    text: "Órgão que analisa as contas da prefeitura e confere se o mínimo da educação foi cumprido. Na Bahia, em Goiás e no Pará é o TCM; nas capitais de São Paulo e do Rio de Janeiro, o tribunal do próprio município; nos demais casos, o TCE do estado.",
  },
  imediata: {
    term: "Região imediata",
    text: "Grupo de municípios vizinhos definido pelo IBGE em torno de uma cidade que concentra comércio e serviços.",
  },
  ec119: {
    term: "EC 119/2022",
    text: "Emenda Constitucional aprovada por causa da pandemia: quem aplicou menos de 25% em 2020 ou 2021 não é punido se completar a diferença até o fim de 2023.",
  },
  nd: {
    term: "Não declarou",
    text: "O município não enviou os dados do ano ao SIOPE nem ao Tesouro. Sem eles não dá para saber quanto foi para a educação, e a falta de envio é, por si só, um problema de transparência.",
  },
  creche: {
    term: "Creche",
    text: "Educação infantil para crianças de até 3 anos. O número é o gasto por aluno, com a matrícula que o município declarou.",
  },
  pre: {
    term: "Pré-escola",
    text: "Educação infantil para crianças de 4 e 5 anos. O número é o gasto por aluno, com a matrícula que o município declarou.",
  },
  fundamental: {
    term: "Fundamental",
    text: "Ensino fundamental, dos anos iniciais aos finais. O número é o gasto por aluno, com a matrícula que o município declarou.",
  },
  eja: {
    term: "EJA",
    text: "Educação de jovens e adultos: quem não terminou a escola na idade prevista. O número é o gasto por aluno, com a matrícula que o município declarou.",
  },
  ee: {
    term: "Educação especial",
    text: "Gasto por aluno com educação especial, com a matrícula que o município declarou. O atendimento educacional especializado (AEE) é outra forma de contar esse atendimento.",
  },
} as const;
export type GlossaryKey = keyof typeof GLOSSARY;

/** Inline term with a dotted underline that opens a short definition. */
export function Term({ k, children, className }: { k: GlossaryKey; children?: ReactNode; className?: string }) {
  const g = GLOSSARY[k];
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "-my-0.5 cursor-help rounded-sm py-0.5 underline decoration-current/40 decoration-dotted underline-offset-[3px] outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring/60 print:no-underline",
          className,
        )}
        aria-label={`${typeof children === "string" ? children : g.term}: o que é?`}
      >
        {children ?? g.term}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] gap-1 text-[0.8125rem] leading-5">
        <div className="font-medium text-foreground">{g.term}</div>
        <p className="text-muted-foreground">{g.text}</p>
      </PopoverContent>
    </Popover>
  );
}
