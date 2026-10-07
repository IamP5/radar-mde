// Functional crawl / regression test for Radar MDE.
// Usage: cd qa && node reports/functional/crawl.mjs [--base http://localhost:3210] [--links all|sample]
// Prints a PASS/FAIL summary and writes crawl-results.json next to this file.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3210";
const LINKS = args.includes("--links") ? args[args.indexOf("--links") + 1] : "sample";
const DATA = path.resolve(HERE, "../../../web/src/data");

const cities = JSON.parse(fs.readFileSync(path.join(DATA, "cities.json"), "utf8"));
const UFS = [...new Set(cities.map((c) => c.uf))].sort();
const REGIONS = ["norte", "nordeste", "centro-oeste", "sudeste", "sul"];

// ---- deterministic city sample ----
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const sample = new Map();
const add = (c) => sample.set(`/${c.uf.toLowerCase()}/${c.slug}`, c);
for (const c of cities) if (c.capital) add(c);
for (const uf of UFS) {
  const list = cities.filter((c) => c.uf === uf && !c.capital);
  for (let i = 0; i < 2 && list.length; i++) add(list[Math.floor(rnd() * list.length)]);
}
const tricky = [
  "df/brasilia", "sp/santa-barbara-d-oeste", "pa/pau-d-arco", "to/pau-d-arco", "mt/boa-esperanca-do-norte",
  "ma/olho-d-agua-das-cunhas", "ro/alta-floresta-d-oeste", "sp/santo-andre", "sp/sao-paulo", "rj/rio-de-janeiro",
  "go/aparecida-de-goiania", "rs/sant-ana-do-livramento", "sc/balneario-camboriu", "pe/fernando-de-noronha", "mg/sao-joao-del-rei",
  "ba/dias-d-avila", "pb/mae-d-agua", "rn/olho-d-agua-do-borges", "pi/pau-d-arco-do-piaui", "sp/embu-guacu",
];
for (const t of tricky) {
  const [uf, slug] = t.split("/");
  const c = cities.find((x) => x.uf.toLowerCase() === uf && x.slug === slug);
  if (c) add(c);
  else console.log("  (tricky slug not in dataset, skipped:", t, ")");
}
// cities not declaring in the last year ('sem dado' / nd cases)
const LAST = "2025";
for (const c of cities.filter((c) => c.years[LAST]?.s === "nd").slice(0, 10)) add(c);

const pages = [
  "/", "/explorar", "/acompanhar", "/dados", "/sobre",
  ...REGIONS.map((r) => `/regiao/${r}`),
  ...UFS.map((u) => `/${u.toLowerCase()}`),
  ...sample.keys(),
];
const notFound = ["/xx", "/sp/nao-existe", "/regiao/foo", "/SP", "/sp/Santo-Andre", "/dados/csv/xx"];

const BAD_TEXT = /\b(NaN|undefined|Infinity|null)\b|\[object Object\]/;
const CONSOLE_BAD = /hydrat|did not match|unique "key"|Warning:|Error/i;

const results = [];
const linkSet = new Set();
const t0 = Date.now();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

