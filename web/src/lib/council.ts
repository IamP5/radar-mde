import type { City } from "@/lib/data";
import {
  MDE_MIN,
  PANDEMIC_YEARS,
  STATUS_LABEL,
  brl,
  brlShort,
  brlSigned,
  ec119,
  fundebLeftMax,
  funMin,
  listYears,
  mdeBalance,
  mdeStatus,
  pct,
  requiredMde,
  siconfiUrl,
  siopeUrl,
  type Ec119,
  type Status,
} from "@/lib/format";
import { cityPath, tribunal } from "@/lib/geo";
import { DATA_VERSION, IPCA_LABEL, atipNote, toReal, type CityYear } from "@/lib/rows";
import { THESIS_SANTO_ANDRE, THESIS_SANTO_ANDRE_ID, THESIS_URL } from "@/lib/thesis";

export type CouncilCity = Pick<City, "id" | "name" | "uf" | "slug" | "years">;

export type Outcome = "met" | "edge" | "missed" | "nodata" | "notdelivered";

export type Source = { short: string; name: string; href: string };

export type Reading = { source: Source; figure: string; outcome: Outcome; badge: string };

export type RuleLine = {
  kind: "rule";
  id: "mde" | "fundebPay" | "fundebLeft" | "ec119" | "declared";
  title: string;
  scope: string;
  readings: readonly [Reading, ...Reading[]];
  note: string | null;
};

export type CaveatLine = {
  kind: "caveat";
  id: "atypical";
  title: string;
  scope: string;
  flags: readonly { year: number; text: string }[];
  note: string;
};

export type ChecklistLine = RuleLine | CaveatLine;

export type MoneyRow = { label: string; value: string; note: string | null };

export type Money = { applied: MoneyRow; required: MoneyRow; gap: MoneyRow; basis: string; payroll: string };

export type Cell = { text: string; outcome: Outcome | null };

export type History = {
  columns: readonly string[];
  rows: readonly { year: number; selected: boolean; cells: readonly Cell[] }[];
  footnote: string;
};

export type Topic =
  | "declaration"
  | "compensation"
  | "ec119"
  | "glosas"
  | "fundebPay"
  | "fundebLeft"
  | "atypical"
  | "cacs"
  | "beyondPayroll"
  | "lom"
  | "contracts"
  | "convenios"
  | "creche"
  | "schools";

export type Question = { topic: Topic; text: string };

export type SourceLink = { label: string; href: string | null };

export type Header = { title: string; place: string; exercise: string; dataVersion: string; cityHref: string };

export type CouncilSheet = {
  header: Header;
  checklist: readonly ChecklistLine[];
  money: Money;
  history: History;
  questions: readonly Question[];
  sources: readonly SourceLink[];
};

