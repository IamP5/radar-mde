/** Brazilian territorial hierarchy (IBGE): Brasil › Grande Região › UF › Município. Client-safe. */

export type RegionKey = "N" | "NE" | "SE" | "S" | "CO";

export type UfInfo = { uf: string; code: number; name: string; region: RegionKey };

export const UFS: UfInfo[] = [
  { uf: "RO", code: 11, name: "Rondônia", region: "N" },
  { uf: "AC", code: 12, name: "Acre", region: "N" },
  { uf: "AM", code: 13, name: "Amazonas", region: "N" },
  { uf: "RR", code: 14, name: "Roraima", region: "N" },
  { uf: "PA", code: 15, name: "Pará", region: "N" },
  { uf: "AP", code: 16, name: "Amapá", region: "N" },
  { uf: "TO", code: 17, name: "Tocantins", region: "N" },
  { uf: "MA", code: 21, name: "Maranhão", region: "NE" },
  { uf: "PI", code: 22, name: "Piauí", region: "NE" },
  { uf: "CE", code: 23, name: "Ceará", region: "NE" },
  { uf: "RN", code: 24, name: "Rio Grande do Norte", region: "NE" },
  { uf: "PB", code: 25, name: "Paraíba", region: "NE" },
  { uf: "PE", code: 26, name: "Pernambuco", region: "NE" },
  { uf: "AL", code: 27, name: "Alagoas", region: "NE" },
  { uf: "SE", code: 28, name: "Sergipe", region: "NE" },
  { uf: "BA", code: 29, name: "Bahia", region: "NE" },
  { uf: "MG", code: 31, name: "Minas Gerais", region: "SE" },
  { uf: "ES", code: 32, name: "Espírito Santo", region: "SE" },
  { uf: "RJ", code: 33, name: "Rio de Janeiro", region: "SE" },
  { uf: "SP", code: 35, name: "São Paulo", region: "SE" },
  { uf: "PR", code: 41, name: "Paraná", region: "S" },
  { uf: "SC", code: 42, name: "Santa Catarina", region: "S" },
  { uf: "RS", code: 43, name: "Rio Grande do Sul", region: "S" },
  { uf: "MS", code: 50, name: "Mato Grosso do Sul", region: "CO" },
  { uf: "MT", code: 51, name: "Mato Grosso", region: "CO" },
  { uf: "GO", code: 52, name: "Goiás", region: "CO" },
  { uf: "DF", code: 53, name: "Distrito Federal", region: "CO" },
];

export type RegionInfo = { key: RegionKey; slug: string; name: string; ufs: string[] };

export const REGIONS: RegionInfo[] = (
  [
    ["N", "norte", "Norte"],
    ["NE", "nordeste", "Nordeste"],
    ["CO", "centro-oeste", "Centro-Oeste"],
    ["SE", "sudeste", "Sudeste"],
    ["S", "sul", "Sul"],
  ] as const
).map(([key, slug, name]) => ({ key, slug, name, ufs: UFS.filter((u) => u.region === key).map((u) => u.uf) }));

const ufBySigla = new Map(UFS.map((u) => [u.uf, u]));
const ufByCode = new Map(UFS.map((u) => [u.code, u]));
const regionByKey = new Map(REGIONS.map((r) => [r.key, r]));
const regionBySlug = new Map(REGIONS.map((r) => [r.slug, r]));

export const getUf = (sigla: string) => ufBySigla.get(sigla.toUpperCase());
export const ufOfCode = (ibge: number) => ufByCode.get(Math.floor(ibge / 100000));
export const getRegion = (key: RegionKey) => regionByKey.get(key)!;
export const getRegionBySlug = (slug: string) => regionBySlug.get(slug);
export const regionOfUf = (sigla: string) => getRegion(getUf(sigla)!.region);

/** "do Rio de Janeiro", "da Bahia", "de São Paulo" … for headlines. */
const ARTICLE: Record<string, "do" | "da" | "de"> = {
  AC: "do", AL: "de", AP: "do", AM: "do", BA: "da", CE: "do", DF: "do", ES: "do", GO: "de", MA: "do", MT: "de",
  MS: "de", MG: "de", PA: "do", PB: "da", PR: "do", PE: "de", PI: "do", RJ: "do", RN: "do", RS: "do", RO: "de",
  RR: "de", SC: "de", SP: "de", SE: "de", TO: "do",
};
export const ofUf = (sigla: string) => `${ARTICLE[sigla] ?? "de"} ${getUf(sigla)!.name}`;
export const ofRegion = (key: RegionKey) => (key === "S" ? "do Sul" : `do ${getRegion(key).name}`);

export function tribunal(c: { id: number; uf: string }): { name: string; short: string } {
  if (c.id === 3550308) return { name: "Tribunal de Contas do Município de São Paulo", short: "TCM-SP" };
  if (c.id === 3304557) return { name: "Tribunal de Contas do Município do Rio de Janeiro", short: "TCM-RJ" };
  if (c.uf === "DF") return { name: "Tribunal de Contas do Distrito Federal", short: "TCDF" };
  if (["BA", "GO", "PA"].includes(c.uf)) return { name: `Tribunal de Contas dos Municípios do Estado ${ofUf(c.uf)}`, short: `TCM-${c.uf}` };
  return { name: `Tribunal de Contas do Estado ${ofUf(c.uf)}`, short: `TCE-${c.uf}` };
}

// The Distrito Federal's only "municipality" is Brasília, whose page doubles as the DF dashboard
export const ufPath = (sigla: string) => (sigla.toUpperCase() === "DF" ? "/df/brasilia" : `/${sigla.toLowerCase()}`);
export const cityPath = (sigla: string, slug: string) => `/${sigla.toLowerCase()}/${slug}`;
export const councilPath = (sigla: string, slug: string) => `${cityPath(sigla, slug)}/conselho`;
export const regionPath = (key: RegionKey) => `/regiao/${getRegion(key).slug}`;

export type Scope =
  | { level: "br" }
  | { level: "region"; region: RegionKey }
  | { level: "uf"; uf: string };

export const scopeUfs = (s: Scope): string[] =>
  s.level === "br" ? UFS.map((u) => u.uf) : s.level === "region" ? getRegion(s.region).ufs : [s.uf];

export const scopeName = (s: Scope) =>
  s.level === "br" ? "Brasil" : s.level === "region" ? `Região ${getRegion(s.region).name}` : getUf(s.uf)!.name;
