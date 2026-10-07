import { chromium } from "playwright";
const base = "http://localhost:3210";
const b = await chromium.launch(); const p = await b.newPage();
for (const path of process.argv.slice(2)) {
  await p.goto(base + path, { waitUntil: "networkidle" });
  console.log("=====", path, "\nH1:", await p.locator("h1").innerText().then(s=>s.replace(/\n/g," ")));
  console.log("VERDICT:", await p.locator("h1 ~ div p").first().innerText());
  const tabs = p.locator('[role=tab]');
  for (let i = 0; i < await tabs.count(); i++) {
    await tabs.nth(i).click(); await p.waitForTimeout(300);
    console.log("--- TAB", await tabs.nth(i).innerText().then(s=>s.replace(/\n/g," ")));
    console.log(await p.locator('[role=tabpanel] textarea:visible').first().inputValue());
  }
}
await b.close();
