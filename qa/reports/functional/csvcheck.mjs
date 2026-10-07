// Validates /dados/csv/<id> exports (round-2 schema, see qa/fixes/CONTRACT.md §6).
// Usage: BASE=http://localhost:3299 node reports/functional/csvcheck.mjs
import fs from "node:fs";
const B = process.env.BASE ?? "http://localhost:3210";
const cities = JSON.parse(fs.readFileSync(new URL("../../../web/src/data/cities.json", import.meta.url)));
const REG = { norte: ["RO", "AC", "AM", "RR", "PA", "AP", "TO"], nordeste: ["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"], "centro-oeste": ["MS", "MT", "GO", "DF"], sudeste: ["MG", "ES", "RJ", "SP"], sul: ["PR", "SC", "RS"] };
const parse = (line, sep) => {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch == '"' && line[i + 1] == '"') { cur += '"'; i++; } else if (ch == '"') q = false; else cur += ch; }
    else if (ch == '"') q = true; else if (ch == sep) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur); return out;
};
const SIT = new Set(["cumpriu", "limite", "abaixo", "nao_declarou", "sem_dado"]);
let fail = 0;
const ids = ["brasil", "sp", "df", "mt", "pa", "ac", "regiao-sul", "regiao-centro-oeste", "sp-excel", "regiao-norte-excel", "estados"];
for (const id of ids) {
  const excel = id.endsWith("-excel");
  const base = id.replace(/-excel$/, "");
  const sep = excel ? ";" : ",";
  const r = await fetch(`${B}/dados/csv/${id}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const t = new TextDecoder().decode(buf);
  const lines = t.replace(/^﻿/, "").replace(/\r/g, "").split("\n").filter(Boolean);
  const head = parse(lines[0], sep);
  const rows = lines.slice(1).map((l) => parse(l, sep));
  const ix = (k) => head.indexOf(k);
  const badCount = rows.filter((x) => x.length !== head.length).length;
  const num = (v) => Number(excel ? v.replace(",", ".") : v);
  const nonnum = rows.filter((x) => ["mde_pct", "ano", "faltou_rs"].some((k) => ix(k) >= 0 && x[ix(k)] !== "" && isNaN(num(x[ix(k)])))).length;
  const decimalDot = excel ? rows.filter((x) => /\d\.\d/.test(x[ix("mde_pct")])).length : 0;
  let cs = null;
  if (base === "brasil") cs = cities;
  else if (base.startsWith("regiao-")) cs = cities.filter((c) => REG[base.slice(7)].includes(c.uf));
  else if (base !== "estados") cs = cities.filter((c) => c.uf.toLowerCase() === base);
  const expected = cs ? cs.reduce((s, c) => s + Object.keys(c.years).length, 0) : 27 * 18;
  const nIds = new Set(rows.map((x) => x[0])).size;
  const badSit = rows.filter((x) => !SIT.has(x[ix("situacao_mde")])).length;
  const badEnvio = rows.filter((x) => !["declarou", "nao_declarou"].includes(x[ix("envio")])).length;
  const zeroUnknown = rows.filter((x) => x[ix("faltou_rs")] === "0" && (x[ix("envio")] === "nao_declarou" || (num(x[ix("mde_pct")]) < 25 && x[ix("receita_impostos_rs")] === ""))).length;
  const nan = /NaN|undefined|null/.test(t);
  const ok = r.status === 200 && bom && !badCount && !nonnum && rows.length === expected && (!cs || nIds === cs.length) && !badSit && !badEnvio && !zeroUnknown && !nan && !decimalDot && ix("situacao") < 0;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} /dados/csv/${id}: ${r.status} enc=${r.headers.get("content-encoding")} rows=${rows.length}/${expected} ids=${nIds}${cs ? "/" + cs.length : ""} cols=${head.length} badFieldCount=${badCount} nonNumeric=${nonnum} badSituacao=${badSit} badEnvio=${badEnvio} faltou0Unknown=${zeroUnknown} NaN=${nan} excelDotDecimals=${decimalDot}`);
}
console.log(fail ? `RESULT: FAIL (${fail})` : "RESULT: PASS");
process.exit(fail ? 1 : 0);
