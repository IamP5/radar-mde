// usage: node fixes/w3/el.mjs <path> <selector> [width] [theme] [name] [nth]
import { chromium } from "playwright";
const [path, sel, w = "1440", theme = "light", name = "el", nth = "0"] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: 900 }, colorScheme: theme });
await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 400)));
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await page.goto("http://localhost:3210" + path, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const el = page.locator(sel).nth(+nth);
await el.scrollIntoViewIfNeeded();
await el.screenshot({ path: `fixes/w3/shots/${name}-${w}-${theme}.png` });
console.log(await el.evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth })));
if (errs.length) console.log(errs.join("\n"));
await browser.close();
