import "server-only";
import {
  type City,
  type CityYear,
  existedIn,
  MDE_MIN,
  PANDEMIC_YEARS,
  YEARS,
  brlShort,
  deficitTrail,
  fundebLeftMax,
  funMin,
  isAtypical,
  pct,
  shortfall,
  yearsBelow,
} from "./data";
import { getUf, ofUf } from "./geo";

const rec = (c: City, y: number): CityYear | undefined => c.years[y];

/** "2019", "2019 e 2021", "2016, 2019 e 2020 a 2025" (consecutive runs of 3+ collapse to "a"). */
export function listYears(ys: number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < ys.length; ) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    if (j - i >= 2) runs.push(`${ys[i]} a ${ys[j]}`);
    else for (let k = i; k <= j; k++) runs.push(String(ys[k]));
    i = j + 1;
  }
  return runs.length <= 1 ? (runs[0] ?? "") : `${runs.slice(0, -1).join(", ")} e ${runs[runs.length - 1]}`;
}
/** "no exercício de 2021" / "nos exercícios de 2019 e 2021". */
export const exercicios = (ys: number[]) => (ys.length === 1 ? `no exercício de ${ys[0]}` : `nos exercícios de ${listYears(ys)}`);
/** "em 2021" / "em 2019 e 2021". */
export const emAnos = (ys: number[]) => `em ${listYears(ys)}`;

/** Court of accounts that audits a municipality: BA, GO and PA have municipal courts; the capitals of SP and RJ have their own. */
export function tribunal(c: City): { name: string; short: string } {
  if (c.id === 3550308) return { name: "Tribunal de Contas do Município de São Paulo", short: "TCM-SP" };
  if (c.id === 3304557) return { name: "Tribunal de Contas do Município do Rio de Janeiro", short: "TCM-RJ" };
  if (c.uf === "DF") return { name: "Tribunal de Contas do Distrito Federal", short: "TCDF" };
  if (["BA", "GO", "PA"].includes(c.uf)) return { name: `Tribunal de Contas dos Municípios do Estado ${ofUf(c.uf)}`, short: `TCM-${c.uf}` };
  return { name: `Tribunal de Contas do Estado ${ofUf(c.uf)}`, short: `TCE-${c.uf}` };
}

/**
 * Everything the declared data says about a municipality, shared by the "Sinais de alerta" panel and the
 * letters so both always tell the same story.
 */
