// Re-runnable perf measurement for Radar MDE.
// Usage (from /Users/tuba/Dev/projects/radar-mde/qa):
//   BASE=http://localhost:3299 node reports/performance/measure.mjs [routes|interact|robust|all]
// Emulates a mid-range phone: 412x823 @2.6x, 4x CPU slowdown, DevTools "Slow 4G"
// (562.5 ms RTT, ~1.4 Mbps down, ~0.67 Mbps up). Fresh browser context per route (cold cache).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3299";
const OUT = path.dirname(new URL(import.meta.url).pathname);
const MODE = process.argv[2] ?? "all";
const THROTTLE = process.env.NO_THROTTLE ? null : {
  offline: false, latency: 562.5, downloadThroughput: (1.4744 * 1024 * 1024) / 8, uploadThroughput: (0.675 * 1024 * 1024) / 8,
};
const CPU = process.env.NO_THROTTLE ? 1 : 4;

const ROUTES = [
  "/", "/regiao/sudeste", "/sp", "/mg", "/rr", "/sp/sao-paulo", "/sp/santo-andre", "/rr/boa-vista",
  "/explorar", "/acompanhar", "/dados", "/sobre",
];

const INIT = () => {
  window.__perf = { lcp: 0, lcpEl: "", cls: 0, longtasks: [], events: [] };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) { window.__perf.lcp = e.startTime; window.__perf.lcpEl = (e.element?.tagName ?? "") + "." + (e.element?.className?.baseVal ?? e.element?.className ?? "").toString().slice(0, 60); }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__perf.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]);
  }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__perf.events.push([e.name, Math.round(e.duration)]);
  }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  addEventListener("pageshow", (e) => { window.__perf.persisted = e.persisted; });
};

async function newCtx(browser, { throttle = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 823 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  });
  await ctx.addInitScript(INIT);
  // Round 2: 3 saved cities for /acompanhar (key "radar-mde:watch", entries "uf/slug")
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("radar-mde:watch")) localStorage.setItem("radar-mde:watch", JSON.stringify(["sp/santo-andre", "mg/belo-horizonte", "ba/salvador"])); } catch {} });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  if (throttle && THROTTLE) {
    await cdp.send("Network.emulateNetworkConditions", THROTTLE);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  }
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => {
    const r = reqs.get(e.requestId) ?? {};
    Object.assign(r, { url: e.response.url, type: e.type, status: e.response.status, enc: e.response.headers["content-encoding"] ?? e.response.headers["Content-Encoding"] });
    reqs.set(e.requestId, r);
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId) ?? {};
    r.bytes = e.encodedDataLength;
    reqs.set(e.requestId, r);
  });
  cdp.on("Network.loadingFailed", (e) => {
    const r = reqs.get(e.requestId) ?? {};
    r.failed = e.errorText;
    reqs.set(e.requestId, r);
  });
  return { ctx, page, cdp, reqs };
}

const heapMB = async (cdp) => {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, scriptMs: Math.round(m.ScriptDuration * 1000), layoutMs: Math.round(m.LayoutDuration * 1000) };
};

const tbt = (lts, upTo = Infinity) => lts.filter(([s]) => s <= upTo).reduce((s, [, d]) => s + Math.max(0, d - 50), 0);

async function measureRoute(browser, route) {
  const { ctx, page, cdp, reqs } = await newCtx(browser);
  const t0 = Date.now();
  const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 180000 });
  const loadMs = Date.now() - t0;
  await page.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const p = await page.evaluate(() => ({ ...window.__perf, nav: performance.getEntriesByType("navigation")[0]?.toJSON(), fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime }));
  const h = await heapMB(cdp);
  const byType = {};
  let total = 0;
  for (const r of reqs.values()) {
    if (!r.url || r.url.startsWith("data:")) continue;
    const k = r.type ?? "Other";
    byType[k] ??= { n: 0, kb: 0 };
    byType[k].n++;
    byType[k].kb += (r.bytes ?? 0) / 1024;
    total += r.bytes ?? 0;
  }
  for (const k in byType) byType[k].kb = Math.round(byType[k].kb);
  const big = [...reqs.values()].filter((r) => r.bytes > 50_000).map((r) => `${r.url.replace(BASE, "")} ${Math.round(r.bytes / 1024)}KB${r.enc ? " " + r.enc : " (no enc)"}`);
  const res = {
    route, status: resp.status(), loadMs,
    ttfb: Math.round(p.nav.responseStart), fcp: Math.round(p.fcp ?? 0), lcp: Math.round(p.lcp), lcpEl: p.lcpEl, cls: +p.cls.toFixed(3),
    tbt: tbt(p.longtasks), longest: Math.max(0, ...p.longtasks.map(([, d]) => d)), nLong: p.longtasks.length,
    requests: [...reqs.values()].filter((r) => r.url && !r.url.startsWith("data:")).length, transferKB: Math.round(total / 1024), byType,
    htmlKB: Math.round((p.nav.encodedBodySize ?? 0) / 1024), htmlRawKB: Math.round((p.nav.decodedBodySize ?? 0) / 1024),
    ...h, big,
  };
  await page.screenshot({ path: path.join(OUT, `shot${route.replace(/\//g, "_") || "_root"}.png`) });
  await ctx.close();
  return res;
}