export function councilSheet(c: CouncilCity, years: readonly number[], year: number): CouncilSheet {
  if (!years.includes(year)) throw new Error(`councilSheet: ${year} is not a published year`);
  const audit = AUDITS.get(c.id);
  const facts = years
    .filter((y) => y <= year)
    .slice(-5)
    .map((y) => yearFacts(c, y, audit));
  const sel = facts[facts.length - 1];
  const pandemic = ec119(c.years);
  const lines: Lines = {
    mde: mdeLine(c, sel),
    fundebPay: {
      kind: "rule",
      id: "fundebPay",
      title: "Fundeb na remuneração dos profissionais",
      scope: `${year} · mínimo de ${funMin(year)}%`,
      readings: [sel.fundebPay],
      note: (sel.rec?.fun ?? 0) > 100 ? "Pode passar de 100% quando a prefeitura usa saldo de anos anteriores." : null,
    },
    fundebLeft: {
      kind: "rule",
      id: "fundebLeft",
      title: "Fundeb não usado no ano",
      scope: `${year} · máximo de ${fundebLeftMax(year)}%`,
      readings: [sel.fundebLeft],
      note: null,
    },
    ec119: ec119Line(c, years, pandemic),
    declared: declaredLine(facts),
    atypical: atypicalLine(facts),
  };
  const tc = tribunal(c);
  return {
    header: {
      title: "Ficha para o conselho",
      place: `${c.name} (${c.uf})`,
      exercise: `Exercício de ${year}`,
      dataVersion: `Dados versão ${DATA_VERSION}`,
      cityHref: `${cityPath(c.uf, c.slug)}?ano=${year}`,
    },
    checklist: [lines.mde, lines.fundebPay, lines.fundebLeft, ...(lines.ec119 ? [lines.ec119] : []), lines.declared, lines.atypical],
    money: moneyOf(sel, lines.mde),
    history: historyOf(facts),
    questions: questionsOf(lines, facts, pandemic),
    sources: [
      ...new Map(
        [lines.mde, lines.fundebPay, lines.fundebLeft, lines.ec119, lines.declared]
          .flatMap((l) => l?.readings ?? [])
          .map((r) => [r.source.href, { label: r.source.name, href: r.source.href }] as const),
      ).values(),
      { label: `Quem fiscaliza: ${tc.name} (${tc.short})`, href: null },
      { label: "Cartas prontas para pedir informações, na página do município", href: `${cityPath(c.uf, c.slug)}?ano=${year}#agir` },
    ],
  };
}

const OUTCOME: Record<Status, Outcome> = { ok: "met", edge: "edge", below: "missed", nodata: "nodata", notdelivered: "notdelivered" };

const BADGE: Record<Outcome, string> = {
  met: STATUS_LABEL.ok,
  edge: STATUS_LABEL.edge,
  missed: STATUS_LABEL.below,
  nodata: STATUS_LABEL.nodata,
  notdelivered: STATUS_LABEL.notdelivered,
};

const reading = (source: Source, figure: string, outcome: Outcome, missedBadge = BADGE.missed): Reading => ({
  source,
  figure,
  outcome,
  badge: outcome === "missed" ? missedBadge : BADGE[outcome],
});

const shown = (v: number | null | undefined, fmt: (v: number) => string = pct) => (v == null ? "sem dado" : fmt(v));

const mdeOutcome = (mde: number) => OUTCOME[mdeStatus({ s: "ok", mde })];

function declaredSource(c: CouncilCity, y: number): Source {
  return c.years[y]?.src === "siconfi"
    ? { short: "SICONFI", name: `Tesouro Nacional, SICONFI, ${y}`, href: siconfiUrl(c.id, y) }
    : { short: "SIOPE", name: `FNDE/SIOPE, ${y}`, href: siopeUrl(c.id, c.uf, y) };
}

type Audit = { source: Source; mde: (y: number) => number | undefined };

const AUDITS: ReadonlyMap<number, Audit> = new Map([
  [
    THESIS_SANTO_ANDRE_ID,
    {
      source: { short: "TCE-SP", name: "TCE-SP, apuração citada em Silva (2021), UNINOVE, Figura 42", href: THESIS_URL },
      mde: (y: number) => THESIS_SANTO_ANDRE[y]?.mde,
    },
  ],
]);

type YearFacts = {
  year: number;
  rec: CityYear | undefined;
  declared: Reading;
  audited: Reading | null;
  fundebPay: Reading;
  fundebLeft: Reading;
};

function yearFacts(c: CouncilCity, y: number, audit: Audit | undefined): YearFacts {
  const rec = c.years[y];
  const src = declaredSource(c, y);
  const nd = rec?.s === "nd";
  const audited = audit?.mde(y);
  return {
    year: y,
    rec,
    declared: reading(src, shown(rec?.mde), OUTCOME[mdeStatus(rec)]),
    audited: audit && audited != null ? reading(audit.source, pct(audited), mdeOutcome(audited)) : null,
    fundebPay: reading(src, shown(rec?.fun), nd ? "notdelivered" : rec?.fun == null ? "nodata" : rec.fun < funMin(y) ? "missed" : "met"),
    fundebLeft: reading(
      src,
      shown(rec?.funLeft),
      nd ? "notdelivered" : rec?.funLeft == null ? "nodata" : rec.funLeft > fundebLeftMax(y) ? "missed" : "met",
      "Acima do limite",
    ),
  };
}

