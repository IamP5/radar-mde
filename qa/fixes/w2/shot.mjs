// usage: node fixes/w2/shot.mjs <path> [width=1440] [theme=light] [full=1] [name] [clip-selector]
import { chromium } from "playwright";
const [path = "/sp/santo-andre", w = "1440", theme = "light", full = "1", name, sel] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3210";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: 900 }, colorScheme: theme, deviceScaleFactor: 1, hasTouch: +w < 768 });
await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errs.push(`${m.type()}: ${m.text().slice(0, 1500)}`));
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
const res = await page.goto(base + path, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const file = `fixes/w2/shots/${name ?? (path.replace(/[^a-z0-9]+/gi, "_") || "home")}-${w}-${theme}.png`;
if (sel) await page.locator(sel).last().screenshot({ path: file });
else await page.screenshot({ path: file, fullPage: full === "1" });
console.log("status", res.status(), "file", file, "overflow:", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
if (errs.length) console.log(errs.join("\n"));
await browser.close();
