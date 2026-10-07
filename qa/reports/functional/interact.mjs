// Interactive functional tests for Radar MDE. Usage: cd qa && node reports/functional/interact.mjs [testName ...]
// Prints PASS/FAIL per check and a summary; screenshots go to reports/functional/shots/.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const B = process.env.BASE ?? "http://localhost:3210";
const only = process.argv.slice(2);
const res = [];
const check = (name, ok, detail = "") => {
  res.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch();
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"], ...opts });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && p.errors.push(m.text().slice(0, 200)));
  return p;
}
const go = (p, u) => p.goto(B + u, { waitUntil: "networkidle", timeout: 120000 });
const checkedYear = (p) => p.locator('[role=radiogroup] [role=radio][aria-checked=true]').first().innerText();
const qs = (p) => new URL(p.url()).search;

const tests = {
  async year() {
    const p = await newPage();
    await go(p, "/");
    check("year: default is 2025", (await checkedYear(p)) === "2025");
    await p.getByRole("radio", { name: "2015", exact: true }).click();
    await p.waitForTimeout(300);
    check("year: click 2015 sets ?ano=2015", qs(p) === "?ano=2015", qs(p));
    const txt = await p.locator("main").innerText();
    check("year: headline updates to 2015", /Em 2015/.test(txt));
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    check("year: survives reload", (await checkedYear(p)) === "2015", await checkedYear(p));
    // keyboard
    await p.getByRole("radio", { name: "2015", exact: true }).focus();
    await p.keyboard.press("ArrowLeft");
    await p.waitForTimeout(200);
    check("year: ArrowLeft -> 2014", (await checkedYear(p)) === "2014");
    await p.keyboard.press("Home");
    await p.waitForTimeout(200);
    check("year: Home -> 2008", (await checkedYear(p)) === "2008");
    check("year: prev button disabled at 2008", await p.getByRole("button", { name: "Ano anterior" }).isDisabled());
    await p.keyboard.press("ArrowLeft");
    await p.waitForTimeout(200);
    check("year: ArrowLeft at 2008 stays", (await checkedYear(p)) === "2008");
    await p.keyboard.press("End");
    await p.waitForTimeout(200);
    check("year: End -> 2025 and ?ano removed", (await checkedYear(p)) === "2025" && qs(p) === "", qs(p));
    check("year: next button disabled at 2025", await p.getByRole("button", { name: "Próximo ano" }).isDisabled());
    await p.getByRole("button", { name: "Ano anterior" }).click();
    check("year: prev button -> 2024", (await checkedYear(p)) === "2024");
    // invalid params
    for (const v of ["1999", "abc", "2015.5", "", "2030"]) {
      await go(p, "/?ano=" + v);
      await p.waitForTimeout(300);
      check(`year: ?ano=${v} falls back to 2025`, (await checkedYear(p)) === "2025");
    }
    await go(p, "/?ano=2012");
    await p.waitForTimeout(400);
    check("year: ?ano=2012 deep link", (await checkedYear(p)) === "2012");
    // drill down keeps year
    await p.locator('main a[href^="/sp"]').first().click();
    await p.waitForURL(/\/sp/);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(500);
    check("year: drill to UF keeps ?ano", qs(p) === "?ano=2012" && (await checkedYear(p)) === "2012", p.url() + " " + (await checkedYear(p)));
    // back
    await p.goBack();
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(600);
    check("year: back restores 2012 on /", (await checkedYear(p)) === "2012", p.url() + " " + (await checkedYear(p)));
    await p.goForward();
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(600);
    check("year: forward restores 2012 on /sp", (await checkedYear(p)) === "2012", p.url() + " " + (await checkedYear(p)));
    // change year on /sp then go back: does / keep its own year?
    await p.getByRole("radio", { name: "2019", exact: true }).click();
    await p.waitForTimeout(200);
    check("year: UF year change updates URL", qs(p) === "?ano=2019", qs(p));
    // city link from UF table carries ano; does city page use it?
    await go(p, "/sp?ano=2019");
    await p.waitForTimeout(500);
    const cityHref = await p.locator('main table a[href^="/sp/"]').first().getAttribute("href");
    check("year: UF table city link carries ?ano", /\?ano=2019/.test(cityHref ?? ""), cityHref);
    await go(p, cityHref);
    const ctext = await p.locator("main").innerText();
    check("year: city page honours ?ano=2019 (shows 2019 as focus year)", /Em 2019/.test(ctext), (ctext.match(/Em \d{4}[^.]*\./) ?? [""])[0]);
    check("year: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async search() {
    const p = await newPage();
    await go(p, "/sobre");
    const dlg = p.getByRole("dialog");
    for (const [label, key] of [["Meta+K", "Meta+k"], ["Ctrl+K", "Control+k"], ["/", "/"]]) {
      await p.locator("body").click({ position: { x: 5, y: 300 } });
      await p.keyboard.press(key);
      await p.waitForTimeout(300);
      check(`search: ${label} opens palette`, await dlg.isVisible());
      await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
      check(`search: Esc closes (${label})`, !(await dlg.isVisible()));
    }
    const input = () => dlg.getByRole("combobox");
    const open = async () => { await p.keyboard.press("Control+k"); await p.waitForTimeout(300); };
    const query = async (q) => { await input().fill(q); await p.waitForTimeout(500); return dlg.getByRole("option").allInnerTexts(); };
    await open();
    let opts = await query("sao paulo");
    check("search: 'sao paulo' (no accent) finds São Paulo city first", /São Paulo/.test(opts[0] ?? ""), opts.slice(0, 3).join(" | "));
    opts = await query("SÃO");
    check("search: 'SÃO' upper with accent works", opts.some((o) => /São/.test(o)), String(opts.length));
    opts = await query("santa barbara d oeste");
    check("search: 'santa barbara d oeste' finds Santa Bárbara d'Oeste", opts.some((o) => /Santa Bárbara d.Oeste/.test(o)), opts.slice(0, 2).join(" | "));
    opts = await query("santa bárbara d’oeste");
    check("search: curly apostrophe finds Santa Bárbara d'Oeste", opts.some((o) => /Santa Bárbara d.Oeste/.test(o)), opts.slice(0, 2).join(" | "));
    opts = await query("pau d'arco");
    check("search: 'pau d'arco' lists PA and TO", opts.filter((o) => /Pau D.Arco/.test(o)).length >= 2, opts.join(" | ").slice(0, 200));
    opts = await query("pau d'arco to");
    check("search: 'pau d'arco to' filters to TO first", /Pau D.Arco[\s\S]*TO/.test(opts[0] ?? ""), opts[0]);
    opts = await query("campinas sp");
    check("search: 'campinas sp'", /Campinas/.test(opts[0] ?? ""), opts[0]);
    opts = await query("nordeste");
    check("search: 'nordeste' shows region", opts.some((o) => /Região Nordeste/.test(o)), opts.slice(0, 3).join(" | "));
    opts = await query("sp");
    check("search: 'sp' shows UF São Paulo", opts.some((o) => /^São Paulo[\s\S]*Sudeste/.test(o)), opts.slice(0, 4).join(" | ").replace(/\n/g, " "));
    opts = await query("zzzzqqq");
    const empty = await dlg.innerText();
    check("search: no-result state", opts.length === 0 && /Nenhum resultado/.test(empty));
    opts = await query("   ");
    check("search: whitespace-only shows default lists", opts.length > 20, String(opts.length));
    // arrows + enter
    await query("santo andre");
    await p.keyboard.press("ArrowDown");
    const sel = await dlg.locator('[role=option][aria-selected=true]').innerText();
    await p.keyboard.press("ArrowUp");
    const sel0 = await dlg.locator('[role=option][aria-selected=true]').innerText();
    check("search: arrow keys move selection", sel !== sel0, `${sel0.split("\n")[0]} -> ${sel.split("\n")[0]}`);
    await p.keyboard.press("Enter");
    await p.waitForURL(/\/sp\/santo-andre/, { timeout: 30000 }).catch(() => {});
    check("search: Enter navigates to Santo André SP", /\/sp\/santo-andre$/.test(p.url()), p.url());
    await p.waitForLoadState("networkidle");
    // recents
    await open();
    const rec = await dlg.innerText();
    check("search: recents show Santo André", /Recentes[\s\S]*Santo André/.test(rec));
    // '/' inside input shouldn't reopen; typing '/' into palette input
    await input().type("a/b");
    check("search: '/' typed inside palette input stays in input", (await input().inputValue()) === "a/b");
    await p.keyboard.press("Escape");
    // '/' in a text field elsewhere should not open
    await go(p, "/explorar");
    await p.getByRole("searchbox", { name: /Buscar município pelo nome/ }).click();
    await p.keyboard.type("/");
    await p.waitForTimeout(300);
    check("search: '/' inside explorer input does not open palette", !(await dlg.isVisible()));
    // recents store robustness: corrupt storage
    await p.evaluate(() => localStorage.setItem("radar-mde:recent-search", "{bad json"));
    await p.keyboard.press("Escape");
    await p.locator("body").click({ position: { x: 5, y: 300 } });
    await open();
    check("search: corrupt recents do not crash", await dlg.isVisible() && !p.errors.some((e) => /JSON/.test(e)));
    await p.keyboard.press("Escape");
    // recent region then UF
    await open();
    await query("bahia");
    await p.keyboard.press("Enter");
    await p.waitForURL(/\/ba$/, { timeout: 30000 }).catch(() => {});
    check("search: Enter on 'bahia' opens /ba", /\/ba$/.test(p.url()), p.url());
    await p.waitForLoadState("networkidle");
    await open();
    await query("distrito federal");
    await p.keyboard.press("Enter");
    await p.waitForURL(/\/df/, { timeout: 30000 }).catch(() => {});
    check("search: Distrito Federal -> /df/brasilia", /\/df\/brasilia$/.test(p.url()), p.url());
    await p.waitForLoadState("networkidle");
    await open();
    const shot = path.join(SHOTS, "search-recents.png");
    await p.screenshot({ path: shot });
    check("search: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async watch() {
    const p = await newPage();
    await go(p, "/acompanhar");
    check("watch: empty state", /Nenhum município acompanhado/.test(await p.locator("main").innerText()));
    await go(p, "/sp/santa-barbara-d-oeste");
    const btn = p.getByRole("button", { name: /Acompanhar|Acompanhando/ }).first();
    await btn.click();
    await p.waitForTimeout(200);
    check("watch: aria-pressed true after click", (await btn.getAttribute("aria-pressed")) === "true");
    await go(p, "/mt/boa-esperanca-do-norte");
    await p.getByRole("button", { name: /Acompanhar/ }).first().click();
    await go(p, "/df/brasilia");
    await p.getByRole("button", { name: /Acompanhar/ }).first().click();
    await p.reload({ waitUntil: "networkidle" });
    check("watch: state persists after reload", (await p.getByRole("button", { name: /Acompanhando/ }).first().getAttribute("aria-pressed")) === "true");
    await go(p, "/acompanhar");
    await p.waitForTimeout(1500);
    let t = await p.locator("main").innerText();
    check("watch: /acompanhar lists 3", /3 municípios/.test(t) && /Santa Bárbara d.Oeste/.test(t) && /Boa Esperança do Norte/.test(t) && /Brasília/.test(t), t.slice(0, 200).replace(/\n/g, " "));
    await p.screenshot({ path: path.join(SHOTS, "acompanhar.png"), fullPage: true });
    // remove from list page
    const rm = p.getByRole("button", { name: /Remover|Deixar/ });
    const n = await rm.count();
    check("watch: remove buttons present", n === 3, String(n));
    if (n) {
      await rm.first().click();
      await p.waitForTimeout(300);
      t = await p.locator("main").innerText();
      check("watch: remove updates count to 2", /2 municípios/.test(t));
    }
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    t = await p.locator("main").innerText();
    check("watch: removal persists after reload", /2 municípios/.test(t));
    // legacy & bogus entries
    await p.evaluate(() => localStorage.setItem("radar-mde:watch", JSON.stringify(["santo-andre", "xx/nope"])));
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    t = await p.locator("main").innerText();
    check("watch: legacy bare slug maps to SP + missing item footer", /Santo André/.test(t) && /não foi encontrado/.test(t), t.slice(0, 300).replace(/\n/g, " "));
    await p.evaluate(() => localStorage.setItem("radar-mde:watch", "{oops"));
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    check("watch: corrupt storage shows empty state, no crash", /Nenhum município acompanhado/.test(await p.locator("main").innerText()));
    await p.evaluate(() => localStorage.setItem("radar-mde:watch", JSON.stringify([1, null])));
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    check("watch: non-string entries do not crash", !p.errors.length, p.errors.slice(0, 2).join(" | "));
    // cross-tab sync
    await p.evaluate(() => localStorage.setItem("radar-mde:watch", "[]"));
    const p2 = await p.context().newPage();
    await p2.goto(B + "/sp/santo-andre", { waitUntil: "networkidle" });
    await go(p, "/acompanhar");
    await p2.getByRole("button", { name: /Acompanhar/ }).first().click();
    await p.waitForTimeout(1500);
    check("watch: other tab add reflects in /acompanhar (storage event)", /Santo André/.test(await p.locator("main").innerText()));
    check("watch: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async share() {
    const p = await newPage();
    await go(p, "/pa/pau-d-arco");
    await p.getByRole("button", { name: "Compartilhar" }).click();
    await p.getByRole("menuitem", { name: "Copiar link" }).click();
    await p.waitForTimeout(300);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    check("share: copies city URL", clip === B + "/pa/pau-d-arco", clip);
    check("share: button shows 'Link copiado'", await p.getByRole("button", { name: /Link copiado/ }).isVisible());
    await p.waitForTimeout(2300);
    check("share: label resets", await p.getByRole("button", { name: "Compartilhar" }).isVisible());
    const [popup] = await Promise.all([
      p.context().waitForEvent("page", { timeout: 5000 }).catch(() => null),
      (async () => { await p.getByRole("button", { name: "Compartilhar" }).click(); await p.getByRole("menuitem", { name: /WhatsApp/ }).click(); })(),
    ]);
    check("share: WhatsApp opens wa.me with text", !!popup && /(wa\.me|api\.whatsapp\.com)\/(send\/)?\?text=/.test(popup.url()), popup?.url().slice(0, 140));
    if (popup) check("share: WhatsApp text contains city URL", decodeURIComponent(popup.url()).includes("/pa/pau-d-arco"));
    // share on a non-default year: does it keep ano?
    await go(p, "/sp/santo-andre?ano=2015");
    await p.getByRole("button", { name: "Compartilhar" }).click();
    await p.getByRole("menuitem", { name: "Copiar link" }).click();
    await p.waitForTimeout(300);
    const clip2 = await p.evaluate(() => navigator.clipboard.readText());
    check("share: link from ?ano page (informational)", true, clip2);
    // Share exists on UF/region/home?
    for (const u of ["/", "/sp", "/regiao/sul", "/explorar"]) {
      await go(p, u);
      const n = await p.getByRole("button", { name: "Compartilhar" }).count();
      check(`share: button on ${u} (informational)`, true, n ? "present" : "absent");
    }
    await p.context().close();
  },

  async theme() {
    const p = await newPage({ colorScheme: "light" });
    await go(p, "/");
    const cls = () => p.evaluate(() => document.documentElement.className);
    check("theme: light initially", !/\bdark\b/.test(await cls()));
    await p.getByRole("button", { name: "Usar tema escuro" }).click();
    await p.waitForTimeout(200);
    check("theme: header toggle -> dark", /\bdark\b/.test(await cls()));
    await p.reload({ waitUntil: "networkidle" });
    check("theme: dark persists after reload", /\bdark\b/.test(await cls()));
    check("theme: footer radio shows Escuro checked", (await p.getByRole("radio", { name: "Escuro" }).getAttribute("aria-checked")) === "true");
    await p.getByRole("radio", { name: "Sistema" }).click();
    await p.waitForTimeout(200);
    check("theme: Sistema -> follows light OS", !/\bdark\b/.test(await cls()));
    await go(p, "/sp/santo-andre");
    check("theme: persists across navigation", !/\bdark\b/.test(await cls()) && (await p.evaluate(() => localStorage.getItem("theme"))) === "system");
    // FOUC check: dark theme stored -> first paint dark?
    await p.evaluate(() => localStorage.setItem("theme", "dark"));
    const resp = await p.request.get(B + "/sobre");
    const html = await resp.text();
    check("theme: next-themes inline script present (no flash)", /localStorage|theme/.test(html.slice(0, 20000)));
    await p.context().close();
  },

  async mobile() {
    const p = await newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    await go(p, "/");
    const ow = await p.evaluate(() => document.documentElement.scrollWidth);
    check("mobile: no horizontal overflow on /", ow <= 375, String(ow));
    const nav = p.locator("header nav").last();
    check("mobile: nav visible", await nav.isVisible());
    for (const label of ["Explorar", "Acompanhando", "Dados", "Metodologia", "Painel"]) {
      const l = p.locator("header").getByRole("link", { name: label, exact: true }).filter({ visible: true });
      const c = await l.count();
      if (!c) { check(`mobile: nav link ${label} visible`, false); continue; }
      await l.first().click();
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(300);
      const ow2 = await p.evaluate(() => document.documentElement.scrollWidth);
      check(`mobile: nav -> ${label} (${new URL(p.url()).pathname}) no overflow`, ow2 <= 375, String(ow2));
    }
    await p.screenshot({ path: path.join(SHOTS, "mobile-home.png") });
    for (const u of ["/sp", "/sp/santo-andre", "/explorar", "/acompanhar", "/dados", "/sobre", "/regiao/nordeste", "/df/brasilia", "/xx"]) {
      await go(p, u);
      await p.waitForTimeout(300);
      const w = await p.evaluate(() => document.documentElement.scrollWidth);
      check(`mobile: ${u} no horizontal overflow`, w <= 375, String(w));
    }
    // search on mobile
    await go(p, "/");
    await p.getByRole("button", { name: "Buscar município, estado ou região" }).click();
    await p.waitForTimeout(400);
    check("mobile: search opens by tap", await p.getByRole("dialog").isVisible());
    await p.getByRole("dialog").getByRole("combobox").fill("recife");
    await p.waitForTimeout(600);
    await p.getByRole("dialog").getByRole("option").first().click();
    await p.waitForURL(/\/pe\/recife/, { timeout: 30000 }).catch(() => {});
    check("mobile: tap result navigates", /\/pe\/recife/.test(p.url()), p.url());
    await p.screenshot({ path: path.join(SHOTS, "mobile-city.png"), fullPage: true });
    check("mobile: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async explorer() {
    const p = await newPage();
    await go(p, "/explorar");
    await p.getByText(/de 5\.570 municípios/).waitFor({ timeout: 60000 });
    const count = async () => Number((await p.getByText(/ de 5\.570 municípios/).innerText()).split(" de ")[0].replace(/\./g, ""));
    check("explorer: loads 5.570", (await count()) === 5570);
    const pick = async (trigger, option) => {
      await p.getByRole("combobox", { name: trigger }).click();
      await p.getByRole("option", { name: option }).first().click();
      await p.waitForTimeout(300);
    };
    await pick("Região", /^Sul/);
    check("explorer: Região=Sul sets ?regiao=sul", qs(p).includes("regiao=sul"), qs(p));
    const sul = await count();
    check("explorer: Sul count = 1.191", sul === 1191, String(sul));
    await pick("UF", /SC/);
    check("explorer: UF=SC count 295", (await count()) === 295, String(await count()));
    await p.reload({ waitUntil: "networkidle" });
    await p.getByText(/de 5\.570 municípios/).waitFor({ timeout: 60000 });
    await p.waitForTimeout(300);
    check("explorer: regiao+uf survive reload", (await count()) === 295, qs(p) + " " + (await count()));
    // year select
    await p.getByRole("combobox", { name: "Exercício" }).click();
    await p.getByRole("option", { name: "2021" }).click();
    await p.waitForTimeout(300);
    check("explorer: year select sets ?ano=2021", qs(p).includes("ano=2021"), qs(p));
    await pick(/Situação em/, /Abaixo de 25%/);
    const below21 = await count();
    check("explorer: SC below 25% in 2021 > 0", below21 > 0, String(below21));
    await p.reload({ waitUntil: "networkidle" });
    await p.getByText(/de 5\.570 municípios/).waitFor({ timeout: 60000 });
    await p.waitForTimeout(300);
    const afterReload = await count();
    check("explorer: situação filter survives reload", afterReload === below21, `${below21} -> ${afterReload} (${qs(p)})`);
    // name filter with apostrophe variants
    await p.getByRole("button", { name: /Limpar/ }).first().click().catch(() => {});
    await p.waitForTimeout(300);
    const box = p.getByRole("searchbox", { name: /Buscar município pelo nome/ });
    for (const [q, min] of [["santa barbara d'oeste", 1], ["santa barbara d’oeste", 1], ["santa barbara d oeste", 1], ["olho d agua", 5], ["SAO PAULO", 3], ["embu guacu", 1]]) {
      await box.fill(q);
      await p.waitForTimeout(300);
      const n = await count();
      check(`explorer: name filter '${q}' matches >= ${min}`, n >= min, String(n));
    }
    await box.fill("");
    // sorting
    await p.waitForTimeout(300);
    const firstName = () => p.locator("tbody tr").first().locator("a").first().innerText();
    await p.getByRole("button", { name: "População" }).click();
    await p.waitForTimeout(300);
    check("explorer: sort População desc -> São Paulo first", (await firstName()) === "São Paulo", await firstName());
    await p.getByRole("button", { name: "População" }).click();
    await p.waitForTimeout(300);
    check("explorer: sort População asc -> smallest first", (await firstName()) !== "São Paulo", await firstName());
    await p.getByRole("button", { name: "Município", exact: true }).first().click();
    await p.waitForTimeout(300);
    check("explorer: sort Município asc starts with A", /^A/.test(await firstName()), await firstName());
    // pagination
    const rows = () => p.locator("tbody tr").count();
    check("explorer: first page 100 rows", (await rows()) === 100, String(await rows()));
    await p.getByRole("button", { name: /Mostrar mais/ }).click();
    await p.waitForTimeout(400);
    check("explorer: Mostrar mais -> 300 rows", (await rows()) === 300, String(await rows()));
    // CSV export of a filtered slice
    await pick("UF", /RR/);
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.getByRole("button", { name: "Exportar CSV" }).click()]);
    const file = path.join(SHOTS, "explorer-rr.csv");
    await dl.saveAs(file);
    const csv = fs.readFileSync(file, "utf8");
    const lines = csv.replace(/^﻿/, "").trim().split("\n");
    check("explorer: CSV filename", dl.suggestedFilename() === "radar-mde-explorar.csv", dl.suggestedFilename());
    check("explorer: CSV has BOM", csv.charCodeAt(0) === 0xfeff);
    check("explorer: CSV RR rows = 15 x 18 years", lines.length - 1 === 15 * 18, String(lines.length - 1));
    check("explorer: CSV no NaN/undefined", !/NaN|undefined|null/.test(csv));
    check("explorer: CSV every row is RR", lines.slice(1).every((l) => l.split(",")[2] === "RR"));
    const rawBrasilia = await (await fetch(B + "/dados/csv/df")).text();
    check("csv route: /dados/csv/df ok", /Bras/.test(rawBrasilia));
    // situation 'missing' / 'nd' counts in 2025
    await p.getByRole("button", { name: /Limpar/ }).first().click().catch(() => {});
    await p.getByRole("combobox", { name: "Exercício" }).click();
    await p.getByRole("option", { name: "2025" }).click();
    await pick(/Situação em/, /Não declarou/);
    const nd = await count();
    check("explorer: 'Não declarou' 2025 > 0", nd > 0, String(nd));
    await p.screenshot({ path: path.join(SHOTS, "explorer-nd.png") });
    // invalid params
    await go(p, "/explorar?regiao=foo&uf=zz&ano=1990");
    await p.getByText(/de 5\.570 municípios/).waitFor({ timeout: 60000 });
    check("explorer: invalid params ignored", (await count()) === 5570);
    await go(p, "/explorar?regiao=sul&uf=SP");
    await p.getByText(/de 5\.570 municípios/).waitFor({ timeout: 60000 });
    await p.waitForTimeout(300);
    check("explorer: conflicting regiao=sul&uf=SP -> Sul only", (await count()) === 1191, `${await count()} url=${qs(p)}`);
    await go(p, "/explorar?uf=sp");
    await p.getByText(/de 5\.570 municípios/).waitFor({ timeout: 60000 });
    await p.waitForTimeout(300);
    check("explorer: lowercase uf=sp accepted", (await count()) === 645, String(await count()));
    check("explorer: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async uftable() {
    const p = await newPage();
    await go(p, "/sp");
    const main = p.locator("main");
    const footer = async () => ((await main.innerText()).match(/Mostrando [\d.]+ de [\d.]+/) ?? [""])[0];
    check("uf: shows 'Mostrando 50 de 645'", /Mostrando 50 de 645/.test(await footer()), await footer());
    await main.getByRole("button", { name: /Mostrar mais/ }).click();
    await p.waitForTimeout(300);
    check("uf: Mostrar mais -> 150", /Mostrando 150 de 645/.test(await footer()), await footer());
    const search = main.getByRole("textbox").first();
    await search.fill("santa barbara d oeste");
    await p.waitForTimeout(300);
    const t1 = await main.innerText();
    check("uf: search 'santa barbara d oeste' (no apostrophe) finds it", /Santa Bárbara d'Oeste/.test(t1));
    await search.fill("santa barbara d’oeste");
    await p.waitForTimeout(300);
    check("uf: search with curly apostrophe finds it", /Santa Bárbara d'Oeste/.test(await main.innerText()));
    await search.fill("zzzz");
    await p.waitForTimeout(300);
    const empty = await main.innerText();
    check("uf: empty-search state shown", /Nenhum/.test(empty));
    await search.fill("");
    // sort by name
    await main.getByRole("button", { name: /^Município/ }).click();
    await p.waitForTimeout(300);
    const first = await main.locator("tbody tr a, [role=row] a").first().innerText();
    check("uf: sort by name asc -> Adamantina", first === "Adamantina", first);
    // metric toggles of the map
    for (const m of ["Fundeb", "Por aluno", "MDE"]) {
      await main.getByRole("radio", { name: m, exact: true }).click();
      await p.waitForTimeout(300);
      check(`uf: map metric ${m} checked`, (await main.getByRole("radio", { name: m, exact: true }).getAttribute("aria-checked")) === "true");
    }
    // year bar click
    await p.getByRole("radio", { name: "2021", exact: true }).click();
    await p.waitForTimeout(300);
    check("uf: year 2021 -> headline", /Em 2021/.test(await main.innerText()));
    // filter selects
    const combos = main.getByRole("combobox");
    check("uf: 3 filter selects", (await combos.count()) >= 3, String(await combos.count()));
    await combos.nth(0).click();
    const opts = await p.getByRole("option").allInnerTexts();
    await p.getByRole("option").nth(1).click();
    await p.waitForTimeout(300);
    check("uf: região intermediária filter applies", !/Mostrando 50 de 645/.test(await footer()), (await footer()) + " opts=" + opts.slice(0, 3).join("|"));
    await p.screenshot({ path: path.join(SHOTS, "uf-filtered.png"), fullPage: false });
    check("uf: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async territory() {
    const p = await newPage();
    await go(p, "/");
    const main = p.locator("main");
    for (const g of await main.getByRole("radiogroup").all()) {
      const radios = await g.getByRole("radio").all();
      const label = await g.getAttribute("aria-label");
      if (/Exercício|^$/.test(label ?? "") || radios.length > 10) continue;
      for (const r of radios) {
        await r.click();
        await p.waitForTimeout(250);
        check(`home: ${label} -> ${(await r.innerText()).trim()}`, (await r.getAttribute("aria-checked")) === "true");
      }
      await radios[0].click();
    }
    check("home: segmented toggles no errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    // map mode 'Municípios'
    await main.getByRole("radio", { name: "Municípios" }).click();
    await p.waitForTimeout(3000);
    const paths = await main.locator("svg path").count();
    check("home: municipal map renders thousands of paths", paths > 5000, String(paths));
    await p.screenshot({ path: path.join(SHOTS, "home-mun-map.png") });
    // KPI tabs in Evolução
    const tabs = main.getByRole("tab");
    const nt = await tabs.count();
    for (let i = 0; i < nt; i++) {
      await tabs.nth(i).click();
      await p.waitForTimeout(200);
      check(`home: evolução tab ${i} selected`, (await tabs.nth(i).getAttribute("aria-selected")) === "true");
    }
    // UF ranking table sort
    const hdr = main.getByRole("button", { name: /MDE mediana/ });
    if (await hdr.count()) {
      await hdr.first().click();
      await p.waitForTimeout(300);
      check("home: ranking sort by MDE mediana", true);
    }
    // ranking table keyboard
    check("home: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    // region
    await go(p, "/regiao/nordeste");
    check("region: 9 estados", /9 estados/.test(await main.innerText()));
    await go(p, "/regiao/centro-oeste?ano=2020");
    await p.waitForTimeout(400);
    check("region: ?ano=2020 deep-link", (await checkedYear(p)) === "2020");
    const dfLink = await main.locator('a[href^="/df"]').first().getAttribute("href");
    check("region: DF link goes to /df/brasilia with ano", dfLink === "/df/brasilia?ano=2020", dfLink);
    await p.context().close();
  },

  async crumbs() {
    const p = await newPage();
    await go(p, "/sp/santo-andre");
    await p.getByRole("button", { name: "Trocar de região" }).click();
    await p.getByRole("menuitem", { name: /Nordeste/ }).click();
    await p.waitForURL(/regiao\/nordeste/, { timeout: 30000 }).catch(() => {});
    check("crumbs: region sibling menu navigates", /regiao\/nordeste$/.test(p.url()), p.url());
    await go(p, "/sp/santo-andre");
    await p.getByRole("button", { name: "Trocar de estado" }).click();
    await p.getByRole("menuitem").first().waitFor();
    const items = await p.getByRole("menuitem").allInnerTexts();
    check("crumbs: state menu lists 4 Sudeste UFs", items.length === 4, items.join("|").replace(/\n/g, ""));
    await p.getByRole("menuitem", { name: /Minas Gerais/ }).click();
    await p.waitForURL(/\/mg$/, { timeout: 30000 }).catch(() => {});
    check("crumbs: state menu navigates to /mg", /\/mg$/.test(p.url()), p.url());
    await go(p, "/sp/santo-andre");
    await p.getByRole("button", { name: /Trocar de município/ }).click();
    const input = p.getByRole("combobox", { name: /Buscar município em São Paulo/ });
    await input.waitFor();
    await p.waitForTimeout(800);
    const head = await p.getByText(/645 municípios/).count();
    check("crumbs: city picker lists 645", head > 0);
    for (const [q, want] of [["santa barbara d'oeste", "Santa Bárbara d'Oeste"], ["santa barbara d oeste", "Santa Bárbara d'Oeste"], ["santa bárbara d’oeste", "Santa Bárbara d'Oeste"], ["3548", null]]) {
      await input.fill(q);
      await p.waitForTimeout(300);
      const o = await p.getByRole("option").allInnerTexts();
      if (want) check(`crumbs: city picker '${q}' finds ${want}`, o.includes(want), o.slice(0, 3).join("|"));
      else check(`crumbs: city picker '${q}' (IBGE digits) does not list unrelated cities`, o.length === 0, `${o.length} options e.g. ${o.slice(0, 3).join("|")}`);
    }
    await input.fill("campinas");
    await p.waitForTimeout(300);
    await p.keyboard.press("Enter");
    await p.waitForURL(/\/sp\/campinas$/, { timeout: 30000 }).catch(() => {});
    check("crumbs: city picker Enter navigates", /\/sp\/campinas$/.test(p.url()), p.url());
    await go(p, "/df/brasilia");
    const crumbs = await p.locator('nav[aria-label="Navegação territorial"]').innerText();
    check("crumbs: DF has no city picker", (await p.getByRole("button", { name: /Trocar de município/ }).count()) === 0, crumbs.replace(/\n/g, " "));
    check("crumbs: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async clicks() {
    const p = await newPage();
    await go(p, "/?ano=2015");
    await p.waitForTimeout(800);
    // click a UF shape on the national map
    const box = await p.evaluate(() => {
      const svg = [...document.querySelectorAll("main svg[role=img]")].find((s) => s.querySelectorAll("path").length > 20);
      let best = null;
      for (const el of svg.querySelectorAll("path")) { const b = el.getBoundingClientRect(); if (!best || b.width * b.height > best.width * best.height) best = b; }
      window.scrollTo(0, 0);
      return { x: best.x + best.width / 2, y: best.y + best.height / 2 + window.scrollY };
    });
    await p.mouse.wheel(0, box.y - 400);
    await p.waitForTimeout(300);
    await p.mouse.move(box.x, 400);
    await p.mouse.click(box.x, 400);
    await p.waitForURL((u) => u.pathname !== "/", { timeout: 30000 }).catch(() => {});
    check("map: click on UF shape navigates", new URL(p.url()).pathname !== "/", p.url());
    check("map: navigation from map keeps ?ano=2015", qs(p) === "?ano=2015", p.url());
    // YearBars click on UF page
    await go(p, "/sp");
    const bars = p.locator("main .recharts-bar-rectangle");
    const nb = await bars.count();
    if (nb) {
      await bars.nth(3).scrollIntoViewIfNeeded();
      const bb = await bars.nth(3).boundingBox();
      await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await p.waitForTimeout(400);
      check("uf: clicking a year bar changes year", (await checkedYear(p)) !== "2025", `${await checkedYear(p)} (${nb} bars)`);
    } else check("uf: year bars found", false);
    // City page: ActionKit tabs + copy
    await go(p, "/sp/santo-andre");
    const tabs = p.getByRole("tab");
    const nt = await tabs.count();
    for (let i = 0; i < nt; i++) {
      await tabs.nth(i).click();
      await p.waitForTimeout(150);
      const body = await p.locator("main textarea").filter({ visible: true }).first().inputValue();
      check(`city: template tab ${i} '${(await tabs.nth(i).innerText()).trim()}' has body`, body.length > 200 && !/undefined|NaN|null/.test(body), String(body.length));
    }
    await p.getByRole("button", { name: /Copiar texto/ }).click();
    await p.waitForTimeout(300);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    check("city: Copiar texto copies template", clip.length > 200 && /Santo André/.test(clip), String(clip.length));
    // City map click on a neighbour
    const cityShapes = p.locator("main svg[role=img] path");
    const ns = await cityShapes.count();
    check("city: state map renders shapes", ns > 600, String(ns));
    // peers link
    const peer = p.locator('main a[href^="/sp/"]:not([aria-current])').first();
    const peerHref = await peer.getAttribute("href");
    await peer.click();
    await p.waitForURL((u) => u.pathname === peerHref, { timeout: 30000 }).catch(() => {});
    check("city: neighbour link navigates", new URL(p.url()).pathname === peerHref, `${peerHref} -> ${p.url()}`);
    // Boa Esperança do Norte: template contradicts data
    await go(p, "/mt/boa-esperanca-do-norte");
    const body = await p.locator("main textarea").first().inputValue();
    check("city(no data): LAI template does not claim compliance", !/declarou ter cumprido/.test(body), (body.match(/Contexto:[^\n]*/) ?? [""])[0].slice(0, 160));
    check("city(no data): does not flag 'não declarou' for years before installation (2008–2024)", !/2008, 2009/.test(await p.locator("main").innerText()));
    const hl = await p.locator("main svg path[fill=none][stroke-width='2']").count();
    check("city(no data): map highlights the municipality (geometry exists)", hl > 0, `highlight elements: ${hl}`);
    check("clicks: no page errors", !p.errors.length, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  },

  async notfound() {
    const p = await newPage();
    for (const u of ["/xx", "/sp/nao-existe", "/regiao/foo", "/SP", "/Sp/santo-andre", "/sp/santo-andre/extra", "/dados/csv/xx", "/regiao/Sul"]) {
      const r = await go(p, u);
      const h1 = await p.locator("h1").first().innerText().catch(() => "");
      check(`404: ${u} -> HTTP 404`, r.status() === 404, `status ${r.status()}, h1="${h1}", title="${await p.title()}"`);
    }
    await go(p, "/xx");
    await p.getByRole("button", { name: /Buscar município, estado ou região/ }).last().click();
    await p.waitForTimeout(300);
    check("404: search CTA opens palette", await p.getByRole("dialog").isVisible());
    await p.context().close();
  },
};

for (const [name, fn] of Object.entries(tests)) {
  if (only.length && !only.includes(name)) continue;
  console.log(`\n== ${name}`);
  try {
    await fn();
  } catch (e) {
    check(`${name}: threw`, false, e.message.split("\n")[0] + " @" + (e.stack.match(/interact.mjs:(\d+)/) ?? [])[1]);
  }
}
await browser.close();
const f = res.filter((r) => !r.ok);
console.log(`\n${res.length - f.length}/${res.length} checks passed`);
for (const r of f) console.log("FAIL  " + r.name + (r.detail ? "  — " + r.detail : ""));
console.log(f.length ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(f.length ? 1 : 0);
