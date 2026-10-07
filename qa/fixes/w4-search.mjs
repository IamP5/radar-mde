// W4 regression: ⌘K palette ordering, typos, lazy load, mobile close button.
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = process.env.OUT ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const scripts = [];
page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto(`${BASE}/sobre`, { waitUntil: "networkidle" });
const cmdkBefore = scripts.length;
await page.keyboard.press("Meta+k");
await page.waitForSelector("[cmdk-input]");
console.log("palette opened via ⌘K; scripts before/after open:", cmdkBefore, scripts.length);
const qs = ["bahia", "acre", "para", "norte", "sul", "brasil", "sao joao", "embu guacu", "santa barbara d'oeste", "bom jesus go", "conceicao do almeda", "sto antonio", "sao paulo sp", "capitais", "xyzzy"];
for (const q of qs) {
  await page.fill("[cmdk-input]", q);
  await page.waitForTimeout(250);
  const items = await page.$$eval("[cmdk-item]", (els) => els.map((e) => e.textContent.trim().replace(/\s+/g, " ")).slice(0, 4));
  const sel = await page.$eval("[cmdk-item][data-selected=true]", (e) => e.textContent.trim().replace(/\s+/g, " ")).catch(() => "-");
  const st = await page.$eval("[role=status]", (e) => e.textContent).catch(() => "");
  console.log(`${q.padEnd(22)} sel=[${sel}] status=${st} :: ${items.join(" | ")}`);
}
await page.fill("[cmdk-input]", "sao joao");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/w4-search-saojoao.png` });
await page.click("text=Ver todos os");
await page.waitForTimeout(200);
console.log("after expand items:", await page.$$eval("[cmdk-item]", (e) => e.length));
await page.fill("[cmdk-input]", "bahia");
await page.waitForTimeout(200);
await page.keyboard.press("Enter");
await page.waitForURL(/\/ba$/);
console.log("Enter on bahia ->", page.url());
// mobile
const m = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
await m.goto(`${BASE}/sobre`, { waitUntil: "networkidle" });
await m.tap("header button[aria-haspopup=dialog]");
await m.waitForSelector("[cmdk-input]");
await m.fill("[cmdk-input]", "sao jo");
await m.waitForTimeout(300);
await m.screenshot({ path: `${OUT}/w4-search-mobile.png` });
await m.tap("text=Fechar");
await m.waitForTimeout(300);
console.log("mobile closed:", (await m.$("[cmdk-input]")) === null);
await browser.close();
