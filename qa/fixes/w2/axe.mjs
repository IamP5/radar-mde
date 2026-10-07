import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
const b = await chromium.launch();
for (const theme of ["light","dark"]) for (const path of process.argv.slice(2)) {
  const ctx = await b.newContext({ colorScheme: theme }); await ctx.addInitScript((t)=>{try{localStorage.setItem("theme",t)}catch{}}, theme);
  const p = await ctx.newPage(); await p.goto("http://localhost:3210" + path, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  const r = await new AxeBuilder({ page: p }).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
  console.log(theme, path, r.violations.map(v => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0,2).map(n=>n.target.join(" ")).join(" ; ")}`));
  if (path.includes("santo")) console.log("peer hrefs:", await p.locator('section ol a').evaluateAll(a => a.slice(0,2).map(x=>x.getAttribute("href"))));
  await ctx.close();
}
await b.close();
