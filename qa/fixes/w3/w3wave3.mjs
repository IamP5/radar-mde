import { chromium } from "playwright";
import fs from "node:fs/promises";
const B = "http://localhost:3210";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => console.log(c ? "PASS" : "FAIL", m);
// GOV-27
await page.goto(B + "/sp?ano=2021", { waitUntil: "networkidle" });
await page.getByRole("combobox", { name: /Reincidência/ }).click();
const opts = await page.getByRole("option").allTextContents();
ok(opts[0] === "Qualquer histórico", "reinc first option: " + opts.join(" | "));
await page.keyboard.press("Escape");
// old URL value
await page.goto(B + "/sp?ano=2021&reinc=3", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
ok(page.url().includes("reinc=n3"), "legacy reinc=3 accepted → " + page.url());
// GOV-28 print
await page.goto(B + "/sp?ano=2021&situacao=below", { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
await page.waitForTimeout(300);
const n = await page.locator("#municipios-tabela tbody tr").count();
const summary = await page.locator("#municipios p.print\\:block").textContent();
ok(n === 118, `print rows ${n}; summary: ${summary}`);
const hdr = await page.locator("#municipios-tabela thead th").allInnerTexts();
ok(hdr.every((t) => t.trim()), "print header labels: " + hdr.join(" | "));
await page.pdf({ path: "fixes/w3/shots/print-sp-below.pdf", format: "A4" });
await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
await page.emulateMedia({ media: "screen" });
// JOR-26
await page.goto(B + "/", { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Corrigido (IPCA)" }).click();
await page.getByRole("tab", { name: /R\$ que faltou/ }).click();
await page.getByRole("radio", { name: "Municípios" }).click();
await page.getByRole("radio", { name: "Fundeb pessoal" }).click();
const url = page.url(); console.log("  ", url);
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
ok(await page.getByRole("radio", { name: "Corrigido (IPCA)" }).getAttribute("aria-checked") === "true", "IPCA restored");
ok(await page.getByRole("tab", { name: /R\$ que faltou/ }).getAttribute("aria-selected") === "true", "trend tab restored");
ok(await page.getByRole("radio", { name: "Fundeb pessoal" }).getAttribute("aria-checked") === "true", "map mode+metric restored");
// JOR-24 export map png with legend
const t = page.locator('button[aria-label^="Exportar: % do Fundeb"]').first();
ok(await t.count() === 1, "map export title metric-explicit: " + (await page.locator('button[aria-label^="Exportar:"]').first().getAttribute("aria-label")));
await t.click();
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /PNG/ }).click()]);
await fs.copyFile(await dl.path(), "fixes/w3/shots/w3-map-export.png");
console.log("   png", dl.suggestedFilename());
console.log(errs.length ? errs.join("\n") : "no page errors");
await browser.close();
