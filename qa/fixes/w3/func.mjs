import { chromium } from "playwright";
const B = "http://localhost:3210";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const ok = (c, m) => console.log(c ? "PASS" : "FAIL", m);
// 1. home ?ano=2015 map click keeps year
await page.goto(B + "/?ano=2015", { waitUntil: "networkidle" });
const req = []; page.on("request", (r) => req.push(r.url()));
await page.waitForTimeout(500);
ok(!req.some((u) => u.includes("municipios.json")), "home: no municipios.json on load");
const rankHref = await page.locator("#ranking-estados a").first().getAttribute("href");
ok(rankHref.includes("ano=2015"), "ranking link keeps ano: " + rankHref);
const defHref = await page.locator("ol a").first().getAttribute("href");
ok(defHref.includes("ano=2015"), "deficit link keeps ano: " + defHref);
// keyboard: tab into map shapes
const shape = page.locator('svg[role=group] path[role=link]').first();
ok((await page.locator('svg[role=group] path[role=link]').count()) === 27, "27 focusable state shapes");
await shape.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
await page.waitForTimeout(200);
ok(await page.locator("text=Enter para abrir").count() === 1, "focus tooltip shown");
const lbl = await shape.getAttribute("aria-label"); console.log("  label:", lbl);
await page.keyboard.press("Enter");
await page.waitForURL((u) => u.pathname !== "/", { timeout: 8000 }).catch(() => {});
ok(/\/[a-z]{2}(\/[a-z-]+)?\?ano=2015/.test(page.url()), "Enter on shape navigates with ano: " + page.url());
// 2. municipal mode fetches rows, click keeps ano
await page.goto(B + "/?ano=2015", { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Municípios" }).click();
await page.waitForResponse((r) => r.url().includes("municipios.json")).catch(() => {});
await page.waitForTimeout(1500);
ok((await page.locator("svg path[data-id]").count()) > 5000, "municipal layer drawn");
// click a municipality
const p = page.locator("svg path[data-id]").nth(3000);
await p.click({ force: true });
await page.waitForTimeout(1500);
ok(page.url().includes("ano=2015"), "municipal click keeps ano: " + page.url());
// 3. UF filters in URL
await page.goto(B + "/sp?ano=2021", { waitUntil: "networkidle" });
await page.getByRole("combobox", { name: /Situação/ }).click();
await page.getByRole("option", { name: "Abaixo de 25%" }).click();
await page.getByRole("combobox", { name: /Reincidência/ }).click();
await page.getByRole("option", { name: "2+ anos fora de 2020–21" }).click();
await page.getByRole("button", { name: "Faltou", exact: true }).click();
await page.waitForTimeout(300);
const url = page.url(); console.log("  url:", url);
const count = await page.locator('[role=status][aria-live=polite]').filter({ hasText: /de|municípios/ }).last().textContent();
await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
const count2 = await page.locator('[role=status][aria-live=polite]').filter({ hasText: /de|municípios/ }).last().textContent();
ok(count === count2 && url.includes("situacao=below") && url.includes("ano=2021"), `UF filters survive reload (${count} / ${count2})`);
// 4. region CSV
const csv = await page.goto(B + "/regiao/sul", { waitUntil: "networkidle" }).then(() => page.locator("a[download]").first().getAttribute("href"));
ok(csv.includes("regiao-sul"), "region CSV: " + csv);
console.log(errs.length ? "errors: " + errs.join("\n") : "no page errors");
await browser.close();