export function cityFacts(c: City) {
  const existing = YEARS.filter((y) => existedIn(c, y));
  const reported = existing.filter((y) => rec(c, y)?.mde != null);
  const notDelivered = existing.filter((y) => rec(c, y)?.s === "nd");
  const below = yearsBelow(c);
  const belowPandemic = below.filter((y) => PANDEMIC_YEARS.has(y));
  const atypMde = reported.filter((y) => isAtypical(rec(c, y)!.mde) || rec(c, y)?.atip?.includes("mde"));
  const atypBase = reported.filter((y) => rec(c, y)?.atip?.includes("base"));
  const funBelow = existing
    .filter((y) => rec(c, y)?.fun != null && rec(c, y)!.fun! < funMin(y))
    .map((y) => ({ year: y, value: rec(c, y)!.fun!, min: funMin(y) }));
  const funLeft = existing
    .filter((y) => (rec(c, y)?.funLeft ?? 0) > fundebLeftMax(y))
    .map((y) => ({ year: y, value: rec(c, y)!.funLeft!, max: fundebLeftMax(y) }));
  const diverge = existing.filter((y) => rec(c, y)?.alt != null);
  const edge = reported.filter((y) => rec(c, y)!.mde! >= MDE_MIN && rec(c, y)!.mde! < MDE_MIN + 1);
  const trail = deficitTrail(c);
  const carry = trail[trail.length - 1].carry;
  const belowNoBase = below.filter((y) => rec(c, y)?.base == null);
  // the R$ estimate leans on a year whose % or revenue base looks like a filing error
  const carryShaky = carry > 0 && below.some((y) => atypMde.includes(y) || atypBase.includes(y));
  const last = reported[reported.length - 1] ?? null;
  // years after the last declared one with nothing sent (CIT-10: a city that stopped declaring)
  const stopped = last == null ? notDelivered : notDelivered.filter((y) => y > last);
  const sources = new Set(reported.map((y) => rec(c, y)?.src).filter(Boolean));

  // EC 119/2022: 2020–21 shortfalls are not punishable if made up (on top of the 25%) by the end of 2023
  let pandemic: { short: number; surplus: number; state: "compensated" | "open" | "unknown" } | null = null;
  if (belowPandemic.length) {
    const short = belowPandemic.reduce((s, y) => s + shortfall(rec(c, y)), 0);
    const after = [2022, 2023].filter((y) => YEARS.includes(y));
    const unknown = belowPandemic.some((y) => rec(c, y)?.base == null) || after.some((y) => rec(c, y)?.mde == null || rec(c, y)?.base == null);
    const surplus = after.reduce((s, y) => {
      const r = rec(c, y);
      return r?.mde != null && r.base != null ? s + Math.max(0, ((r.mde - MDE_MIN) / 100) * r.base) : s;
    }, 0);
    pandemic = { short, surplus, state: unknown ? "unknown" : surplus >= short ? "compensated" : "open" };
  }
  // shortfalls that still matter legally: outside the pandemic, or pandemic ones not shown to be compensated
  const seriousBelow = below.filter((y) => !PANDEMIC_YEARS.has(y) || pandemic?.state !== "compensated");

  return {
    existing, reported, notDelivered, below, belowPandemic, seriousBelow, atypMde, atypBase, funBelow, funLeft, diverge, edge,
    carry, carryShaky, belowNoBase, last, stopped, sources, pandemic, since: c.since,
  };
}
export type CityFacts = ReturnType<typeof cityFacts>;

export type Template = {
  id: string;
  /** short label for the chooser */
  title: string;
  /** one plain-language sentence: what this does and who can send it */
  who: string;
  to: string;
  /** where and how to send it */
  where: { text: string; links: { label: string; href: string }[] };
  subject: string;
  body: string;
};

const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const SIOPE_URL = "https://www.gov.br/fnde/pt-br/assuntos/sistemas/siope";
const SICONFI_URL = "https://siconfi.tesouro.gov.br";

