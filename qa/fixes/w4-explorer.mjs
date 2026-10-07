// W4 regression: Explorer URL state round-trip, virtualization, CSV export, error state, mobile legend.
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = process.env.OUT ?? ".";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const count = async () => (await page.textContent("[aria-live=polite]")).replace(/\s+/g, " ").trim();
await page.goto(`${BASE}/explorar?ano=2021&uf=SP`, { waitUntil: "networkidle" });
await page.waitForSelector("tbody tr[aria-rowindex]");
// Situação = Abaixo de 25%
await page.getByRole("combobox", { name: /Situação em 2021/ }).click();
await page.getByRole("option", { name: /Abaixo de 25%/ }).click();
await page.getByRole("button", { name: /Reincidentes/ }).click();
await page.getByRole("button", { name: /Faltou/ }).click(); // sort by Faltou desc
await page.fill("input[aria-label='Buscar município pelo nome']", "santa barbara d’oeste");
await page.waitForTimeout(500);
console.log("view A:", await count(), "url:", page.url().replace(BASE, ""));
await page.fill("input[aria-label='Buscar município pelo nome']", "");
await page.waitForTimeout(500);
const before = await count();
const url = page.url();
const firstRows = await page.$$eval("tbody tr[aria-rowindex] td:first-child a", (a) => a.slice(0, 3).map((x) => x.textContent));
console.log("view B:", before, "url:", url.replace(BASE, ""), firstRows);
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("tbody tr[aria-rowindex]");
await page.waitForTimeout(300);
const after = await count();
const firstRows2 = await page.$$eval("tbody tr[aria-rowindex] td:first-child a", (a) => a.slice(0, 3).map((x) => x.textContent));
console.log("after reload:", after, firstRows2, "match:", before === after && JSON.stringify(firstRows) === JSON.stringify(firstRows2));
// CSV (Excel Brasil, ano)
await page.getByRole("button", { name: /Exportar CSV/ }).click();
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Só 2021 · Excel Brasil/ }).click()]);
const p = `${OUT}/${dl.suggestedFilename()}`;
await dl.saveAs(p);
const csv = fs.readFileSync(p, "utf8");
console.log("csv file:", dl.suggestedFilename(), "lines:", csv.trim().split("\n").length, "BOM:", csv.charCodeAt(0) === 0xfeff);
console.log(csv.split("\r\n").slice(0, 3).join("\n"));
await page.getByRole("button", { name: /Exportar CSV/ }).click();
const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Série .* CSV padrão/ }).click()]);
await dl2.saveAs(`${OUT}/${dl2.suggestedFilename()}`);
const csv2 = fs.readFileSync(`${OUT}/${dl2.suggestedFilename()}`, "utf8");
console.log("series file:", dl2.suggestedFilename(), "lines:", csv2.trim().split("\n").length);
// virtualization: whole country, scroll to bottom
await page.goto(`${BASE}/explorar`, { waitUntil: "networkidle" });
await page.waitForSelector("tbody tr[aria-rowindex]");
const nodes0 = await page.evaluate(() => document.querySelectorAll("*").length);
const t0 = Date.now();
await page.$eval(".scroll-thin.overflow-auto", (el) => (el.scrollTop = el.scrollHeight));
await page.waitForTimeout(400);
const lastRow = await page.$$eval("tbody tr[aria-rowindex]", (r) => r.at(-1).getAttribute("aria-rowindex") + " " + r.at(-1).querySelector("a").textContent);
const nodes1 = await page.evaluate(() => document.querySelectorAll("*").length);
console.log("DOM nodes top/bottom:", nodes0, nodes1, "last row:", lastRow, "scroll ms", Date.now() - t0);
await page.$eval(".scroll-thin.overflow-auto", (el) => (el.scrollTop = el.scrollHeight / 2));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/w4-explorer-mid.png` });
// 2021 + capital
await page.goto(`${BASE}/explorar?ano=2021&capital=1&ordem=-variacao`, { waitUntil: "networkidle" });
await page.waitForSelector("tbody tr[aria-rowindex]");
await page.waitForTimeout(300);
console.log("capitais:", await count());
await page.screenshot({ path: `${OUT}/w4-explorer-capitais.png` });
// error state
const ectx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const ep = await ectx.newPage();
await ep.route(/\/data\/municipios\.json/, (r) => r.abort());
await ep.goto(`${BASE}/explorar`, { waitUntil: "networkidle" });
await ep.waitForTimeout(800);
await ep.screenshot({ path: `${OUT}/w4-explorer-error.png` });
console.log("error alert:", await ep.textContent("[role=alert]").catch(() => "none"));
// mobile
const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
await m.goto(`${BASE}/explorar`, { waitUntil: "networkidle" });
await m.waitForSelector("tbody tr[aria-rowindex]");
const overflow = await m.evaluate(() => document.documentElement.scrollWidth);
console.log("mobile scrollWidth:", overflow);
await m.screenshot({ path: `${OUT}/w4-explorer-mobile.png`, fullPage: true });
await browser.close();
