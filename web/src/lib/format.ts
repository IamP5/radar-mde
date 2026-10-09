/** Rules, formatting and per-record helpers shared by server and client code. */

export const MDE_MIN = 25;
/** EC 119/2022: shortfalls in 2020–2021 (pandemic) are not punishable if compensated by 2023. */
export const PANDEMIC_YEARS = new Set<number>([2020, 2021]);
/** Fundeb share that must pay education professionals: 60% (magistério) until 2020, 70% from 2021. */
export const funMin = (year: number) => (year >= 2021 ? 70 : 60);
/** Max % of Fundeb revenue that may be left for the next year: 5% (Lei 11.494/2007), 10% from 2021 (Lei 14.113/2020). */
export const fundebLeftMax = (year: number) => (year >= 2021 ? 10 : 5);

export type YearRecord = {
  /** "ok" = report delivered, "nd" = nothing declared to SIOPE/SICONFI */
  s: "ok" | "nd";
  /** % of tax revenue applied in MDE (Manutenção e Desenvolvimento do Ensino) */
  mde?: number;
  /** R$ applied in MDE */
  mdeV?: number;
  /** R$ tax revenue base (impostos + transferências) */
  base?: number;
  /** % of Fundeb spent on education professionals' pay */
  fun?: number;
  funMin?: number;
  /** % applied in health (ASPS, min 15%) — São Paulo only, from SICONFI */
  sau?: number;
  /** which system the figures came from */
  src?: "siope" | "siconfi";
  /** Treasury (SICONFI) MDE % when it disagrees with SIOPE by ≥ 1 p.p. (São Paulo only) */
  alt?: number;
  /** % of Fundeb revenue left unspent in the year */
  funLeft?: number;
  /** % of all municipal spending that went to education */
  eduShare?: number;
  /** R$ invested per enrolled student (SIOPE indicator 4.9) */
  perAluno?: number;
};

export type Status = "below" | "edge" | "ok" | "nodata" | "notdelivered";

export function mdeStatus(r: YearRecord | undefined): Status {
  if (!r) return "nodata";
  if (r.s === "nd") return "notdelivered";
  if (r.mde == null) return "nodata";
  if (r.mde < MDE_MIN) return "below";
  if (r.mde < MDE_MIN + 1) return "edge";
  return "ok";
}

export const STATUS_LABEL: Record<Status, string> = {
  below: "Abaixo do mínimo",
  edge: "No limite (25–26%)",
  ok: "Cumpriu",
  nodata: "Sem dados",
  notdelivered: "Não declarou",
};

/** Values far from the usual 25–40% band are often filing errors; flag them instead of asserting. */
export const isAtypical = (v: number | null | undefined) => v != null && (v < 18 || v > 45);

/** R$ that 25% of a tax base comes to. */
export const requiredMde = (base: number) => (MDE_MIN / 100) * base;

/** R$ above (+) or below (−) the 25% minimum in one year. Null without a declared % or a tax base. */
export function mdeBalance(r: YearRecord | undefined): number | null {
  return r?.mde != null && r.base != null ? ((r.mde - MDE_MIN) / 100) * r.base : null;
}

/** Shortfall in R$ for one year (0 when the minimum was met). */
export const shortfall = (r: YearRecord | undefined): number => Math.max(0, -(mdeBalance(r) ?? 0));

/** EC 119/2022: years whose application above 25% may make up a 2020–2021 shortfall. */
const EC119_MAKEUP_YEARS = [2022, 2023];

export type Ec119 = { below: number[]; short: number; surplus: number; state: "compensated" | "open" | "unknown" };

/** EC 119/2022 over a municipality's records. Null when neither 2020 nor 2021 is below 25%. */
export function ec119(recs: Partial<Record<string, YearRecord>>): Ec119 | null {
  const below = [...PANDEMIC_YEARS].filter((y) => (recs[y]?.mde ?? 99) < MDE_MIN);
  if (!below.length) return null;
  const short = below.reduce((s, y) => s + shortfall(recs[y]), 0);
  const unknown =
    below.some((y) => recs[y]?.base == null) || EC119_MAKEUP_YEARS.some((y) => recs[y]?.mde == null || recs[y]?.base == null);
  const surplus = EC119_MAKEUP_YEARS.reduce((s, y) => s + Math.max(0, mdeBalance(recs[y]) ?? 0), 0);
  return { below, short, surplus, state: unknown ? "unknown" : surplus >= short ? "compensated" : "open" };
}

/** "2019", "2019 e 2021", "2016, 2019 e 2020 a 2025" (consecutive runs of 3+ collapse to "a"). */
export function listYears(ys: readonly number[]): string {
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

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function brlShort(v: number) {
  const a = Math.abs(v);
  if (a >= 1e9) {
    // 3 significant figures, so IPCA corrections on large totals stay visible ("R$ 1,03 bi", "R$ 14,2 bi")
    const d = a < 1e10 ? 2 : a < 1e11 ? 1 : 0;
    return `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: d })} bi`;
  }
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return brl(v);
}

/** Signed short BRL: "+R$ 12 mi", "−R$ 3,4 bi" (true minus sign, zero without sign). */
export const brlSigned = (v: number) => (Math.abs(v) < 0.5 ? "R$ 0" : `${v > 0 ? "+" : "−"}${brlShort(Math.abs(v))}`);

export const pct = (v: number | null | undefined, digits = 2) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const int = (v: number) => v.toLocaleString("pt-BR");

/** Share as "12%" / "0,4%" — keeps one decimal only when it matters. */
export const share = (part: number, whole: number) => {
  if (!whole) return "—";
  const v = (part / whole) * 100;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v > 0 && v < 10 ? 1 : 0 })}%`;
};

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Search key: accent-, case- and punctuation-insensitive ("Santa Bárbara d’Oeste" ≡ "santa barbara d oeste"). */
export const normKey = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();

export const POP_BANDS = [
  { key: "p1", label: "Até 5 mil", test: (p: number) => p <= 5000 },
  { key: "p2", label: "5 a 20 mil", test: (p: number) => p > 5000 && p <= 20000 },
  { key: "p3", label: "20 a 100 mil", test: (p: number) => p > 20000 && p <= 100000 },
  { key: "p4", label: "100 a 500 mil", test: (p: number) => p > 100000 && p <= 500000 },
  { key: "p5", label: "Mais de 500 mil", test: (p: number) => p > 500000 },
] as const;
export const popBand = (p: number) => POP_BANDS.find((b) => b.test(p))!;

export const siopeUrl = (ibge: number, uf: string, year: number) => {
  const base =
    "https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata/Indicadores_Siope(Ano_Consulta=@Ano_Consulta,Num_Peri=@Num_Peri,Sig_UF=@Sig_UF)";
  const q = `?@Ano_Consulta=${year}&@Num_Peri=${year < 2017 ? 1 : 6}&@Sig_UF='${uf}'&$format=json`;
  // Brasília is filed as the Distrito Federal's own ("Estadual") declaration
  return uf === "DF" ? `${base}${q}` : `${base}${q}&$filter=COD_MUNI%20eq%20${Math.floor(ibge / 10)}`;
};

export const siconfiUrl = (ibge: number, year: number) =>
  `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=${year}&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2014&id_ente=${ibge}`;
