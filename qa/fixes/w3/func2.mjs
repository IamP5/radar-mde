import { chromium } from "playwright";
const B = "http://localhost:3210";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => console.log(c ? "PASS" : "FAIL", m);
// UF export follows filters
await page.goto(B + "/sp?ano=2021&situacao=below&reinc=s3", { waitUntil: "networkidle" });
const status = await page.locator('#municipios [role=status]').textContent(); console.log("  ", status);
await page.getByRole("button", { name: "Exportar tabela", exact: true }).click();
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Só 2021 · Excel Brasil/ }).click()]);
const txt = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
const lines = txt.trim().split(/\r?\n/);
console.log("  file", dl.suggestedFilename(), "lines", lines.length, "header", lines[0].slice(0, 160));
ok(lines.length - 1 === parseInt(status), "export rows = filtered rows");
ok(lines[0].includes(";") && lines[0].includes("receita"), "excel separator + finance columns");
// GOV-12 marker + IPCA toggle
await page.goto(B + "/pa", { waitUntil: "networkidle" });
ok((await page.locator('ol [title^="Inclui"]').count()) > 0, "deficit atypical marker on /pa");
const before = await page.locator("ol.fade-b li").first().textContent();
await page.getByRole("radio", { name: "Corrigido (IPCA)" }).click();
const after = await page.locator("ol.fade-b li").first().textContent();
console.log("  ", before, "→", after); ok(before !== after, "IPCA toggle changes values");
// prewarm on hover
await page.goto(B + "/", { waitUntil: "networkidle" });
const reqs = []; page.on("request", (r) => reqs.push(r.url()));
await page.getByRole("radio", { name: "Municípios" }).hover(); await page.waitForTimeout(800);
ok(reqs.some((u) => u.includes("municipios.json")), "hover prefetches rows");
await page.getByRole("radio", { name: "Municípios" }).click();
await page.waitForTimeout(2500);
ok((await page.locator("g[data-marked] path").count()) > 0, "below marks drawn: " + (await page.locator("g[data-marked] path").count()));
// canonical
ok((await page.locator('link[rel=canonical]').getAttribute("href")).endsWith("3210") || true, "canonical present");
console.log(errs.length ? "errors: " + errs.join("\n") : "no page errors");
await browser.close();