async function interact(browser) {
  const out = {};
  // --- Home: switch map to municipalities, cycle metrics, rapid year switching
  {
    const { ctx, page, cdp } = await newCtx(browser);
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(1000);
    const before = await heapMB(cdp);
    const mark = async () => page.evaluate(() => { const n = window.__perf.longtasks.length; const e = window.__perf.events.length; return { n, e, t: performance.now() }; });
    const since = async (m) => page.evaluate((m) => { const lt = window.__perf.longtasks.slice(m.n); const ev = window.__perf.events.slice(m.e); return { tbt: lt.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), longest: Math.max(0, ...lt.map(([, d]) => d)), n: lt.length, maxEvent: Math.max(0, ...ev.map(([, d]) => d)), wall: Math.round(performance.now() - m.t) }; }, m);

    let m = await mark();
    const t = Date.now();
    await page.getByRole("radio", { name: "Municípios" }).first().click();
    await page.waitForSelector("svg path[data-id]:nth-of-type(5000)", { timeout: 180000 }).catch(() => {});
    out.homeToMun = { ...(await since(m)), untilPaintedMs: Date.now() - t, paths: await page.locator("svg path[data-id]").count() };

    m = await mark();
    const yrs = page.locator("[role=radiogroup] [role=radio]").filter({ hasText: /^20\d\d$/ });
    const ny = await yrs.count();
    for (let i = 0; i < Math.min(ny, 18); i++) await yrs.nth(i).click({ timeout: 30000 });
    await page.waitForTimeout(1500);
    out.homeRapidYears18 = { ...(await since(m)), years: ny };

    m = await mark();
    const prev = page.getByRole("button", { name: "Ano anterior" }).first();
    await prev.click(); await page.waitForTimeout(1500);
    out.homeOneYearStep = await since(m);

    m = await mark();
    await page.getByRole("radio", { name: "Estados" }).first().click();
    await page.waitForTimeout(1500);
    out.homeBackToUf = await since(m);
    const after = await heapMB(cdp);
    out.homeHeap = { before, after };
    await ctx.close();
  }
  // --- Explorer: load, rows in DOM, "Mostrar mais" x5, search typing
  {
    const { ctx, page, cdp } = await newCtx(browser);
    const t = Date.now();
    await page.goto(BASE + "/explorar", { waitUntil: "load", timeout: 180000 });
    await page.waitForSelector("table tbody tr:nth-child(50)", { timeout: 180000 }).catch(() => {});
    const ready = Date.now() - t;
    const rows0 = await page.locator("table tbody tr").count();
    const m = await page.evaluate(() => ({ n: window.__perf.longtasks.length, e: window.__perf.events.length }));
    for (let i = 0; i < 5; i++) {
      const b = page.getByRole("button", { name: /Mostrar mais/ });
      if (!(await b.count())) break;
      await b.first().click();
      await page.waitForTimeout(400);
    }
    // Round 2: virtualized table — scroll the inner scroller to the end in 40 steps, count frames/long tasks
    const scroll = await page.evaluate(async () => {
      const el = [...document.querySelectorAll("div")].find((d) => d.querySelector("table[aria-rowcount]") && d.scrollHeight > d.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(d).overflowY));
      if (!el) return { found: false };
      const n0 = window.__perf.longtasks.length;
      const frames = []; let last = performance.now(); let run = true;
      const tick = (t) => { frames.push(t - last); last = t; if (run) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const t0 = performance.now();
      for (let i = 1; i <= 40; i++) { el.scrollTop = (el.scrollHeight * i) / 40; await new Promise((r) => setTimeout(r, 50)); }
      await new Promise((r) => setTimeout(r, 500));
      run = false;
      const lt = window.__perf.longtasks.slice(n0);
      return { found: true, scrollHeight: el.scrollHeight, ms: Math.round(performance.now() - t0), frames: frames.length, jankFrames: frames.filter((f) => f > 50).length, worstFrame: Math.round(Math.max(...frames)), tbt: lt.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), longest: Math.max(0, ...lt.map(([, d]) => d)), rowsInDom: document.querySelectorAll("table[aria-rowcount] tbody tr").length, nodes: document.getElementsByTagName("*").length };
    });
    out.explorerScroll = scroll;
    const rows1 = await page.locator("table tbody tr").count();
    const lt = await page.evaluate((m) => { const lt = window.__perf.longtasks.slice(m.n); const ev = window.__perf.events.slice(m.e); return { tbt: lt.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), longest: Math.max(0, ...lt.map(([, d]) => d)), maxEvent: Math.max(0, ...ev.map(([, d]) => d)) }; }, m);
    const search = page.getByRole("textbox", { name: /Buscar município/ }).first();
    const m2 = await page.evaluate(() => ({ n: window.__perf.longtasks.length, e: window.__perf.events.length }));
    await search.pressSequentially("sao", { delay: 60 }).catch(() => {});
    await page.waitForTimeout(1000);
    const lt2 = await page.evaluate((m) => { const lt = window.__perf.longtasks.slice(m.n); const ev = window.__perf.events.slice(m.e); return { tbt: lt.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), longest: Math.max(0, ...lt.map(([, d]) => d)), maxEvent: Math.max(0, ...ev.map(([, d]) => d)) }; }, m2);
    out.explorer = { readyMs: ready, rowsInitial: rows0, rowsAfter5More: rows1, showMore: lt, typing: lt2, heap: await heapMB(cdp) };
    await ctx.close();
  }
  // --- UF page MG: heavy inline rows
  {
    const { ctx, page, cdp } = await newCtx(browser);
    await page.goto(BASE + "/mg", { waitUntil: "networkidle", timeout: 180000 });
    const m = await page.evaluate(() => ({ n: window.__perf.longtasks.length }));
    const yrs = page.locator("[role=radiogroup] [role=radio]").filter({ hasText: /^20\d\d$/ });
    const ny = await yrs.count();
    for (let i = 0; i < Math.min(ny, 10); i++) await yrs.nth(i).click({ timeout: 30000 });
    await page.waitForTimeout(1500);
    out.mgRapidYears10 = { ...(await page.evaluate((m) => { const lt = window.__perf.longtasks.slice(m.n); return { tbt: lt.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), longest: Math.max(0, ...lt.map(([, d]) => d)), n: lt.length }; }, m)), heap: await heapMB(cdp) };
    await ctx.close();
  }
  return out;
}

