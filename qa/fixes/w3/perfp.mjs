import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto("http://localhost:3297/", { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Municípios" }).click();
await page.waitForFunction(() => document.querySelectorAll("svg path[data-id]").length > 5000, null, { timeout: 30000 });
await page.waitForTimeout(1000);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluate(() => {
  window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask", buffered: false });
});
for (let i = 0; i < 10; i++) {
  await page.getByRole("button", { name: "Ano anterior" }).click();
  await page.waitForTimeout(400);
}
const lt = await page.evaluate(() => window.__lt);
console.log("year steps @4x: longtasks", lt.length, "max", Math.round(Math.max(0, ...lt)), "TBT", Math.round(lt.reduce((a, d) => a + Math.max(0, d - 50), 0)));
await browser.close();
