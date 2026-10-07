// W4 wave-2 regression: A11Y-17 first Tab, Explorer existence/ano/links/recurrence, watchlist CLS + atypical, palette latency.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = process.env.OUT ?? ".";
const browser = await chromium.launch();
const log = (...a) => console.log(...a);

// A11Y-17: first Tab lands on the skip link (desktop and mobile widths)
for (const w of [1280, 375]) {
  for (const path of ["/", "/explorar", "/acompanhar", "/dados", "/sobre", "/sp", "/sp/santo-andre"]) {
    const p = await browser.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    await p.keyboard.press("Tab");
    const t = await p.evaluate(() => document.activeElement?.getAttribute("href") ?? document.activeElement?.tagName);
    log(`firstTab ${w} ${path} -> ${t} ${t === "#conteudo" ? "OK" : "FAIL"}`);
    await p.close();
  }
}

// Explorer
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const count = async () => (await p.textContent("[aria-live=polite] > span")).replace(/\s+/g, " ").trim();
await p.goto(`${BASE}/explorar?ano=2008`, { waitUntil: "networkidle" });
await p.waitForSelector("tbody tr[aria-rowindex]");
log("2008 count:", await count());
log("2008 first link:", await p.$eval("tbody tr[aria-rowindex] a", (a) => a.getAttribute("href")));
await p.goto(`${BASE}/explorar?ano=1999&uf=SP`, { waitUntil: "networkidle" });
await p.waitForSelector("tbody tr[aria-rowindex]");
await p.waitForTimeout(500);
log("invalid ano url:", p.url().replace(BASE, ""), "first link:", await p.$eval("tbody tr[aria-rowindex] a", (a) => a.getAttribute("href")));
for (const rc of ["1", "2", "3", "5", "2x", "u5", "s2", "s3"]) {
  await p.goto(`${BASE}/explorar?ano=2021&uf=SP&situacao=abaixo&reinc=${rc}`, { waitUntil: "networkidle" });
  await p.waitForSelector("tbody tr[aria-rowindex], td[colspan]");
  await p.waitForTimeout(300);
  log(`reinc=${rc}:`, await count(), "url:", new URL(p.url()).searchParams.get("reinc"));
}
await p.goto(`${BASE}/explorar?ano=2021&situacao=mde-e-fundeb`, { waitUntil: "networkidle" });
await p.waitForSelector("tbody tr[aria-rowindex]");
await p.waitForTimeout(300);
log("mde-e-fundeb 2021:", await count());
await p.screenshot({ path: `${OUT}/w4w2-explorer.png` });
const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
await m.goto(`${BASE}/explorar?ano=2021`, { waitUntil: "networkidle" });
await m.waitForSelector("tbody tr[aria-rowindex]");
await m.$eval(".scroll-thin.overflow-auto", (el) => el.scrollIntoView());
await m.waitForTimeout(300);
await m.screenshot({ path: `${OUT}/w4w2-explorer-375.png` });

// Watchlist: CLS and atypical marks
for (const [w, h, scheme] of [[1280, 900, "light"], [768, 1000, "dark"], [375, 812, "light"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  await ctx.addInitScript(() => {
    localStorage.setItem("radar-mde:watch", JSON.stringify(["sp/santo-andre", "ba/conceicao-do-almeida", "rn/porto-do-mangue", "xx/nope"]));
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  const wp = await ctx.newPage();
  const reqs = [];
  wp.on("request", (r) => r.url().includes("/acompanhar/dados") && reqs.push(r.url()));
  await wp.goto(`${BASE}/acompanhar`, { waitUntil: "networkidle" });
  await wp.waitForTimeout(800);
  log(`watch ${w} ${scheme}: CLS=${(await wp.evaluate(() => window.__cls)).toFixed(3)} requests=${reqs.length} h1=${await wp.textContent("h1")} atypical cells=${await wp.$$eval("[aria-label*='fora do padrão']", (e) => e.length)}`);
  await wp.screenshot({ path: `${OUT}/w4w2-watch-${w}-${scheme}.png`, fullPage: w !== 1280 });
  await ctx.close();
}

// Palette: cold first open latency (after idle preload) and typing
const pp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await pp.goto(`${BASE}/sobre`, { waitUntil: "networkidle" });
await pp.waitForTimeout(1500);
const t0 = Date.now();
await pp.keyboard.press("Control+k");
await pp.waitForSelector("[cmdk-input]", { state: "attached" });
log("palette open ms (idle-preloaded):", Date.now() - t0);
await pp.fill("[cmdk-input]", "sao");
await pp.waitForSelector("[cmdk-item]");
log("first results ms:", Date.now() - t0);
await pp.click("text=Ver todos os");
await pp.waitForTimeout(300);
log("expanded items:", await pp.$$eval("[cmdk-item]", (e) => e.length), "status:", await pp.textContent("[role=status]"));
await pp.screenshot({ path: `${OUT}/w4w2-palette.png` });
await browser.close();
