import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto("http://localhost:3297/", { waitUntil: "networkidle" });
if (process.argv[2] === "mun") { await page.getByRole("radio", { name: "Municípios" }).click(); await page.waitForFunction(() => document.querySelectorAll("svg path[data-id]").length > 5000); }
await page.waitForTimeout(1000);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluate(() => { window.__ev = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push(e.duration))).observe({ type: "event", durationThreshold: 16 }); });
for (let i = 0; i < 10; i++) { await page.getByRole("button", { name: "Ano anterior" }).click(); await page.waitForTimeout(600); }
const ev = await page.evaluate(() => window.__ev);
console.log(process.argv[2] ?? "uf", "max event", Math.max(...ev), "p75-ish", ev.sort((a, b) => a - b)[Math.floor(ev.length * 0.75)]);
await browser.close();