type Lines = {
  mde: RuleLine;
  fundebPay: RuleLine;
  fundebLeft: RuleLine;
  ec119: RuleLine | null;
  declared: RuleLine;
  atypical: CaveatLine;
};

function mdeLine(c: CouncilCity, f: YearFacts): RuleLine {
  const alt = f.rec?.alt;
  const treasury: Source = { short: "Tesouro", name: `Tesouro Nacional, SICONFI (RREO, Anexo 14), ${f.year}`, href: siconfiUrl(c.id, f.year) };
  const readings: [Reading, ...Reading[]] = [f.declared];
  if (alt != null) readings.push(reading(treasury, pct(alt), mdeOutcome(alt)));
  if (f.audited) readings.push(f.audited);
  const sides = new Set(readings.filter((r) => r.outcome === "met" || r.outcome === "edge" || r.outcome === "missed").map((r) => r.outcome === "missed"));
  return {
    kind: "rule",
    id: "mde",
    title: "Aplicação mínima em educação (MDE)",
    scope: `${f.year} · mínimo de ${MDE_MIN}% da receita de impostos`,
    readings,
    note: sides.size > 1 ? `As fontes não concordam sobre o mínimo de ${MDE_MIN}% em ${f.year}. Confirme na fonte.` : null,
  };
}

function ec119Line(c: CouncilCity, years: readonly number[], p: Ec119 | null): RuleLine | null {
  const span = [...PANDEMIC_YEARS].filter((y) => years.includes(y));
  if (!span.length) return null;
  const line = (r: Reading, note: string | null): RuleLine => ({
    kind: "rule",
    id: "ec119",
    title: "Compensação da pandemia (EC 119/2022)",
    scope: "2020 e 2021, compensação até 2023",
    readings: [r],
    note,
  });
  if (!p) {
    const src = declaredSource(c, span[span.length - 1]);
    const nd = span.filter((y) => c.years[y]?.s === "nd");
    const missing = span.filter((y) => c.years[y]?.s !== "nd" && c.years[y]?.mde == null);
    if (nd.length) return line(reading(src, `sem dado de ${listYears(nd)}`, "notdelivered"), null);
    if (missing.length) return line(reading(src, `sem dado de ${listYears(missing)}`, "nodata"), null);
    return line(reading(src, "sem diferença a compensar", "met"), null);
  }
  const src = declaredSource(c, p.below[0]);
  const noBase = p.below.some((y) => c.years[y]?.base == null);
  const figure = `${noBase ? "" : `${brlShort(p.short)} `}abaixo de ${MDE_MIN}% em ${listYears(p.below)}`;
  const after = `Pelos dados declarados, a aplicação acima de ${MDE_MIN}% em 2022 e 2023 (${brlShort(p.surplus)})`;
  if (p.state === "compensated")
    return line(reading(src, figure, "met"), `${after} parece ter coberto essa diferença, o que cabe ao Tribunal de Contas confirmar.`);
  if (p.state === "open") return line(reading(src, figure, "missed", "Não compensado"), `${after} não cobre essa diferença. Confirme na fonte.`);
  return line(reading(src, figure, "nodata"), "Faltam a receita ou o percentual de algum ano entre 2020 e 2023 para estimar a compensação. Confirme na fonte.");
}

function gaps(facts: readonly YearFacts[]) {
  return {
    notDelivered: facts.filter((f) => f.rec?.s === "nd").map((f) => f.year),
    withoutPercent: facts.filter((f) => f.rec?.s !== "nd" && f.rec?.mde == null).map((f) => f.year),
  };
}

