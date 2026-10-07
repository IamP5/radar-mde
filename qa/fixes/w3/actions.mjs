import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
for (const path of ["/", "/sp"]) {
  await page.goto("http://localhost:3210" + path, { waitUntil: "networkidle" });
  const triggers = page.locator('button[aria-label^="Exportar:"]');
  const n = await triggers.count();
  for (let i = 0; i < n; i++) {
    const t = triggers.nth(i);
    const label = await t.getAttribute("aria-label");
    for (const item of [/PNG/, /CSV$|Dados em CSV/]) {
      await t.click();
      try {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.getByRole("menuitem", { name: item }).first().click()]);
        const fs = await import("node:fs/promises");
        const size = (await fs.stat(await dl.path())).size;
        console.log("PASS", path, label.slice(10, 60), dl.suggestedFilename(), size);
        if (/png$/.test(dl.suggestedFilename())) await fs.copyFile(await dl.path(), `fixes/w3/shots/export-${path.replace(/\W/g, "") || "home"}-${i}.png`);
      } catch (e) { console.log("FAIL", path, label, item, e.message.slice(0, 100)); await page.keyboard.press("Escape"); }
    }
  }
}
console.log(errs.length ? errs.join("\n") : "no errors");
await browser.close();
