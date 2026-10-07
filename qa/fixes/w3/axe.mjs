import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) for (const path of ["/", "/regiao/sudeste", "/sp", "/pa?ano=2016", "/ac"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3210" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  console.log(theme, path, r.violations.length ? r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)).join(" | ")}`).join("\n   ") : "0 violations");
  await ctx.close();
}
await browser.close();
