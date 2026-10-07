import { chromium } from "playwright";
const hover = process.argv[2] === "hover";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto("http://localhost:3297/", { waitUntil: "networkidle" });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask" }); });
const btn = page.getByRole("radio", { name: "Municípios" });
if (hover) { await btn.hover(); await page.waitForTimeout(3000); await page.evaluate(() => (window.__lt = [])); }
const t0 = Date.now();
await btn.click();
await page.waitForFunction(() => document.querySelectorAll("svg path[data-id]").length > 5000, null, { timeout: 30000 });
const t1 = Date.now();
await page.waitForTimeout(800);
const lt = await page.evaluate(() => window.__lt);
console.log(hover ? "hover+click" : "cold click", "→ painted", t1 - t0, "ms; longest task", Math.round(Math.max(0, ...lt)), "tasks", lt.map(Math.round).join(","));
await browser.close();
