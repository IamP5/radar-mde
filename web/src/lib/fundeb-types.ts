export type FundebCell = {
  /** VAAT before the Union top-up, R$ per student */
  vaat: number;
  /** VAAT after the Union top-up, R$ per student */
  vaatCom: number;
  /** Union VAAT complementation for the network, R$ */
  comp: number;
  /** Share of the top-up that must go to early childhood, percent */
  iei: number;
  /** 1 when the official VAAR beneficiary file lists this municipality */
  vaar: 0 | 1;
};

export type FundebPublication = {
  label: string;
  portaria: string;
  page: string;
  vaat: string;
  vaar: string;
  note?: string;
};

export type FundebCityView = {
  years: number[];
  floor: Record<string, number>;
  publications: Record<string, FundebPublication>;
  rows: Record<string, FundebCell>;
};

export type FundebMapYear = {
  floor: number;
  nReceive: number;
  nKnown: number;
  total: number;
  portaria: string;
  page: string;
  label: string;
};

/** Municipalities in one map scope. `mark` is aligned with `id`: 0 sem dado, 1 não recebe, 2 recebe. */
export type FundebMapPayload = {
  years: number[];
  byYear: Record<string, FundebMapYear>;
  id: number[];
  name: string[];
  uf: string[];
  slug: string[];
  mark: Record<string, string>;
};

export const FUNDEB_CSV_COLUMNS: { key: string; label: string }[] = [
  { key: "ibge", label: "Código IBGE do município (7 dígitos)" },
  { key: "municipio", label: "Nome do município" },
  { key: "uf", label: "Sigla da UF" },
  { key: "ano", label: "Exercício do Fundeb a que a publicação se refere" },
  { key: "vaat_rs", label: "VAAT antes da complementação da União, R$ por aluno, valor nominal da portaria" },
  { key: "vaat_com_complementacao_rs", label: "VAAT depois da complementação da União, R$ por aluno, valor nominal" },
  { key: "complementacao_vaat_rs", label: "Complementação da União-VAAT no exercício, R$ nominais (0 = não recebe)" },
  { key: "vaat_min_rs", label: "VAAT-MIN nacional do exercício, R$ por aluno" },
  { key: "iei_pct", label: "IEI: percentual da complementação-VAAT que deve ir para a educação infantil" },
  { key: "vaar", label: "1 = a rede está na lista oficial de beneficiárias da complementação-VAAR; 0 = não está" },
  { key: "publicacao", label: "Publicação do FNDE usada para o exercício" },
  { key: "portaria", label: "Portaria interministerial MEC/MF da publicação" },
];

export function fundebSentence(cell: FundebCell, floor: number): string {
  if (cell.comp > 0) return "Abaixo do piso nacional. A União complementa a rede até esse piso.";
  if (cell.vaat + 0.001 < floor) return "Abaixo do piso nacional, sem complementação da União nesta publicação.";
  return "Acima do piso nacional. A União não complementa esta rede.";
}