function declaredLine(facts: readonly YearFacts[]): RuleLine {
  const n = facts.length;
  const { notDelivered, withoutPercent } = gaps(facts);
  const sent = n - notDelivered.length - withoutPercent.length;
  return {
    kind: "rule",
    id: "declared",
    title: "Declaração dos dados de MDE",
    scope: `${n === 1 ? "Último exercício" : `Últimos ${n} exercícios`} (${listYears(facts.map((f) => f.year))})`,
    readings: [
      reading(
        facts[n - 1].declared.source,
        `${sent} de ${n} ${n === 1 ? "exercício declarado" : "exercícios declarados"}`,
        notDelivered.length ? "notdelivered" : withoutPercent.length ? "nodata" : "met",
      ),
    ],
    note: notDelivered.length
      ? `Não há registro de envio dos dados de ${listYears(notDelivered)}.`
      : withoutPercent.length
        ? `Não há percentual de MDE registrado para ${listYears(withoutPercent)}.`
        : null,
  };
}

function atypicalLine(facts: readonly YearFacts[]): CaveatLine {
  const flags = facts.flatMap((f) => (f.rec?.atip?.length ? [{ year: f.year, text: atipNote(f.rec.atip, f.rec.atipImpl === 1) }] : []));
  return {
    kind: "caveat",
    id: "atypical",
    title: "Valores fora do padrão",
    scope: listYears(facts.map((f) => f.year)),
    flags,
    note: flags.length
      ? "O Radar mantém o valor declarado e só marca o desvio. Confirme na fonte."
      : "Nenhum valor fora do padrão do próprio município.",
  };
}

function moneyOf(sel: YearFacts, mde: RuleLine): Money {
  const { year: y, rec: r } = sel;
  const payroll =
    `O mínimo de ${funMin(y)}% vale só para o Fundeb e trata da remuneração dos profissionais. O restante do Fundeb e os ` +
    "demais recursos de MDE pagam outras despesas do ensino, como manutenção das escolas, transporte escolar e material " +
    `didático. Um percentual alto no Fundeb não mostra, sozinho, se o município aplicou ${MDE_MIN}% da receita de impostos em educação.`;
  const label = { applied: "Aplicado em MDE", required: "Mínimo exigido", gap: "Diferença para o mínimo" };
  if (r?.s === "nd") {
    const row = (l: string): MoneyRow => ({ label: l, value: STATUS_LABEL.notdelivered, note: null });
    return {
      applied: row(label.applied),
      required: row(label.required),
      gap: row(label.gap),
      basis: `O município não declarou os dados de ${y}.`,
      payroll,
    };
  }
  const balance = mdeBalance(r);
  const method =
    r?.mde != null && r.base != null
      ? `A diferença aplica o percentual declarado (${pct(r.mde)}) à receita de impostos e transferências (${brlShort(r.base)}).`
      : "Sem o percentual declarado e a receita de impostos, não há como calcular a diferença.";
  const others = mde.note ? mde.readings.slice(1) : [];
  const elsewhere = others.length
    ? ` ${others.map((o) => `${o.source.short} indica ${o.figure}`).join(" e ")} para este ano. Confirme na fonte.`
    : "";
  return {
    applied: {
      label: label.applied,
      value: r?.mdeV == null ? "sem dado" : `${r.mdeVEst ? "≈ " : ""}${brlShort(r.mdeV)}`,
      note: r?.mdeV != null && r.mdeVEst ? "estimativa do Radar (receita × percentual declarado)" : null,
    },
    required: {
      label: label.required,
      value: r?.base == null ? "sem dado" : brlShort(requiredMde(r.base)),
      note: `${MDE_MIN}% da receita de impostos e transferências`,
    },
    gap: {
      label: label.gap,
      value: balance == null ? "sem dado" : brlSigned(balance),
      note: !balance ? null : balance > 0 ? `acima de ${MDE_MIN}%` : `abaixo de ${MDE_MIN}%`,
    },
    basis: `Valores de ${y} em R$ da época, pelos dados declarados ao ${sel.declared.source.short}. ${method}${elsewhere}`,
    payroll,
  };
}

const cell = (r: Reading): Cell => ({ text: r.outcome === "notdelivered" ? r.badge : r.figure, outcome: r.outcome });

