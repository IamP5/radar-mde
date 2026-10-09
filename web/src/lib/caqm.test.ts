import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MIX,
  DEFAULT_PARAMS,
  impliedEnrolment,
  parseScenario,
  proposalCsv,
  scenarioQuery,
  simulate,
} from "./caqm.ts";

const years = [2024, 2025];

test("implicit enrolment rounds MDE reais over the per-student figure", () => {
  assert.equal(impliedEnrolment(690_998_238, 20_518), 33_678);
  assert.equal(impliedEnrolment(7_250_961, 48_865), 148);
  assert.equal(impliedEnrolment(null, 20_518), null);
  assert.equal(impliedEnrolment(100, 0), null);
});

test("a round classroom prices teacher time, meals and the payroll shares", () => {
  const params = {
    ...DEFAULT_PARAMS,
    teacherMonthly: 1000,
    fullTimeShare: 0,
    overheadShare: 0.225,
    crecheExtra: 0,
    planningShare: 1 / 3,
  };
  const mix = { creche: 0, pre: 0, ef: 100, eja: 0 };
  const result = simulate(20, mix, { ...params, efClass: 20 });
  const ef = result.stages.find((s) => s.id === "ef");
  assert.ok(ef);
  assert.equal(ef.enrolment, 20);
  assert.equal(ef.classes, 1);
  assert.equal(ef.teacherCost, 11970);
  assert.equal(ef.mealCost, 4560);
  assert.equal(ef.overhead, 2693.25);
  assert.equal(ef.admin, 897.75);
  assert.equal(ef.total, 20121);
  assert.equal(result.total, 20121);
  assert.equal(result.perStudent, 1006.05);
});

test("a smaller class raises the cost and extra creche places add enrolment", () => {
  const params = {
    ...DEFAULT_PARAMS,
    teacherMonthly: 1000,
    fullTimeShare: 0,
    overheadShare: 0.225,
    planningShare: 1 / 3,
    crecheExtra: 0,
    efClass: 10,
  };
  const smaller = simulate(20, { creche: 0, pre: 0, ef: 100, eja: 0 }, params);
  assert.equal(smaller.stages.find((s) => s.id === "ef")?.classes, 2);
  assert.equal(smaller.total, 35682);

  const withPlaces = simulate(20, { ...DEFAULT_MIX }, { ...DEFAULT_PARAMS, crecheExtra: 10, teacherMonthly: 1000, fullTimeShare: 0 });
  const without = simulate(20, { ...DEFAULT_MIX }, { ...DEFAULT_PARAMS, crecheExtra: 0, teacherMonthly: 1000, fullTimeShare: 0 });
  assert.equal(withPlaces.crechePlaces, without.crechePlaces + 10);
  assert.ok(withPlaces.total > without.total);
});

test("the query string round-trips a changed parameter and ignores junk", () => {
  const parsed = parseScenario("?ano=2024&cc=12&ha=40&rem=nao", years, 2025);
  assert.equal(parsed.year, 2024);
  assert.equal(parsed.params.crecheClass, 12);
  assert.equal(parsed.params.planningShare, 0.4);
  assert.equal(parsed.params.teacherMonthly, DEFAULT_PARAMS.teacherMonthly);
  const again = parseScenario(scenarioQuery(parsed, 2025, 100), years, 2025);
  assert.deepEqual(again.params, parsed.params);
  assert.equal(again.year, parsed.year);
  assert.equal(parseScenario("?ano=1800", years, 2025).year, 2025);
});

test("csv names the city and the stage totals", () => {
  const result = simulate(20, { creche: 0, pre: 0, ef: 100, eja: 0 }, { ...DEFAULT_PARAMS, teacherMonthly: 1000, fullTimeShare: 0, efClass: 20 });
  const csv = proposalCsv("Serra da Saudade", "MG", 2025, result);
  assert.match(csv, /Serra da Saudade,MG,2025,Ensino fundamental,20,1,20121\.00,1006\.05/);
  assert.match(csv, /Total,20,,20121\.00,1006\.05/);
});
