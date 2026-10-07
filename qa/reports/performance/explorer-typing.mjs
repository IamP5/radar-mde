// Explorer: INP proxy while typing in the name filter and sorting (4x CPU).
// BASE=http://localhost:3299 node reports/performance/explorer-typing.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3299";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await p.addInitScript(() => {
  window.__ev = []; window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push([e.name, Math.round(e.duration)]))).observe({ type: "event", durationThreshold: 16 });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: "longtask" });
});
await p.goto(BASE + "/explorar", { waitUntil: "networkidle" });
await p.waitForSelector("table tbody tr:nth-child(50)");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const reset = () => p.evaluate(() => { window.__ev = []; window.__lt = []; });
const read = () => p.evaluate(() => ({ maxEvent: Math.max(0, ...window.__ev.map((e) => e[1])), events: window.__ev.length, longtasks: window.__lt }));
const box = p.locator('input[aria-label="Buscar município pelo nome"]').first();
await reset();
await box.pressSequentially("santo", { delay: 80, timeout: 30000 });
await p.waitForTimeout(1500);
console.log("typing", JSON.stringify(await read()), "rows", await p.locator("table tbody tr").count());
await box.fill("");
await p.waitForTimeout(1000);
await reset();
await p.locator("table thead button").nth(1).click({ timeout: 30000 });
await p.waitForTimeout(1500);
console.log("sort", JSON.stringify(await read()));
await b.close();
