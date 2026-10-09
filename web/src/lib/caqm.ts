export const STAGES = [
  {
    id: "creche",
    label: "Creche",
    share: 18,
    teachersPerClass: 2,
    partialHours: 4,
    fullHours: 10,
    mealPartial: 3.14,
    mealFull: 3.14,
  },
  {
    id: "pre",
    label: "Pré-escola",
    share: 16,
    teachersPerClass: 1,
    partialHours: 4,
    fullHours: 10,
    mealPartial: 1.64,
    mealFull: 3.14,
  },
  {
    id: "ef",
    label: "Ensino fundamental",
    share: 61,
    teachersPerClass: 1,
    partialHours: 4,
    fullHours: 7,
    mealPartial: 1.14,
    mealFull: 3.14,
  },
  {
    id: "eja",
    label: "EJA",
    share: 5,
    teachersPerClass: 1,
    partialHours: 4,
    fullHours: 4,
    mealPartial: 1.14,
    mealFull: 1.14,
    classSize: 20,
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const LABOR = {
  weeklyHours: 40,
  salaryMonths: 13.3,
  employerRate: 0.2,
  adminShare: 0.075,
  schoolDays: 200,
} as const;

export const THESIS_CRECHE_QUEUE = 7116;

export type QualityParams = {
  crecheClass: number;
  preClass: number;
  efClass: number;
  teacherMonthly: number;
  planningShare: number;
  fullTimeShare: number;
  crecheExtra: number;
  overheadShare: number;
};

export type Mix = Record<StageId, number>;

export const DEFAULT_PARAMS: QualityParams = {
  crecheClass: 18,
  preClass: 20,
  efClass: 22,
  teacherMonthly: 7687.01,
  planningShare: 1 / 3,
  fullTimeShare: 0.25,
  crecheExtra: 0,
  overheadShare: 0.225,
};

export const DEFAULT_MIX: Mix = {
  creche: STAGES[0].share,
  pre: STAGES[1].share,
  ef: STAGES[2].share,
  eja: STAGES[3].share,
};

const RANGE = {
  crecheClass: [8, 30],
  preClass: [8, 35],
  efClass: [8, 40],
  teacherMonthly: [1000, 40000],
  planningShare: [0, 0.6],
  fullTimeShare: [0, 1],
  crecheExtra: [0, 500_000],
  overheadShare: [0, 0.8],
} as const satisfies Record<keyof QualityParams, readonly [number, number]>;

const CLASS_OF: Record<Exclude<StageId, "eja">, keyof QualityParams> = {
  creche: "crecheClass",
  pre: "preClass",
  ef: "efClass",
};

export type YearSnapshot = {
  year: number;
  existed: boolean;
  mde: number | null;
  mdeV: number | null;
  base: number | null;
  perAluno: number | null;
  fun: number | null;
  estimatedSpending: boolean;
};

export type StageResult = {
  id: StageId;
  label: string;
  enrolment: number;
  classes: number;
  classSize: number;
  teacherCost: number;
  mealCost: number;
  overhead: number;
  admin: number;
  total: number;
  perStudent: number | null;
};

export type CaqmResult = {
  stages: StageResult[];
  enrolment: number;
  total: number;
  perStudent: number | null;
  teacherPayroll: number;
  crechePlaces: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function classSize(id: StageId, params: QualityParams): number {
  if (id === "eja") return STAGES[3].classSize;
  return params[CLASS_OF[id]];
}

export function impliedEnrolment(mdeV: number | null, perAluno: number | null): number | null {
  if (mdeV == null || perAluno == null || mdeV <= 0 || perAluno <= 0) return null;
  return Math.round(mdeV / perAluno);
}

export function annualTeacherCost(monthly: number): number {
  return round2(monthly * LABOR.salaryMonths * (1 + LABOR.employerRate));
}

export function teachersPerClass(teachersInRoom: number, studentHours: number, planningShare: number): number {
  const contact = LABOR.weeklyHours * (1 - planningShare);
  return (teachersInRoom * studentHours) / contact;
}

function splitEnrolment(total: number, weights: number[]): number[] {
  if (total <= 0) return weights.map(() => 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map((v) => Math.floor(v));
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - base[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const slot of order) {
    if (left <= 0) break;
    base[slot.i] += 1;
    left -= 1;
  }
  return base;
}

export function simulate(totalEnrolment: number, mix: Mix, params: QualityParams): CaqmResult {
  const total = Math.max(0, Math.round(finite(totalEnrolment, 0)));
  const weights = STAGES.map((s) => Math.max(0, finite(mix[s.id], 0)));
  const heads = splitEnrolment(total, weights);
  heads[0] += Math.max(0, Math.round(finite(params.crecheExtra, 0)));

  const annual = annualTeacherCost(params.teacherMonthly);
  const stages: StageResult[] = STAGES.map((stage, i) => {
    const enrolment = heads[i];
    const size = classSize(stage.id, params);
    const classes = enrolment > 0 ? Math.ceil(enrolment / size) : 0;
    const partial = teachersPerClass(stage.teachersPerClass, stage.partialHours * 5, params.planningShare);
    const full = teachersPerClass(stage.teachersPerClass, stage.fullHours * 5, params.planningShare);
    const fte = classes * ((1 - params.fullTimeShare) * partial + params.fullTimeShare * full);
    const teacherCost = round2(fte * annual);
    const mealDay = (1 - params.fullTimeShare) * stage.mealPartial + params.fullTimeShare * stage.mealFull;
    const mealCost = round2(enrolment * LABOR.schoolDays * mealDay);
    const overhead = round2(teacherCost * params.overheadShare);
    const admin = round2(teacherCost * LABOR.adminShare);
    const stageTotal = round2(teacherCost + mealCost + overhead + admin);
    return {
      id: stage.id,
      label: stage.label,
      enrolment,
      classes,
      classSize: size,
      teacherCost,
      mealCost,
      overhead,
      admin,
      total: stageTotal,
      perStudent: enrolment > 0 ? round2(stageTotal / enrolment) : null,
    };
  });

  const sum = round2(stages.reduce((a, s) => a + s.total, 0));
  const enrolled = stages.reduce((a, s) => a + s.enrolment, 0);
  return {
    stages,
    enrolment: enrolled,
    total: sum,
    perStudent: enrolled > 0 ? round2(sum / enrolled) : null,
    teacherPayroll: round2(stages.reduce((a, s) => a + s.teacherCost, 0)),
    crechePlaces: stages[0].enrolment,
  };
}

const PARAM_URL: Record<keyof QualityParams, string> = {
  crecheClass: "cc",
  preClass: "pc",
  efClass: "ec",
  teacherMonthly: "rem",
  planningShare: "ha",
  fullTimeShare: "ti",
  crecheExtra: "vagas",
  overheadShare: "ins",
};

const PERCENT_PARAMS = new Set<keyof QualityParams>(["planningShare", "fullTimeShare", "overheadShare"]);

function paramToUrl(key: keyof QualityParams, value: number): string {
  if (!PERCENT_PARAMS.has(key)) return String(value);
  const pct = Math.round(value * 1000) / 10;
  return String(pct);
}

function paramFromUrl(key: keyof QualityParams, raw: string): number {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return DEFAULT_PARAMS[key];
  const value = PERCENT_PARAMS.has(key) ? n / 100 : n;
  if (key === "planningShare" && Math.abs(value - 1 / 3) < 0.0006) return 1 / 3;
  const [min, max] = RANGE[key];
  const clamped = clamp(value, min, max);
  if (key === "crecheClass" || key === "preClass" || key === "efClass" || key === "crecheExtra") return Math.round(clamped);
  return clamped;
}

export function clampParams(partial: Partial<QualityParams>): QualityParams {
  const next = { ...DEFAULT_PARAMS };
  (Object.keys(DEFAULT_PARAMS) as (keyof QualityParams)[]).forEach((key) => {
    const raw = partial[key];
    if (raw == null) return;
    next[key] = paramFromUrl(key, String(PERCENT_PARAMS.has(key) ? raw * 100 : raw));
  });
  return next;
}

function sameParam(key: keyof QualityParams, value: number): boolean {
  return Math.abs(value - DEFAULT_PARAMS[key]) < 1e-9;
}

function sameMix(mix: Mix): boolean {
  return STAGES.every((s) => Math.abs(mix[s.id] - DEFAULT_MIX[s.id]) < 1e-9);
}

export type EnrolmentChoice = { kind: "implied" } | { kind: "stated"; total: number };

export type Scenario = {
  year: number;
  params: QualityParams;
  enrolment: EnrolmentChoice;
  mix: Mix;
};

export function parseScenario(search: string, years: number[], initialYear: number): Scenario {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const ano = Number(q.get("ano"));
  const year = years.includes(ano) ? ano : initialYear;
  const params = { ...DEFAULT_PARAMS };
  (Object.keys(PARAM_URL) as (keyof QualityParams)[]).forEach((key) => {
    const raw = q.get(PARAM_URL[key]);
    if (raw != null && raw !== "") params[key] = paramFromUrl(key, raw);
  });
  const mat = q.get("mat");
  let enrolment: EnrolmentChoice = { kind: "implied" };
  if (mat != null && mat !== "") {
    const n = Math.round(Number(mat.replace(",", ".")));
    if (Number.isFinite(n) && n > 0) enrolment = { kind: "stated", total: Math.min(2_000_000, n) };
  }
  const mix = { ...DEFAULT_MIX };
  for (const stage of STAGES) {
    const raw = q.get(stage.id);
    if (raw == null || raw === "") continue;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) continue;
    mix[stage.id] = clamp(n, 0, 100);
  }
  return { year, params, enrolment, mix };
}

export function scenarioQuery(scenario: Scenario, initialYear: number, implied: number | null): string {
  const q = new URLSearchParams();
  if (scenario.year !== initialYear) q.set("ano", String(scenario.year));
  (Object.keys(PARAM_URL) as (keyof QualityParams)[]).forEach((key) => {
    if (sameParam(key, scenario.params[key])) return;
    q.set(PARAM_URL[key], paramToUrl(key, scenario.params[key]));
  });
  if (scenario.enrolment.kind === "stated" && scenario.enrolment.total !== implied) q.set("mat", String(scenario.enrolment.total));
  if (!sameMix(scenario.mix)) {
    for (const stage of STAGES) q.set(stage.id, String(scenario.mix[stage.id]));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

export function proposalCsv(city: string, uf: string, year: number, result: CaqmResult): string {
  const header = ["municipio", "uf", "exercicio", "etapa", "matriculas", "turmas", "rs_total", "rs_por_aluno"];
  const row = (cells: string[]) => cells.map(csvCell).join(",");
  const lines = result.stages.map((s) =>
    row([city, uf, String(year), s.label, String(s.enrolment), String(s.classes), s.total.toFixed(2), s.perStudent == null ? "" : s.perStudent.toFixed(2)]),
  );
  lines.push(row([city, uf, String(year), "Total", String(result.enrolment), "", result.total.toFixed(2), result.perStudent == null ? "" : result.perStudent.toFixed(2)]));
  return `\uFEFF${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