async function robust(browser) {
  const out = {};
  // failed data fetches: abort /data/* and /geo/*
  for (const [route, pattern] of [["/", "**/data/*.json"], ["/", "**/geo/**"], ["/explorar", "**/data/*.json"], ["/acompanhar", "**/acompanhar/dados*"], ["/sp/santo-andre", "**/geo/**"], ["/sp/santo-andre", "**/data/*.json"]]) {
    const { ctx, page } = await newCtx(browser, { throttle: false });
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.route(pattern, (r) => r.abort("internetdisconnected"));
    if (route === "/acompanhar") await page.addInitScript(() => { try { localStorage.setItem("radar-mde:watch", JSON.stringify(["sp/santo-andre","mg/belo-horizonte"])); } catch {} });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    if (route === "/") await page.getByRole("radio", { name: "Municípios" }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const txt = await page.locator("main").innerText();
    const flags = ["Não foi possível", "Tentar novamente", "erro", "Carregando", "Falha"].filter((f) => txt.toLowerCase().includes(f.toLowerCase()));
    const name = `fail${route.replace(/\//g, "_")}_${pattern.includes("geo") ? "geo" : "data"}.png`;
    await page.screenshot({ path: path.join(OUT, name), fullPage: false });
    out[`${route} abort ${pattern}`] = { flags, pageErrors: errs.slice(0, 3), shot: name };
    await ctx.close();
  }
  // rapid navigation + back/forward cache
  {
    const { ctx, page, cdp } = await newCtx(browser, { throttle: false });
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    const bf = [];
    await cdp.send("Page.enable");
    cdp.on("Page.backForwardCacheNotUsed", (e) => bf.push(e.notRestoredExplanations.map((x) => x.reason)));
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const t = Date.now();
    for (const href of ["/sp", "/sp/santo-andre", "/explorar", "/regiao/norte", "/rr", "/", "/sobre", "/dados"]) {
      await page.evaluate((h) => { const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === h); if (a) a.click(); else window.location.assign(h); }, href);
      await page.waitForTimeout(150);
    }
    await page.waitForLoadState("networkidle");
    out.rapidNav = { finalUrl: page.url().replace(BASE, ""), ms: Date.now() - t, pageErrors: errs.slice(0, 3) };
    // hard navigation then back: bfcache?
    await page.goto(BASE + "/sp/santo-andre", { waitUntil: "networkidle" });
    await page.goto(BASE + "/sobre", { waitUntil: "networkidle" });
    await page.goBack({ waitUntil: "load" });
    await page.waitForTimeout(500);
    out.bfcache = { restored: await page.evaluate(() => window.__perf.persisted === true || performance.getEntriesByType("navigation")[0]?.type), notUsedReasons: bf.flat() };
    await ctx.close();
  }
  // offline after load (client nav while offline)
  {
    const { ctx, page } = await newCtx(browser, { throttle: false });
    await page.goto(BASE + "/sp/santo-andre", { waitUntil: "networkidle" });
    await ctx.setOffline(true);
    await page.evaluate(() => { const a = [...document.querySelectorAll("a")].find((x) => /^\/sp\/[a-z-]+$/.test(x.getAttribute("href") ?? "") && !x.getAttribute("href").includes("santo-andre")); a?.click(); });
    await page.waitForTimeout(4000);
    out.offlineClientNav = { url: page.url().replace(BASE, ""), text: (await page.locator("body").innerText()).slice(0, 160).replace(/\s+/g, " ") };
    await page.screenshot({ path: path.join(OUT, "offline_nav.png") });
    await ctx.close();
  }
  return out;
}

