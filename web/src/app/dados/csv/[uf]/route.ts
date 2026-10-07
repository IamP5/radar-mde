import { YEARS, allCities, citiesOf, shortfall } from "@/lib/data";
import { UFS, getRegion, getUf } from "@/lib/geo";

export function generateStaticParams() {
  return [{ uf: "brasil" }, ...UFS.map((u) => ({ uf: u.uf.toLowerCase() }))];
}

/** One line per municipality and year: /dados/csv/brasil or /dados/csv/<uf>. */
export async function GET(_req: Request, { params }: RouteContext<"/dados/csv/[uf]">) {
  const { uf } = await params;
  const cities = uf === "brasil" ? allCities() : getUf(uf) ? citiesOf(uf) : null;
  if (!cities) return new Response("Not found", { status: 404 });
  const head = ["ibge", "municipio", "uf", "regiao", "regiao_intermediaria", "regiao_imediata", "populacao", "ano", "situacao", "mde_pct", "mde_aplicado_rs", "receita_impostos_rs", "faltou_rs", "fundeb_pessoal_pct", "fundeb_minimo_pct", "fundeb_nao_usado_pct", "por_aluno_rs", "saude_pct", "fonte"];
  const esc = (v: unknown) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [head.join(",")];
  for (const c of cities) {
    const region = getRegion(getUf(c.uf)!.region).name;
    for (const y of YEARS) {
      const r = c.years[y];
      if (!r) continue;
      lines.push(
        [c.id, c.name, c.uf, region, c.inter, c.imediata, c.pop, y, r.s === "nd" ? "nao_declarou" : "declarou", r.mde, r.mdeV, r.base, Math.round(shortfall(r)) || 0, r.fun, r.funMin, r.funLeft, r.perAluno, r.sau, r.src]
          .map(esc)
          .join(","),
      );
    }
  }
  return new Response("﻿" + lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="radar-mde-${uf}.csv"` },
  });
}
