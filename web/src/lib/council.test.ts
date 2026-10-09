import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { councilSheet, type CouncilCity, type CouncilSheet, type RuleLine } from "@/lib/council";
import type { City } from "@/lib/data";

const cities: City[] = JSON.parse(readFileSync(new URL("../data/cities.json", import.meta.url), "utf8"));
const city = (id: number) => cities.find((c) => c.id === id)!;
const yearsOf = (c: CouncilCity) => Object.keys(c.years).map(Number).sort((a, b) => a - b);
const sheet = (id: number, year: number) => councilSheet(city(id), yearsOf(city(id)), year);

const rule = (s: CouncilSheet, id: RuleLine["id"]) => s.checklist.find((l): l is RuleLine => l.kind === "rule" && l.id === id)!;
const readings = (l: RuleLine) => l.readings.map((r) => [r.source.short, r.figure, r.badge]);

const SANTO_ANDRE_SP = 3547809;
const SANTO_ANDRE_PB = 2513851;
const PAULINIA = 3536505;
const AMERICANA = 3501608;

test("Santo André SP 2016 prints the declared and the audited MDE side by side", () => {
  const mde = rule(sheet(SANTO_ANDRE_SP, 2016), "mde");
  assert.deepEqual(readings(mde), [
    ["SIOPE", "25,05%", "No limite (25–26%)"],
    ["TCE-SP", "21,87%", "Abaixo do mínimo"],
  ]);
  assert.equal(mde.note, "As fontes não concordam sobre o mínimo de 25% em 2016. Confirme na fonte.");
});

test("only the audited reading says Abaixo do mínimo; the declared one and the money block never do", () => {
  const s = sheet(SANTO_ANDRE_SP, 2016);
  const [declared, audited] = rule(s, "mde").readings;
  assert.ok(JSON.stringify(audited).includes("Abaixo do mínimo"));
  assert.ok(!JSON.stringify(declared).includes("Abaixo do mínimo"));
  assert.ok(!JSON.stringify(s.money).includes("Abaixo do mínimo"));
  assert.ok(s.money.basis.endsWith("TCE-SP indica 21,87% para este ano. Confirme na fonte."));
});

test("Santo André SP 2016 money follows the declared percent", () => {
  const { applied, required, gap } = sheet(SANTO_ANDRE_SP, 2016).money;
  assert.deepEqual(
    [applied, required, gap].map((r) => [r.label, r.value, r.note]),
    [
      ["Aplicado em MDE", "≈ R$ 325,8 mi", "estimativa do Radar (receita × percentual declarado)"],
      ["Mínimo exigido", "R$ 325,1 mi", "25% da receita de impostos e transferências"],
      ["Diferença para o mínimo", "+R$ 650 mil", "acima de 25%"],
    ],
  );
});

test("Santo André SP 2016 Fundeb lines use the 2016 limits", () => {
  const s = sheet(SANTO_ANDRE_SP, 2016);
  assert.deepEqual(
    [rule(s, "fundebPay"), rule(s, "fundebLeft")].map((l) => [l.scope, ...readings(l)]),
    [
      ["2016 · mínimo de 60%", ["SIOPE", "80,62%", "Cumpriu"]],
      ["2016 · máximo de 5%", ["SIOPE", "3,21%", "Cumpriu"]],
    ],
  );
});

test("the EC 119 line reads the declared 2021 gap as compensated by 2022 and 2023", () => {
  const ec = rule(sheet(SANTO_ANDRE_SP, 2016), "ec119");
  assert.deepEqual(readings(ec), [["SIOPE", "R$ 17,7 mi abaixo de 25% em 2021", "Cumpriu"]]);
  assert.equal(
    ec.note,
    "Pelos dados declarados, a aplicação acima de 25% em 2022 e 2023 (R$ 56,4 mi) parece ter coberto essa diferença, o que cabe ao Tribunal de Contas confirmar.",
  );
});

test("Santo André SP 2016 asks about 2012, 2014 and 2016 before the baseline and the fixed questions", () => {
  const { questions } = sheet(SANTO_ANDRE_SP, 2016);
  assert.equal(
    questions[0].text,
    "Em 2012, 2014 e 2016, pelo menos uma das fontes (SIOPE ou TCE-SP) indica aplicação abaixo de 25% em MDE. Que medidas foram adotadas para compensar essa diferença?",
  );
  assert.deepEqual(
    questions.map((q) => q.topic),
    ["compensation", "ec119", "glosas", "cacs", "beyondPayroll", "lom", "contracts", "convenios", "creche", "schools"],
  );
});

test("the five-year table adds the audited column and ends at the selected year", () => {
  const { history } = sheet(SANTO_ANDRE_SP, 2016);
  assert.deepEqual(history.columns, ["MDE declarado", "MDE apurado (TCE-SP)", "Fundeb na remuneração", "Por aluno*"]);
  assert.deepEqual(
    history.rows.map((r) => r.year),
    [2012, 2013, 2014, 2015, 2016],
  );
  const last = history.rows[4];
  assert.equal(last.selected, true);
  assert.deepEqual(
    last.cells.map((c) => c.text),
    ["25,05%", "21,87%", "80,62%", "R$\u00a016.564"],
  );
  assert.equal(
    history.footnote,
    "* Por aluno em R$ de 2025, corrigidos pelo IPCA (inflação). Os outros valores desta ficha estão em reais do ano, sem essa correção.",
  );
});

test("Tesouro joins the selected year's MDE line but never the table", () => {
  const s = sheet(AMERICANA, 2019);
  assert.deepEqual(readings(rule(s, "mde")), [
    ["SIOPE", "24,76%", "Abaixo do mínimo"],
    ["Tesouro", "26,92%", "Cumpriu"],
  ]);
  assert.deepEqual(s.history.columns, ["MDE declarado", "Fundeb na remuneração", "Por aluno*"]);
  assert.equal(s.money.gap.value, "−R$ 1,3 mi");
});

