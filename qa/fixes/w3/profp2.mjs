import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.goto("http://localhost:3297/", { waitUntil: "networkidle" });
if (process.argv[2] === "mun") { await page.getByRole("radio", { name: "Municípios" }).click(); await page.waitForFunction(() => document.querySelectorAll("svg path[data-id]").length > 5000); }
await page.addStyleTag({ content: process.env.CSS ?? "" }); await page.waitForTimeout(1000);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Profiler.enable"); await cdp.send("Profiler.start");
for (let i = 0; i < 6; i++) { await page.getByRole("button", { name: "Ano anterior" }).click(); await page.waitForTimeout(500); }
const { profile } = await cdp.send("Profiler.stop");
const self = new Map(); const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop().slice(0, 30)}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000); });
[...self].sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log(v.toFixed(0).padStart(6), k));
await browser.close();