function historyOf(facts: readonly YearFacts[]): History {
  const audit = facts.find((f) => f.audited)?.audited?.source;
  return {
    columns: ["MDE declarado", ...(audit ? [`MDE apurado (${audit.short})`] : []), "Fundeb na remuneração", "Por aluno*"],
    rows: facts.map((f, i) => ({
      year: f.year,
      selected: i === facts.length - 1,
      cells: [
        cell(f.declared),
        ...(audit ? [f.audited ? cell(f.audited) : { text: "sem dado", outcome: null }] : []),
        cell(f.fundebPay),
        {
          text: f.rec?.s === "nd" ? STATUS_LABEL.notdelivered : shown(toReal(f.rec?.perAluno, f.year), brl),
          outcome: null,
        },
      ],
    })),
    footnote: `* ${IPCA_LABEL}.`,
  };
}

type Ask = (x: { lines: Lines; facts: readonly YearFacts[]; pandemic: Ec119 | null }) => Question | null;

const orList = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} ou ${xs[xs.length - 1]}`);

const FROM_FACTS: readonly Ask[] = [
  ({ facts }) => {
    const { notDelivered, withoutPercent } = gaps(facts);
    const src = (ys: number[]) => facts.find((f) => f.year === ys[0])!.declared.source.short;
    if (notDelivered.length)
      return { topic: "declaration", text: `Não há registro de envio ao ${src(notDelivered)} dos dados de MDE de ${listYears(notDelivered)}. Há previsão de envio?` };
    if (withoutPercent.length)
      return {
        topic: "declaration",
        text: `O ${src(withoutPercent)} não registra o percentual aplicado em MDE em ${listYears(withoutPercent)}. A prefeitura pode informar esse percentual?`,
      };
    return null;
  },
  ({ lines, facts }) => {
    const sel = facts[facts.length - 1];
    const hits = facts
      .filter((f) => !PANDEMIC_YEARS.has(f.year))
      .map((f) => {
        const readings = f === sel ? lines.mde.readings : [f.declared, ...(f.audited ? [f.audited] : [])];
        return { f, missed: readings.filter((r) => r.outcome === "missed") };
      })
      .filter((h) => h.missed.length);
    if (!hits.length) return null;
    const ys = listYears(hits.map((h) => h.f.year));
    const ask = "Que medidas foram adotadas para compensar essa diferença?";
    const declared = hits.flatMap((h) => h.missed.filter((r) => r === h.f.declared));
    const other = hits.flatMap((h) => h.missed.filter((r) => r !== h.f.declared));
    if (!other.length) return { topic: "compensation", text: `Pelos dados declarados, a aplicação em MDE ficou abaixo de ${MDE_MIN}% em ${ys}. ${ask}` };
    const shorts = [...new Set([...declared, ...other].map((r) => r.source.short))];
    const who = shorts.length > 1 ? `pelo menos uma das fontes (${orList(shorts)})` : `o ${shorts[0]}`;
    return { topic: "compensation", text: `Em ${ys}, ${who} indica aplicação abaixo de ${MDE_MIN}% em MDE. ${ask}` };
  },
  ({ pandemic: p }) => {
    if (!p) return null;
    const ys = listYears(p.below);
    if (p.state === "compensated")
      return {
        topic: "ec119",
        text: `O Tribunal de Contas já confirmou que a aplicação acima de ${MDE_MIN}% em 2022 e 2023 compensou a diferença de ${ys}, como prevê a EC 119/2022?`,
      };
    if (p.state === "open")
      return {
        topic: "ec119",
        text: `Pelos dados declarados, a aplicação em 2022 e 2023 não cobriu a diferença de ${brlShort(p.short)} de ${ys}. Como fica a compensação prevista na EC 119/2022?`,
      };
    return {
      topic: "ec119",
      text: "Quais foram a receita de impostos e a aplicação em MDE de 2020 a 2023? Sem esses dados não é possível verificar a compensação prevista na EC 119/2022.",
    };
  },
  ({ lines, facts }) => {
    const edge = lines.mde.readings.find((r) => r.outcome === "edge");
    if (!edge) return null;
    return {
      topic: "glosas",
      text: `Em ${facts[facts.length - 1].year}, o ${edge.source.short} registra ${edge.figure}, no limite do mínimo de ${MDE_MIN}%. O Tribunal de Contas aceitou todas as despesas contadas como MDE nesse ano, ou houve glosas?`,
    };
  },
  ({ lines, facts }) => {
    const r = lines.fundebPay.readings[0];
    const y = facts[facts.length - 1].year;
    if (r.outcome !== "missed") return null;
    return {
      topic: "fundebPay",
      text: `Pelos dados declarados, ${r.figure} do Fundeb de ${y} foram para a remuneração dos profissionais, abaixo do mínimo de ${funMin(y)}%. O que explica essa diferença?`,
    };
  },
  ({ lines, facts }) => {
    const r = lines.fundebLeft.readings[0];
    const y = facts[facts.length - 1].year;
    if (r.outcome !== "missed") return null;
    return {
      topic: "fundebLeft",
      text: `Pelos dados declarados, ${r.figure} do Fundeb de ${y} ficaram sem uso no ano, acima do máximo de ${fundebLeftMax(y)}%. Em que esse saldo foi aplicado depois?`,
    };
  },
  ({ lines }) => {
    const { flags } = lines.atypical;
    if (!flags.length) return null;
    return {
      topic: "atypical",
      text: `O Radar marcou valores fora do padrão do próprio município em ${listYears(flags.map((f) => f.year))}. A prefeitura pode confirmar esses números ou informar se houve retificação?`,
    };
  },
];

const BASELINE: readonly ((y: number) => Question)[] = [
  (y) => ({
    topic: "glosas",
    text: `O parecer do Tribunal de Contas sobre as contas de ${y} apontou glosas em despesas de educação? Qual percentual foi apurado?`,
  }),
  (y) => ({ topic: "cacs", text: `O conselho recebeu os demonstrativos do Fundeb de ${y} a tempo de analisá-los antes do envio ao SIOPE?` }),
  (y) => ({
    topic: "beyondPayroll",
    text: `Além da remuneração dos profissionais, em que foram aplicados os demais recursos de MDE em ${y}, como manutenção das escolas, transporte escolar e material didático?`,
  }),
  (y) => ({ topic: "lom", text: `A Lei Orgânica do município fixa para a educação um mínimo acima de ${MDE_MIN}%? Se fixa, ele foi cumprido em ${y}?` }),
];

const STATIC: readonly Question[] = [
  {
    topic: "contracts",
    text: "Quais são os maiores contratos da educação, como transporte escolar, obras e serviços terceirizados, e onde podem ser consultados?",
  },
  { topic: "convenios", text: "Há convênios com creches ou outras entidades? Quanto foi repassado e como é feita a prestação de contas?" },
  { topic: "creche", text: "Quantas crianças estão hoje na fila de espera por vaga em creche, e qual é o plano para atendê-las?" },
  {
    topic: "schools",
    text: "Quanto cada escola recebeu de recursos descentralizados, como o PDDE, e como a comunidade escolar acompanha esse uso?",
  },
];

const MAX_QUESTIONS = 10;
const MAX_DERIVED = MAX_QUESTIONS - STATIC.length;

function questionsOf(lines: Lines, facts: readonly YearFacts[], pandemic: Ec119 | null): readonly Question[] {
  const year = facts[facts.length - 1].year;
  const derived = [...FROM_FACTS.map((ask) => ask({ lines, facts, pandemic })), ...BASELINE.map((q) => q(year))].filter(
    (q): q is Question => q != null,
  );
  const firstPerTopic = derived.filter((q, i) => derived.findIndex((d) => d.topic === q.topic) === i);
  return [...firstPerTopic.slice(0, MAX_DERIVED), ...STATIC];
}