test("Santo André PB has one MDE reading: the SP audit is keyed by IBGE id, not by name", () => {
  const s = sheet(SANTO_ANDRE_PB, 2016);
  assert.deepEqual(readings(rule(s, "mde")), [["SIOPE", "26,31%", "Cumpriu"]]);
  assert.deepEqual(s.history.columns, ["MDE declarado", "Fundeb na remuneração", "Por aluno*"]);
  assert.deepEqual(readings(rule(s, "fundebLeft")), [["SIOPE", "0,00%", "Cumpriu"]], "a declared 0 stays 0");
});

test("Paulínia 2025, a year not declared, still yields the whole sheet", () => {
  const s = sheet(PAULINIA, 2025);
  assert.deepEqual(
    s.checklist.map((l) => l.id),
    ["mde", "fundebPay", "fundebLeft", "ec119", "declared", "atypical"],
  );
  for (const id of ["mde", "fundebPay", "fundebLeft"] as const) assert.deepEqual(readings(rule(s, id)), [["SIOPE", "sem dado", "Não declarou"]]);
  assert.deepEqual(readings(rule(s, "declared")), [["SIOPE", "4 de 5 exercícios declarados", "Não declarou"]]);
  assert.equal(rule(s, "declared").note, "Não há registro de envio dos dados de 2025.");
  assert.deepEqual(
    [s.money.applied, s.money.required, s.money.gap].map((r) => r.value),
    ["Não declarou", "Não declarou", "Não declarou"],
  );
  assert.equal(
    s.money.basis,
    "O município não declarou os dados de 2025. O último exercício declarado nesta ficha é 2024, com 32,16% em MDE na tabela abaixo.",
  );
  assert.deepEqual(
    s.history.rows.at(-1)!.cells.map((c) => c.text),
    ["Não declarou", "Não declarou", "Não declarou"],
  );
  assert.equal(s.questions[0].text, "Não há registro de envio ao SIOPE dos dados de MDE de 2025. Há previsão de envio?");
  assert.equal(s.questions.length, 9);
});

const synthetic = (years: CouncilCity["years"]): CouncilCity => ({ id: 1, name: "Teste", uf: "SP", slug: "teste", years });
const at = (years: CouncilCity["years"], year: number) => councilSheet(synthetic(years), yearsOf(synthetic(years)), year);

test("Fundeb limits are inclusive, and a missing figure is no data rather than a violation", () => {
  const met = at({ 2021: { s: "ok", mde: 30, fun: 70, funLeft: 10 } }, 2021);
  assert.deepEqual([...readings(rule(met, "fundebPay")), ...readings(rule(met, "fundebLeft"))], [
    ["SIOPE", "70,00%", "Cumpriu"],
    ["SIOPE", "10,00%", "Cumpriu"],
  ]);
  const missed = at({ 2021: { s: "ok", mde: 30, fun: 69.99, funLeft: 10.01 } }, 2021);
  assert.deepEqual([...readings(rule(missed, "fundebPay")), ...readings(rule(missed, "fundebLeft"))], [
    ["SIOPE", "69,99%", "Abaixo do mínimo"],
    ["SIOPE", "10,01%", "Acima do limite"],
  ]);
  const blank = at({ 2021: { s: "ok", mde: 30, fun: 80 } }, 2021);
  assert.deepEqual(readings(rule(blank, "fundebLeft")), [["SIOPE", "sem dado", "Sem dados"]]);
});

test("a declared 0 is a figure, not a missing value", () => {
  const s = at({ 2019: { s: "ok", mde: 0, mdeV: 0, base: 1000 } }, 2019);
  assert.deepEqual(readings(rule(s, "mde")), [["SIOPE", "0,00%", "Abaixo do mínimo"]]);
  assert.equal(s.money.applied.value, "R$\u00a00");
});

test("an EC 119 line with no surplus does not call that an application above 25%", () => {
  const s = at(
    {
      2020: { s: "ok", mde: 20, base: 100_000_000 },
      2021: { s: "ok", mde: 20, base: 100_000_000 },
      2022: { s: "ok", mde: 24, base: 100_000_000 },
      2023: { s: "ok", mde: 24, base: 100_000_000 },
    },
    2023,
  );
  const note = rule(s, "ec119").note ?? "";
  assert.match(note, /2022 e 2023 não registram aplicação acima de 25%/);
  assert.equal(note.includes("aplicação acima de 25% em 2022"), false);
  assert.match(
    s.questions.find((q) => q.topic === "compensation")?.text ?? "",
    /abaixo de 25% em 2022 e 2023\. 2020 e 2021 entram na compensação da pandemia, não nesta lista/,
  );
});

test("an EC 119 gap that 2022 and 2023 do not cover reads Não compensado", () => {
  const s = at(
    {
      2020: { s: "ok", mde: 20, base: 100_000_000 },
      2021: { s: "ok", mde: 30, base: 100_000_000 },
      2022: { s: "ok", mde: 26, base: 100_000_000 },
      2023: { s: "ok", mde: 25, base: 100_000_000 },
    },
    2023,
  );
  assert.deepEqual(readings(rule(s, "ec119")), [["SIOPE", "R$ 5 mi abaixo de 25% em 2020", "Não compensado"]]);
  assert.equal(
    s.questions.find((q) => q.topic === "ec119")?.text,
    "Pelos dados declarados, a aplicação em 2022 e 2023 não cobriu a diferença de R$ 5 mi de 2020. Como fica a compensação prevista na EC 119/2022?",
  );
});