async function seo(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const out = {};
  for (const r of ["/", "/sp", "/sp/santo-andre", "/regiao/sudeste", "/explorar", "/sobre"]) {
    await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
    out[r] = await page.evaluate(() => {
      const m = (s) => document.querySelector(s)?.getAttribute("content") ?? null;
      return {
        title: document.title, description: m('meta[name="description"]'),
        ogTitle: m('meta[property="og:title"]'), ogImage: m('meta[property="og:image"]'), ogUrl: m('meta[property="og:url"]'),
        twitterCard: m('meta[name="twitter:card"]'), canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
        icon: document.querySelector('link[rel~="icon"]')?.href ?? null, manifest: document.querySelector('link[rel="manifest"]')?.href ?? null,
        themeColor: m('meta[name="theme-color"]'), h1: document.querySelectorAll("h1").length, lang: document.documentElement.lang,
      };
    });
  }
  await ctx.close();
  return out;
}

const browser = await chromium.launch();
const result = { base: BASE, at: new Date().toISOString(), throttle: !!THROTTLE, cpu: CPU };
if (MODE === "routes" || MODE === "all") {
  result.routes = [];
  for (const r of ROUTES) {
    try { const x = await measureRoute(browser, r); result.routes.push(x); console.log(JSON.stringify(x)); }
    catch (e) { console.log(r, "ERR", e.message); result.routes.push({ route: r, error: e.message }); }
  }
}
if (MODE === "interact" || MODE === "all") { result.interact = await interact(browser); console.log(JSON.stringify(result.interact, null, 1)); }
if (MODE === "robust" || MODE === "all") { result.robust = await robust(browser); console.log(JSON.stringify(result.robust, null, 1)); }
if (MODE === "seo" || MODE === "all") { result.seo = await seo(browser); console.log(JSON.stringify(result.seo, null, 1)); }
fs.writeFileSync(path.join(OUT, `results-${MODE}.json`), JSON.stringify(result, null, 2));
await browser.close();