async function visit(url) {
  const page = await ctx.newPage();
  const r = { url, status: 0, console: [], pageerrors: [], failed: [], badText: [], emptyCharts: 0, charts: 0 };
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && CONSOLE_BAD.test(m.text())) r.console.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => r.pageerrors.push(e.message.slice(0, 300)));
  page.on("requestfailed", (q) => {
    const f = q.failure()?.errorText ?? "";
    if (!/ERR_ABORTED/.test(f)) r.failed.push(`${q.url()} ${f}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().startsWith(BASE) && res.url() !== BASE + url) r.failed.push(`${res.status()} ${res.url()}`);
  });
  try {
    const res = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 120000 });
    r.status = res?.status() ?? 0;
    r.finalUrl = page.url().replace(BASE, "");
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const text = document.querySelector("main")?.innerText ?? document.body.innerText;
      const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
      const wrappers = [...document.querySelectorAll(".recharts-wrapper")];
      const empty = wrappers.filter((w) => !w.querySelector(".recharts-line-curve, .recharts-bar-rectangle, .recharts-area-area, .recharts-rectangle, path.recharts-curve")).length;
      const svgsMaps = [...document.querySelectorAll("svg path")].length;
      return { text, hrefs, charts: wrappers.length, empty, svgPaths: svgsMaps, title: document.title, h1: document.querySelector("h1")?.innerText ?? "" };
    });
    r.title = info.title;
    r.h1 = info.h1;
    r.charts = info.charts;
    r.emptyCharts = info.empty;
    r.svgPaths = info.svgPaths;
    for (const line of info.text.split("\n")) if (BAD_TEXT.test(line)) r.badText.push(line.trim().slice(0, 160));
    for (const h of info.hrefs) if (h && h.startsWith("/") && !h.startsWith("//")) linkSet.add(h.split("#")[0]);
  } catch (e) {
    r.pageerrors.push("NAVIGATION: " + e.message.slice(0, 200));
  }
  await page.close();
  return r;
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

console.log(`Crawling ${pages.length} pages (${sample.size} cities) on ${BASE} ...`);
results.push(...(await pool(pages, 4, visit)));

// ---- 404 checks ----
const nf = [];
for (const u of notFound) {
  const res = await fetch(BASE + u, { redirect: "manual" });
  const body = await res.text();
  nf.push({ url: u, status: res.status, location: res.headers.get("location"), shows404: /Página não encontrada/.test(body) || res.status === 404 });
}

// ---- internal links ----
let links = [...linkSet].filter((h) => !h.startsWith("/_next"));
const cityLinks = links.filter((h) => /^\/[a-z]{2}\/[^/?]+/.test(h));
const other = links.filter((h) => !cityLinks.includes(h));
if (LINKS === "sample") {
  // all non-city links + 300 random city links
  const pick = cityLinks.sort(() => rnd() - 0.5).slice(0, 300);
  links = [...other, ...pick];
}
console.log(`Checking ${links.length} of ${linkSet.size} unique internal links ...`);
const linkRes = await pool(links, 8, async (h) => {
  try {
    const res = await fetch(BASE + h, { method: /\/dados\/csv\/|\.json$/.test(h) ? "HEAD" : "GET", redirect: "follow" });
    let ok = res.status === 200;
    let note = "";
    if (ok && !/\/dados\/csv\/|\.json$/.test(h)) {
      const body = await res.text();
      if (/<meta name="robots" content="noindex"/.test(body) && /Página não encontrada/.test(body)) { ok = false; note = "soft-404"; }
    }
    return { href: h, status: res.status, ok, note };
  } catch (e) {
    return { href: h, status: 0, ok: false, note: e.message };
  }
});

// ---- summary ----
const fails = [];
for (const r of results) {
  const prob = [];
  if (r.status !== 200) prob.push(`status ${r.status}`);
  if (r.pageerrors.length) prob.push(`pageerror x${r.pageerrors.length}: ${r.pageerrors[0]}`);
  if (r.console.length) prob.push(`console x${r.console.length}: ${r.console[0]}`);
  if (r.failed.length) prob.push(`failed req x${r.failed.length}: ${r.failed[0]}`);
  if (r.badText.length) prob.push(`bad text: ${r.badText[0]}`);
  if (r.emptyCharts) prob.push(`empty charts ${r.emptyCharts}/${r.charts}`);
  if (/Página não encontrada/.test(r.h1)) prob.push("rendered 404 page");
  if (prob.length) fails.push({ url: r.url, prob });
}
for (const n of nf) if (n.status !== 404) fails.push({ url: n.url, prob: [`expected HTTP 404, got ${n.status}${n.location ? " -> " + n.location : ""} (404 UI shown: ${n.shows404})`] });
for (const l of linkRes) if (!l.ok) fails.push({ url: l.href, prob: [`broken link: ${l.status} ${l.note}`] });

fs.writeFileSync(path.join(HERE, "crawl-results.json"), JSON.stringify({ results, nf, linkRes, fails }, null, 2));
console.log(`\nPages: ${results.length}  404-probes: ${nf.length}  links checked: ${linkRes.length}  time: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
const byProb = new Map();
for (const f of fails) for (const p of f.prob) {
  const k = p.replace(/\d+/g, "#").slice(0, 90);
  if (!byProb.has(k)) byProb.set(k, []);
  byProb.get(k).push(f.url);
}
for (const [k, urls] of byProb) console.log(`FAIL  ${k}\n      ${urls.length} url(s): ${urls.slice(0, 6).join(" ")}${urls.length > 6 ? " ..." : ""}`);
console.log(fails.length ? `\nRESULT: FAIL (${fails.length} problem urls)` : "\nRESULT: PASS");
await browser.close();
process.exit(fails.length ? 1 : 0);