/** Plain-language request templates citizens, councillors and council members can copy. */
export function buildTemplates(c: City): Template[] {
  const f = cityFacts(c);
  const tc = tribunal(c);
  const df = c.uf === "DF";
  const ufName = getUf(c.uf)!.name;
  // The Distrito Federal has no prefeitura or câmara: a Governo, a Câmara Legislativa and the MPDFT instead
  const ente = df ? "pelo Distrito Federal" : "pelo Município";
  const place = df ? "Distrito Federal" : `Município de ${c.name} (${c.uf})`;
  const ofEnte = df ? "do Distrito Federal" : `do Município de ${c.name}`;
  const mp = df ? "Ministério Público do Distrito Federal e Territórios (MPDFT)" : `Ministério Público ${ofUf(c.uf)}`;

  // ---- facts, in careful wording -------------------------------------------------------------
  const ctx: string[] = [];
  if (f.reported.length === 0) {
    ctx.push(
      f.notDelivered.length
        ? `Não há registro de envio, ${ente}, dos dados de aplicação em Manutenção e Desenvolvimento do Ensino (MDE) ao Sistema de Informações sobre Orçamentos Públicos em Educação (SIOPE/FNDE) nem ao SICONFI/Tesouro Nacional ${exercicios(f.notDelivered)}. Sem esses dados não é possível verificar se o mínimo constitucional de ${MDE_MIN}% foi cumprido, e a falta de envio já é, por si só, um problema de transparência.`
        : `Não foram localizados nos sistemas federais (SIOPE/FNDE e SICONFI/Tesouro Nacional) dados de aplicação em Manutenção e Desenvolvimento do Ensino (MDE) declarados ${ente}. Sem esses dados não é possível verificar se o mínimo constitucional de ${MDE_MIN}% foi cumprido.`,
    );
  } else {
    ctx.push(
      f.below.length
        ? `Segundo os próprios dados declarados ${ente} ao Sistema de Informações sobre Orçamentos Públicos em Educação (SIOPE/FNDE), a aplicação em Manutenção e Desenvolvimento do Ensino (MDE) ficou abaixo do mínimo constitucional de ${MDE_MIN}% ${exercicios(f.below)}.`
        : `Segundo os dados declarados ${ente} ao Sistema de Informações sobre Orçamentos Públicos em Educação (SIOPE/FNDE), o percentual aplicado em Manutenção e Desenvolvimento do Ensino (MDE) ficou igual ou acima do mínimo de ${MDE_MIN}% ${f.reported.length === 1 ? `no único exercício com dados (${f.reported[0]})` : `nos ${f.reported.length} exercícios com dados (${listYears(f.reported)})`}. São dados autodeclarados: a apuração oficial cabe ao ${tc.name} (${tc.short}).`,
    );
    if (f.notDelivered.length) ctx.push(`Não há registro de envio desses dados aos sistemas federais ${exercicios(f.notDelivered)}.`);
    if (f.atypMde.length)
      ctx.push(
        `O percentual declarado ${exercicios(f.atypMde)} (${f.atypMde.map((y) => pct(rec(c, y)!.mde)).join("; ")}) está muito fora da faixa usual e pode conter erro de preenchimento; solicita-se sua confirmação ou retificação.`,
      );
    if (f.pandemic) {
      ctx.push(
        `A Emenda Constitucional nº 119/2022 afastou a responsabilização pelo descumprimento do mínimo em 2020 e 2021, desde que a diferença fosse complementada até o exercício de 2023. ` +
          (f.pandemic.state === "compensated"
            ? "Pelos dados declarados, a aplicação acima de 25% em 2022 e 2023 parece ter coberto essa diferença, o que cabe ao Tribunal de Contas confirmar."
            : f.pandemic.state === "open"
              ? `Pelos dados declarados, a aplicação acima de 25% em 2022 e 2023 não parece suficiente para cobrir essa diferença (estimativa: faltariam cerca de ${brlShort(f.pandemic.short - f.pandemic.surplus)}).`
              : "Os dados disponíveis não permitem estimar se essa complementação foi feita."),
      );
    }
    if (f.carry > 0)
      ctx.push(
        `Por estimativa feita a partir desses dados (valores nominais, sem correção pela inflação), o valor aplicado a menos e ainda não compensado em anos posteriores soma cerca de ${brlShort(f.carry)}${f.carryShaky ? "; esse número depende de valores declarados atípicos e deve ser confirmado" : ""}.`,
      );
  }
  if (f.funBelow.length)
    ctx.push(
      `A parcela do Fundeb destinada à remuneração dos profissionais da educação ficou abaixo do mínimo legal ${exercicios(f.funBelow.map((x) => x.year))} (${f.funBelow.map((x) => `${x.year}: ${pct(x.value)}, mínimo ${x.min}%`).join("; ")}).`,
    );
  if (f.funLeft.length)
    ctx.push(
      `O saldo do Fundeb não utilizado no próprio exercício superou o limite legal ${exercicios(f.funLeft.map((x) => x.year))} (${f.funLeft.map((x) => `${x.year}: ${pct(x.value)}, limite ${x.max}%`).join("; ")}).`,
    );
  const context = ctx.join(" ");

  // ---- MDE series, one line per year from the first record ------------------------------------
  const first = f.existing.find((y) => rec(c, y) != null);
  const seriesYears = first == null ? [] : f.existing.filter((y) => y >= first);
  const series = seriesYears
    .map((y) => {
      const r = rec(c, y);
      if (r?.s === "nd") return `  • ${y}: não declarou`;
      if (r?.mde == null) return `  • ${y}: sem dados`;
      const notes = [
        f.atypMde.includes(y) ? "valor atípico — confirmar" : null,
        PANDEMIC_YEARS.has(y) && r.mde < MDE_MIN ? "EC 119/2022" : null,
      ].filter(Boolean);
      return `  • ${y}: ${pct(r.mde)}${notes.length ? ` (${notes.join("; ")})` : ""}`;
    })
    .join("\n");
  const seriesBlock = f.reported.length ? `\n\nPercentual aplicado em MDE, declarado ao SIOPE/FNDE:\n${series}` : "";
  const sources =
    f.sources.has("siconfi") || f.reported.length === 0
      ? "FNDE – SIOPE (dados abertos) e Tesouro Nacional – SICONFI (RREO)"
      : "FNDE – SIOPE (dados abertos)";
  const sourceLine = `Fonte dos dados: ${sources}, declarados ${df ? "pelo próprio Distrito Federal" : "pelo próprio Município"}; valores em reais nominais. Os sistemas podem receber retificações.`;
  const lom = df ? "" : `\nCaso a Lei Orgânica do Município fixe percentual mínimo superior a ${MDE_MIN}%, solicito considerar também esse limite.`;

  const funYears = [...new Set([...f.funBelow, ...f.funLeft].map((x) => x.year))].sort((a, b) => a - b);
  // shared request items
  const asks = {
    nd: f.notDelivered.length
      ? `cópia dos demonstrativos de aplicação em MDE (SIOPE ou RREO, Anexo 8) ${exercicios(f.notDelivered)}, para ${f.notDelivered.length === 1 ? "o qual" : "os quais"} não há registro de envio aos sistemas federais, ou a justificativa para o não envio`
      : null,
    comp: f.seriousBelow.filter((y) => !PANDEMIC_YEARS.has(y)).length
      ? `as medidas adotadas para compensar a aplicação abaixo de ${MDE_MIN}% registrada ${exercicios(f.seriousBelow.filter((y) => !PANDEMIC_YEARS.has(y)))}`
      : null,
    ec119: f.belowPandemic.length
      ? `a demonstração da aplicação complementar exigida pela EC nº 119/2022 para ${listYears(f.belowPandemic)}, realizada até o exercício de 2023`
      : null,
    atyp: f.atypMde.length ? `a confirmação ou retificação do percentual de MDE declarado ${exercicios(f.atypMde)}, que está fora da faixa usual` : null,
    fun:
      f.funBelow.length || f.funLeft.length
        ? `o percentual dos recursos do Fundeb destinado à remuneração dos profissionais da educação e o saldo não utilizado em cada exercício, com a memória de cálculo e as medidas adotadas ${exercicios(funYears)}`
        : null,
  };
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const numbered = (items: (string | null)[], start = 1) =>
    items
      .filter((x): x is string => !!x)
      .map((x, i) => `${start + i}. ${cap(x)};`)
      .join("\n")
      .replace(/;$/, ".");

  // ---- letters --------------------------------------------------------------------------------
  const laiItems = [
    "demonstrativo das despesas consideradas em MDE nos últimos 5 exercícios, por subfunção, elemento de despesa e, quando possível, por unidade escolar",
    "relação de contratos, convênios e parcerias com entidades privadas pagos com recursos de MDE/Fundeb, com objeto, valor e vigência",
    "atas e pareceres do Conselho de Acompanhamento e Controle Social do Fundeb (CACS-Fundeb) sobre as prestações de contas desses exercícios",
    "valor repassado diretamente às unidades escolares (Conselhos de Escola/APMs) por ano",
    asks.nd,
    asks.comp,
    asks.ec119,
    asks.atyp,
    asks.fun,
    !asks.nd && !asks.comp && !asks.ec119 && !asks.atyp && !asks.fun ? "indicação de onde essas informações estão publicadas no Portal da Transparência" : null,
  ];
  const lai: Template = {
    id: "lai",
    title: "Pedir informações",
    who: "Qualquer pessoa pode pedir, pela Lei de Acesso à Informação. Não precisa dizer o motivo, e o prazo de resposta é de 20 dias (prorrogáveis por mais 10).",
    to: df
      ? "Governo do Distrito Federal – Serviço de Informação ao Cidadão (e-SIC) / Secretaria de Estado de Educação"
      : `Prefeitura Municipal de ${c.name} – Serviço de Informação ao Cidadão (e-SIC) / Secretaria Municipal de Educação`,
    where: {
      text: df
        ? "Envie pelo sistema de acesso à informação do GDF (Participa DF) ou pelo e-mail da Secretaria de Educação."
        : "Envie pelo e-SIC da prefeitura (no site, procure “Acesso à informação” ou “Transparência”). Muitas prefeituras usam o Fala.BR. Sem sistema on-line, protocole na prefeitura e guarde o número.",
      links: df
        ? [{ label: "Participa DF", href: "https://www.participa.df.gov.br" }]
        : [
            { label: "Fala.BR", href: "https://falabr.cgu.gov.br" },
            { label: `Buscar o e-SIC de ${c.name}`, href: search(`e-SIC prefeitura ${c.name} ${c.uf}`) },
          ],
    },
    subject: `Pedido de informação (LAI): aplicação em educação (MDE) – ${place}`,
    body: `Prezados(as),

Com fundamento na Lei nº 12.527/2011 (Lei de Acesso à Informação), no art. 212 da Constituição Federal e na Lei nº 14.113/2020 (Fundeb), solicito as seguintes informações sobre a aplicação de recursos em Manutenção e Desenvolvimento do Ensino (MDE) ${ofEnte}:

${numbered(laiItems)}

Contexto: ${context}${seriesBlock}

${sourceLine}

Solicito que as informações sejam fornecidas em formato aberto (planilha), conforme o art. 8º, § 3º, II, da LAI.

Atenciosamente,
[Seu nome]
[Contato]`,
  };

  const cacsName = `Conselho de Acompanhamento e Controle Social do Fundeb ${df ? "do Distrito Federal" : `de ${c.name}`}`;
  const cacsItems = [
    "análise da série histórica de aplicação em MDE (abaixo)",
    f.funBelow.length
      ? `verificação da aplicação mínima dos recursos do Fundeb na remuneração dos profissionais da educação (70% desde 2021, art. 26 da Lei nº 14.113/2020; 60% para o magistério até 2020, Lei nº 11.494/2007) ${exercicios(f.funBelow.map((x) => x.year))}, quando o percentual declarado foi de ${f.funBelow.map((x) => pct(x.value)).join("; ")}`
      : null,
    f.funLeft.length
      ? `verificação do saldo do Fundeb não utilizado no exercício acima do limite legal (até 10% desde 2021, art. 25, § 3º, da Lei nº 14.113/2020; 5% até 2020) ${exercicios(f.funLeft.map((x) => x.year))}, e da aplicação desse saldo no exercício seguinte`
      : null,
    asks.comp ? `verificação d${asks.comp.slice(1)}` : null,
    asks.ec119 ? `verificação d${asks.ec119.slice(1)}` : null,
    f.notDelivered.length ? `cobrança do envio dos dados ao SIOPE ${exercicios(f.notDelivered)}, que não constam nos sistemas federais` : null,
    asks.atyp ? `pedido d${asks.atyp.slice(1)}` : null,
    !f.funBelow.length && !f.funLeft.length && !asks.comp ? "verificação da composição das despesas computadas em MDE, especialmente contratos com entidades privadas" : null,
    "solicitação à Secretaria de Educação dos extratos e da relação de despesas pagas com recursos do Fundeb, por unidade escolar",
    "divulgação pública das atas e pareceres do Conselho",
  ];
  const cacs: Template = {
    id: "cacs",
    title: "Avisar o conselho do Fundeb",
    who: "O CACS-Fundeb é o conselho de pais, professores e servidores que fiscaliza o dinheiro do Fundeb. Qualquer pessoa pode levar um pedido a ele.",
    to: `Presidência do ${cacsName} (CACS-Fundeb)`,
    where: {
      text: df
        ? "A Secretaria de Educação do DF deve divulgar a composição e o contato do conselho. Envie por e-mail ou protocole na secretaria."
        : `A prefeitura deve divulgar quem são os conselheiros e como falar com eles (geralmente na página da Secretaria de Educação). Envie por e-mail ou protocole na Secretaria de Educação de ${c.name}.`,
      links: [{ label: "Buscar o conselho", href: search(`CACS Fundeb ${df ? "Distrito Federal" : `${c.name} ${c.uf}`}`) }],
    },
    subject: `Pedido de pauta ao CACS-Fundeb: aplicação em educação – ${place}`,
    body: `Senhor(a) Presidente do ${cacsName},

Considerando as atribuições do Conselho previstas no art. 33 da Lei nº 14.113/2020, solicito a inclusão em pauta da próxima reunião dos seguintes pontos:

${numbered(cacsItems)}

${context}${seriesBlock}

${sourceLine}

Respeitosamente,
[Seu nome]
[Segmento que representa / contato]`,
  };

  // legal consequence only when there is something still unresolved
  const consequence = f.seriousBelow.length
    ? `A aplicação mínima em educação é obrigação constitucional (art. 212 da CF). Seu descumprimento pode levar à rejeição das contas pelo Tribunal de Contas e, em último caso, à intervenção (art. ${df ? "34, VII, “e”" : "35, III"}, da CF).`
    : `A aplicação mínima em educação é obrigação constitucional (art. 212 da CF), e cabe a esta Casa fiscalizá-la com o auxílio do Tribunal de Contas.`;
  const vereadorItems = [
    "o percentual da receita resultante de impostos aplicado em Manutenção e Desenvolvimento do Ensino em cada um dos últimos exercícios, com a memória de cálculo",
    `a relação das despesas computadas em MDE glosadas ou questionadas pelo ${tc.name} (${tc.short})`,
    asks.nd,
    asks.comp,
    asks.ec119,
    asks.atyp,
    asks.fun,
    !asks.comp && !asks.fun ? "a relação de contratos com entidades privadas custeados com recursos de MDE/Fundeb" : null,
    "o valor repassado diretamente às escolas em cada exercício",
  ].filter((x): x is string => !!x);
  const vereador: Template = {
    id: "vereador",
    title: df ? "Pedir a um deputado distrital" : "Pedir a um vereador",
    who: df
      ? "Deputados distritais podem exigir explicações oficiais do governo. Leve o texto a um gabinete ou à Comissão de Educação da Câmara Legislativa."
      : "Vereadores podem exigir explicações oficiais da prefeitura. Leve o texto a um gabinete ou à Comissão de Educação da Câmara; o requerimento é apresentado por eles.",
    to: df
      ? "Câmara Legislativa do Distrito Federal – gabinete de deputado(a) distrital ou Comissão de Educação"
      : `Câmara Municipal de ${c.name} – gabinete de vereador(a) ou Comissão de Educação`,
    where: {
      text: df
        ? "Os contatos dos gabinetes estão no site da Câmara Legislativa do DF."
        : "Os e-mails e telefones dos gabinetes costumam estar no site da Câmara Municipal. Você também pode ir pessoalmente.",
      links: df
        ? [{ label: "Câmara Legislativa do DF", href: "https://www.cl.df.gov.br" }]
        : [{ label: `Buscar a Câmara de ${c.name}`, href: search(`Câmara Municipal de ${c.name} ${c.uf} vereadores contato`) }],
    },
    subject: `Sugestão de requerimento de informações: aplicação em educação (MDE) – ${place}`,
    body: `REQUERIMENTO DE INFORMAÇÕES Nº ___/____

Requeiro, na forma regimental, que seja oficiado ao ${df ? "Excelentíssimo(a) Senhor(a) Governador(a) do Distrito Federal" : `Excelentíssimo(a) Senhor(a) Prefeito(a) Municipal de ${c.name}`} para que informe a esta Casa:

${vereadorItems.map((x, i) => `${String.fromCharCode(97 + i)}) ${x}${i === vereadorItems.length - 1 ? "." : ";"}`).join("\n")}

JUSTIFICATIVA
${context}${seriesBlock}

${consequence}${lom}

${sourceLine}

Sala das Sessões, ___ de __________ de ____.

[Nome do(a) ${df ? "deputado(a) distrital" : "vereador(a)"}]`,
  };

  const checks = [
    `o cumprimento do art. 212 da Constituição Federal${f.reported.length ? ` ${exercicios(f.below.length ? f.below : f.reported)}` : ""}`,
    f.funBelow.length || f.funLeft.length
      ? `o cumprimento do art. 212-A da Constituição Federal e da Lei nº 14.113/2020 (Fundeb) ${exercicios(funYears)}`
      : null,
    f.notDelivered.length ? `o envio dos dados obrigatórios ao SIOPE ${exercicios(f.notDelivered)}` : null,
    f.below.length ? `a eventual compensação dos valores não aplicados${f.belowPandemic.length ? ", inclusive a complementação prevista na EC nº 119/2022" : ""}` : null,
    `a adequação das despesas computadas como MDE${f.atypMde.length ? ` e a consistência dos percentuais declarados ${exercicios(f.atypMde)}` : ""}`,
  ].filter((x): x is string => !!x);
  const tce: Template = {
    id: "tce",
    title: "Comunicar ao Tribunal de Contas ou ao MP",
    who: `Qualquer pessoa pode comunicar fatos à ouvidoria do ${tc.short} ou ao Ministério Público. Eles podem investigar e cobrar a correção.`,
    to: `Ouvidoria do ${tc.name} (${tc.short}) ou ${df ? "Promotoria de Justiça de Defesa da Educação do MPDFT" : `Promotoria de Justiça da Educação do ${mp}`}`,
    where: {
      text: `Use o formulário da ouvidoria no site do ${tc.short} ou do ${df ? "MPDFT" : `MP ${ofUf(c.uf)}`}. Guarde o número do protocolo.`,
      links: [
        { label: `Ouvidoria do ${tc.short}`, href: search(`ouvidoria ${tc.name}`) },
        { label: df ? "Ouvidoria do MPDFT" : `Ouvidoria do MP-${c.uf}`, href: search(`ouvidoria ${mp}`) },
      ],
    },
    subject: `Comunicação de fatos: aplicação em educação (MDE) – ${place}`,
    body: `Assunto: Aplicação em Manutenção e Desenvolvimento do Ensino – ${place}

Venho comunicar fatos para apreciação desse órgão.

${context}${seriesBlock}

Solicito verificar: ${checks.map((x, i) => `(${["i", "ii", "iii", "iv", "v", "vi"][i]}) ${x}`).join("; ")}.

Observação: os dados são públicos e podem ser conferidos no SIOPE (${SIOPE_URL}) e no SICONFI (${SICONFI_URL}), código IBGE ${c.id} (${df ? "Distrito Federal" : `${c.name}, ${ufName}`}). Por serem autodeclarados, podem divergir da apuração desse Tribunal.

[Seu nome]
[Contato]`,
  };

  return [lai, cacs, vereador, tce];
}

/** "na Bahia", "no Rio de Janeiro", "em São Paulo". */
export const inUf = (sigla: string) => ofUf(sigla).replace(/^do /, "no ").replace(/^da /, "na ").replace(/^de /, "em ");
