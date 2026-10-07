import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3297/", { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Municípios" }).click(); await page.waitForFunction(() => document.querySelectorAll("svg path[data-id]").length > 5000);
await page.evaluate(() => {
  window.__c = {};
  const orig = SVGGeometryElement.prototype.getTotalLength;
  SVGGeometryElement.prototype.getTotalLength = function () {
    const st = new Error().stack.split("\n").slice(2, 5).join(" | ");
    const k = (this.getAttribute("class") || this.tagName) + " :: " + st.slice(0, 300);
    window.__c[k] = (window.__c[k] || 0) + 1;
    return orig.call(this);
  };
});
for (let i = 0; i < 3; i++) { await page.getByRole("button", { name: "Ano anterior" }).click(); await page.waitForTimeout(500); }
console.log(await page.evaluate(() => window.__c));
await browser.close();
