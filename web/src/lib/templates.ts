import { type City, MDE_MIN, YEARS, brl, deficitTrail, pct, yearsBelow } from "./data";
import { getUf, ofUf } from "./geo";

/** Court of accounts that audits a municipality: BA, GO and PA have municipal courts; the capitals of SP and RJ have their own. */
export function tribunal(c: City): { name: string; short: string } {
  if (c.id === 3550308) return { name: "Tribunal de Contas do Município de São Paulo", short: "TCM-SP" };
  if (c.id === 3304557) return { name: "Tribunal de Contas do Município do Rio de Janeiro", short: "TCM-RJ" };
  if (c.uf === "DF") return { name: "Tribunal de Contas do Distrito Federal", short: "TCDF" };
  if (["BA", "GO", "PA"].includes(c.uf)) return { name: `Tribunal de Contas dos Municípios do Estado ${ofUf(c.uf)}`, short: `TCM-${c.uf}` };
  return { name: `Tribunal de Contas do Estado ${ofUf(c.uf)}`, short: `TCE-${c.uf}` };
}

/** Plain-language request templates citizens, councillors and council members can copy. */
export function buildTemplates(c: City) {
  const tc = tribunal(c);
  const df = c.uf === "DF";
  // The Distrito Federal has no prefeitura or câmara: a Governo, a Câmara Legislativa and the MPDFT instead
  const ente = df ? "pelo Distrito Federal" : "pelo Município";
  const place = df ? "Distrito Federal" : `Município de ${c.name} (${c.uf})`;
  const ofEnte = df ? "do Distrito Federal" : `do Município de ${c.name}`;
  const below = yearsBelow(c);
  const trail = deficitTrail(c);
  const last = trail[trail.length - 1];
  const reported = YEARS.filter((y) => c.years[y]?.mde != null);
  const summary = reported.map((y) => `  • ${y}: ${pct(c.years[y]!.mde)}`).join("\n");
  const belowTxt = below.length
    ? `Segundo os próprios dados declarados ${ente} ao Sistema de Informações sobre Orçamentos Públicos em Educação (SIOPE/FNDE), a aplicação ficou abaixo do mínimo constitucional de ${MDE_MIN}% nos exercícios de ${below.join(", ")}.`
    : `Segundo os dados declarados ${ente} ao Sistema de Informações sobre Orçamentos Públicos em Educação (SIOPE/FNDE), ${df ? "o Distrito Federal" : "o Município"} declarou ter cumprido o mínimo constitucional de ${MDE_MIN}% nos exercícios informados.`;
  const deficitTxt =
    last.carry > 0
      ? `\nPor estimativa a partir desses dados, o valor ainda não compensado soma aproximadamente ${brl(last.carry)}.`
      : "";

  const lai = {
    id: "lai",
    title: "Pedido via Lei de Acesso",
    to: df
      ? "Governo do Distrito Federal – Serviço de Informação ao Cidadão (e-SIC) / Secretaria de Estado de Educação"
      : `Prefeitura Municipal de ${c.name} – Serviço de Informação ao Cidadão (e-SIC) / Secretaria Municipal de Educação`,
    body: `Prezados(as),

Com fundamento na Lei nº 12.527/2011 (Lei de Acesso à Informação), no art. 212 da Constituição Federal e na Lei nº 14.113/2020 (Novo Fundeb), solicito as seguintes informações sobre a aplicação de recursos em Manutenção e Desenvolvimento do Ensino (MDE) ${ofEnte}:

1. Demonstrativo detalhado das despesas consideradas em MDE nos últimos 5 exercícios, por subfunção, elemento de despesa e unidade escolar, quando possível;
2. Relação de contratos, convênios e parcerias com entidades privadas pagos com recursos de MDE/Fundeb, com objeto, valor e vigência;
3. Atas e pareceres do Conselho de Acompanhamento e Controle Social do Fundeb (CACS-Fundeb) sobre as prestações de contas desses exercícios;
4. Valor efetivamente repassado diretamente às unidades escolares (Conselhos de Escola/APMs) por ano;
5. ${below.length ? `Plano ou medidas adotadas para compensar a aplicação abaixo de ${MDE_MIN}% registrada em ${below.join(", ")};` : "Indicação de onde essas informações estão publicadas no Portal da Transparência;"}

Contexto: ${belowTxt}${deficitTxt}

Percentuais declarados:
${summary}

Solicito que as informações sejam fornecidas em formato aberto (planilha), conforme art. 8º, §3º, II da LAI.

Atenciosamente,
[Seu nome]
[Contato]`,
  };

  const cacs = {
    id: "cacs",
    title: "Ofício ao CACS-Fundeb",
    to: `Presidência do Conselho de Acompanhamento e Controle Social do Fundeb ${df ? "do Distrito Federal" : `de ${c.name}`}`,
    body: `Senhor(a) Presidente do CACS-Fundeb ${df ? "do Distrito Federal" : `de ${c.name}`},

Considerando as atribuições do Conselho previstas no art. 33 da Lei nº 14.113/2020, solicito a inclusão em pauta da próxima reunião dos seguintes pontos:

1. Análise da série histórica de aplicação em MDE ${df ? "do Distrito Federal" : "do Município"}:
${summary}
2. ${below.length ? `Verificação das medidas de compensação da aplicação abaixo de ${MDE_MIN}% em ${below.join(", ")}.` : "Verificação da composição das despesas computadas em MDE, especialmente contratos com entidades privadas."}
3. Solicitação à Secretaria de Educação dos extratos e da relação de despesas pagas com recursos do Fundeb, por unidade escolar.
4. Divulgação pública das atas e pareceres do Conselho.

${belowTxt}${deficitTxt}

Fonte dos dados: FNDE – SIOPE (dados abertos) e Tesouro Nacional – SICONFI (RREO, Anexo 8/14), declarados ${df ? "pelo próprio Distrito Federal" : "pelo próprio Município"}.

Respeitosamente,
[Seu nome]
[Segmento que representa / contato]`,
  };

  const vereador = {
    id: "vereador",
    title: df ? "Requerimento (deputado distrital)" : "Requerimento (vereador)",
    to: df
      ? "Câmara Legislativa do Distrito Federal – gabinete de deputado(a) distrital ou Comissão de Educação"
      : `Câmara Municipal de ${c.name} – gabinete de vereador(a) ou Comissão de Educação`,
    body: `REQUERIMENTO DE INFORMAÇÕES Nº ___/____

Requeiro, na forma regimental, que seja oficiado ao ${df ? "Excelentíssimo Senhor Governador do Distrito Federal" : `Excelentíssimo Senhor Prefeito Municipal de ${c.name}`} para que informe a esta Casa:

a) o percentual da receita resultante de impostos aplicado em Manutenção e Desenvolvimento do Ensino em cada um dos últimos exercícios, com a memória de cálculo;
b) a relação das despesas computadas em MDE glosadas ou questionadas pelo ${tc.name} (${tc.short});
c) ${below.length ? `as medidas adotadas para compensar os valores não aplicados em ${below.join(", ")}` : "a relação de contratos com entidades privadas custeados com recursos de MDE/Fundeb"};
d) o valor repassado diretamente às escolas em cada exercício.

JUSTIFICATIVA
${belowTxt}${deficitTxt}
A aplicação mínima em educação é obrigação constitucional (art. 212 da CF) e seu descumprimento pode ensejar intervenção estadual (art. 35, III, da CF).

Sala das Sessões, ___ de __________ de ____.

[Nome do(a) ${df ? "deputado(a) distrital" : "vereador(a)"}]`,
  };

  const tce = {
    id: "tce",
    title: `Comunicação ao ${tc.short} / MP`,
    to: `Ouvidoria do ${tc.name} (${tc.short}) ou ${df ? "Promotoria de Justiça de Defesa da Educação do MPDFT" : `Promotoria de Justiça da Educação do Ministério Público ${ofUf(c.uf)}`}`,
    body: `Assunto: Aplicação em Manutenção e Desenvolvimento do Ensino – ${place}

Venho comunicar fatos para apreciação desse órgão.

${belowTxt}${deficitTxt}

Percentual aplicado em MDE, série declarada ao SIOPE/FNDE:
${summary}

Solicito verificar: (i) o cumprimento do art. 212 da Constituição Federal e do art. 212-A (Fundeb) nos exercícios indicados; (ii) eventual compensação dos valores não aplicados; (iii) a adequação das despesas computadas como MDE.

Observação: os dados são públicos e podem ser conferidos no SIOPE (https://www.fnde.gov.br/siope) e no SICONFI (https://siconfi.tesouro.gov.br), código IBGE ${c.id} (${getUf(c.uf)!.name}).

[Seu nome]
[Contato]`,
  };

  return [lai, cacs, vereador, tce];
}
