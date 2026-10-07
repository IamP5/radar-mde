// W4 regression: watchlist (only saved cities fetched, mobile cards), mobile nav, metadata routes, skip link.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = process.env.OUT ?? ".";
const browser = await chromium.launch();
for (const [w, h] of [[375, 812], [1280, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => localStorage.setItem("radar-mde:watch", JSON.stringify(["sp/santo-andre", "mt/boa-esperanca-do-norte", "ba/conceicao-do-almeida", "rn/porto-do-mangue"])));
  const p = await ctx.newPage();
  const reqs = [];
  p.on("request", (r) => /\/data\/|\/acompanhar\/dados/.test(r.url()) && reqs.push(r.url().replace(BASE, "")));
  p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await p.goto(`${BASE}/acompanhar`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  console.log(w, "data requests:", reqs, "scrollWidth:", await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: `${OUT}/w4-acompanhar-${w}.png`, fullPage: true });
  // remove one: no new request
  const n = reqs.length;
  await p.getByRole("button", { name: /Deixar de acompanhar Santo André/ }).first().click();
  await p.waitForTimeout(400);
  console.log(w, "after removal requests:", reqs.length - n, "title:", await p.textContent("section h2"));
  await ctx.close();
}
for (const w of [320, 360, 375, 414]) {
  const p = await browser.newPage({ viewport: { width: w, height: 700 } });
  await p.goto(`${BASE}/sobre`, { waitUntil: "networkidle" });
  const nav = await p.$eval("header .md\\:hidden nav", (n) => ({ sw: n.scrollWidth, cw: n.clientWidth, mask: getComputedStyle(n).maskImage.slice(0, 40), labels: [...n.querySelectorAll("a")].map((a) => a.innerText) }));
  console.log("nav", w, JSON.stringify(nav));
  if (w === 360) await p.screenshot({ path: `${OUT}/w4-nav-360.png`, clip: { x: 0, y: 0, width: 360, height: 110 } });
  await p.close();
}
// skip link focuses main
const p = await browser.newPage();
await p.goto(`${BASE}/sobre`, { waitUntil: "networkidle" });
await p.keyboard.press("Tab");
await p.keyboard.press("Enter");
console.log("skip link ->", await p.evaluate(() => document.activeElement?.id));
await browser.close();
