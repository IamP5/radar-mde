// Round 2 extras. BASE=http://localhost:3299 node reports/performance/palette-and-lh.mjs [palette|lh-acompanhar]
// palette: time from Ctrl+K (cold: dialog chunk not loaded) to dialog + input visible, 4x CPU + Slow 4G; then typing latency.
// lh-acompanhar: launches Chromium with a remote-debugging port, seeds 3 watched cities, runs Lighthouse with --disable-storage-reset.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
const BASE = process.env.BASE ?? "http://localhost:3299";
const OUT = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2] ?? "palette";

if (mode === "palette") {
  const b = await chromium.launch();
  for (const throttle of [true, false]) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await p.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: "longtask" }); });
    await p.goto(BASE + "/sobre", { waitUntil: "networkidle" });
    if (throttle) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.4744 * 1024 * 1024) / 8, uploadThroughput: (0.675 * 1024 * 1024) / 8 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    const loaded = await p.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => n.includes("/_next/static/chunks/")).length);
    await p.evaluate(() => { window.__lt = []; });
    const t0 = Date.now();
    await p.keyboard.press("Control+k");
    await p.getByRole("dialog").locator("input").first().waitFor({ state: "visible", timeout: 60000 });
    const openMs = Date.now() - t0;
    const chunks = await p.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => n.includes("/_next/static/chunks/")).length);
    const lt1 = await p.evaluate(() => window.__lt.slice());
    await p.evaluate(() => { window.__lt = []; });
    const t1 = Date.now();
    await p.keyboard.type("santo andre", { delay: 60 });
    await p.getByRole("option").first().waitFor({ timeout: 60000 }).catch(() => {});
    const firstResultMs = Date.now() - t1;
    const lt2 = await p.evaluate(() => window.__lt.slice());
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    const t2 = Date.now();
    await p.keyboard.press("Control+k");
    await p.getByRole("dialog").locator("input").first().waitFor({ state: "visible" });
    console.log(JSON.stringify({ throttle, openMsCold: openMs, newChunks: chunks - loaded, longtasksOpen: lt1, typeToFirstResultMs: firstResultMs, longtasksTyping: lt2, reopenMs: Date.now() - t2 }));
    await ctx.close();
  }
  await b.close();
}

if (mode === "lh-acompanhar") {
  // Launch Chrome ourselves (CHROME_PATH), seed localStorage over CDP, disconnect, then point Lighthouse at the same browser.
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs");
  const port = 9334;
  const dir = fs.mkdtempSync(path.join(OUT, ".lh-"));
  const chrome = spawn(process.env.CHROME_PATH, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--headless=new", "--no-first-run", "about:blank"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 2500));
  const br = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const p = br.contexts()[0].pages()[0] ?? (await br.contexts()[0].newPage());
  await p.goto(BASE + "/sobre");
  await p.evaluate(() => localStorage.setItem("radar-mde:watch", JSON.stringify(["sp/santo-andre", "mg/belo-horizonte", "ba/salvador"])));
  await br.close().catch(() => {});
  try {
    execFileSync("npx", ["-y", "lighthouse@12", BASE + "/acompanhar", `--port=${port}`, "--disable-storage-reset", "--quiet", "--only-categories=performance,seo,best-practices", "--output=json", `--output-path=${path.join(OUT, "lh_acompanhar.json")}`], { stdio: "inherit", timeout: 240000 });
  } finally {
    chrome.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
