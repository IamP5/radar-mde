#!/usr/bin/env node
/**
 * Holds one Chromium profile open so browser commands share a page.
 * Started by cli.mjs. Speaks one JSON line per connection on a unix socket.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { budget, clickSettle, expectsNavigation } from "./lib/click-settle.mjs";
import { CliError } from "./lib/errors.mjs";
import { roleOptions, withinOptions } from "./lib/locate.mjs";
import { installOutboundGuard } from "./lib/outbound.mjs";
import { readJson, runPaths } from "./lib/paths.mjs";
import { alive } from "./lib/proc.mjs";
import { DEFAULT_VIEWPORT } from "./lib/viewport.mjs";

const runId = process.argv[2];
const headed = process.argv.includes("--headed");
if (!runId) {
  process.stderr.write("browser-daemon requires a run id\n");
  process.exit(1);
}

const paths = runPaths(runId);
const state = readJson(paths.stateFile);
const origin = state.url;

function failStart(error, hint) {
  fs.writeFileSync(paths.daemonError, JSON.stringify({ error, hint }));
  process.exit(1);
}

function acquireLock() {
  try {
    const fd = fs.openSync(paths.lockFile, "wx");
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (!err || err.code !== "EEXIST") throw err;
    const old = Number(fs.readFileSync(paths.lockFile, "utf8"));
    if (alive(old)) return false;
    fs.unlinkSync(paths.lockFile);
    return acquireLock();
  }
}

if (!acquireLock()) process.exit(0);

/** @type {import('playwright').BrowserContext | null} */
let context = null;
/** @type {import('playwright').Page | null} */
let page = null;
/** Everything that tried to leave the site, oldest first. Lost when the daemon restarts. */
/** @type {Record<string, unknown>[]} */
const outbound = [];

function rememberUrl() {
  if (page && !page.isClosed()) fs.writeFileSync(paths.pageUrlFile, page.url());
}

async function ensurePage() {
  if (page && !page.isClosed()) return page;
  page = context.pages().find((p) => !p.isClosed()) || (await context.newPage());
  page.setDefaultTimeout(15_000);
  return page;
}

async function gotoPath(target, timeout) {
  const current = await ensurePage();
  const b = budget(timeout);
  const url = target.startsWith("http") ? target : new URL(target.startsWith("/") ? target : `/${target}`, origin).toString();
  const response = await current.goto(url, { waitUntil: "domcontentloaded", timeout: b.left() });
  await current.locator("main#conteudo, [role='application']").first().waitFor({ state: "attached", timeout: b.left() });
  rememberUrl();
  return { url: current.url(), title: await current.title(), status: response ? response.status() : null };
}

async function onOrigin(timeout) {
  const current = await ensurePage();
  if (!current.url().startsWith(origin)) await gotoPath("/", timeout);
  return current;
}

/** @param {import('playwright').Page | import('playwright').Locator} scope @param {Record<string, unknown>} msg */
function targetLocator(scope, msg) {
  const placeholder = typeof msg.placeholder === "string" ? msg.placeholder : "";
  const label = typeof msg.label === "string" ? msg.label : "";
  const role = typeof msg.role === "string" ? msg.role : "";
  let loc = null;
  if (placeholder) loc = scope.getByPlaceholder(placeholder, { exact: Boolean(msg.exact) });
  else if (label) loc = scope.getByLabel(label, { exact: Boolean(msg.exact) });
  else if (role) loc = scope.getByRole(/** @type {any} */ (role), roleOptions(msg));
  else if (typeof msg.selector === "string" && msg.selector) loc = scope.locator(msg.selector);
  if (loc && role && (placeholder || label)) loc = loc.and(scope.getByRole(/** @type {any} */ (role), { includeHidden: Boolean(msg.includeHidden) }));
  if (!loc) {
    throw new CliError(
      "No target was given.",
      "Pass --role and --name (for example --role button --name Salvar), or --placeholder, --label, or --selector. Run control-radar-mde browser --help.",
    );
  }
  if (!msg.includeHidden) loc = loc.filter({ visible: true });
  return loc;
}

/** @param {import('playwright').Page} current @param {Record<string, unknown>} msg */
async function scoped(current, msg) {
  if (typeof msg.withinRole !== "string" || !msg.withinRole) return current;
  let visible = current.getByRole(/** @type {any} */ (msg.withinRole), withinOptions(msg));
  if (!msg.includeHidden) visible = visible.filter({ visible: true });
  const count = await visible.count();
  if (count !== 1) {
    const described = await describe(visible);
    const onMap = new URL(current.url()).pathname === "/mapa";
    throw new CliError(
      `Expected one visible ${msg.withinRole} named ${JSON.stringify(msg.withinName || msg.withinNameRegex || "")}, found ${count}.`,
      onMap && count === 0
        ? "The map (/mapa) hides the site header, so there is no navigation named Principal here. Run browser open /explorar (or another page with the header) first."
        : `Scope with --within-role and a tighter --within-name, or add --within-exact. Samples: ${formatSamples(described)}. The header nav is navigation named Principal; below md width the second bar is the visible one (browser viewport --preset phone).`,
      1,
      { samples: described.samples },
    );
  }
  return visible;
}

/** @param {import('playwright').Locator} locator */
async function describe(locator) {
  const count = await locator.count();
  const samples = [];
  for (let i = 0; i < Math.min(count, 8); i++) {
    const info = await locator.nth(i).evaluate((node) => {
      const aria = node.getAttribute("aria-label") || "";
      const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
      return {
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute("role"),
        text: (aria || text).slice(0, 180),
      };
    }).catch(() => ({ text: "(detached)" }));
    samples.push(info);
  }
  return { count, samples };
}

/** @param {{ samples?: { text?: string }[] }} described */
function formatSamples(described) {
  const names = (described.samples || []).map((s) => s.text).filter(Boolean);
  return names.length ? names.join(" | ") : "(no accessible names)";
}

/** @param {import('playwright').Locator} locator @param {Record<string, unknown>} msg @param {boolean} allowMany */
async function resolveOne(locator, msg, allowMany) {
  const count = await locator.count();
  if (allowMany) return { locator, count, ...(await describe(locator)) };
  if (count === 1) return { locator };
  const described = await describe(locator);
  const role = msg.role || msg.placeholder || msg.label || "element";
  throw new CliError(
    count === 0
      ? `No visible ${role} matched.`
      : `${count} visible ${role} elements matched; refusing to pick one.`,
    count === 0
      ? `Run control-radar-mde browser find with the same --role and --name to see hidden matches, or loosen --name. Phone and desktop navigation are both in the DOM; at 1440×900 only the desktop bar is visible.`
      : `Samples: ${formatSamples(described)}. Pass a longer --name, --name-regex, or --within-role navigation --within-name Principal. Do not click the first match.`,
    1,
    { samples: described.samples, count },
  );
}

/** @param {Record<string, unknown>} msg */
async function handle(msg) {
  const timeout = Number(msg.timeout) > 0 ? Number(msg.timeout) : 15_000;
  const b = budget(timeout);
  const op = String(msg.op || "");
  if (op === "ping") return { ok: true, url: page && !page.isClosed() ? page.url() : null };

  if (op === "open") return { ok: true, ...(await gotoPath(String(msg.path || "/"), timeout)) };

  if (op === "url") {
    const current = await ensurePage();
    return { ok: true, url: current.url(), title: await current.title() };
  }

  if (op === "viewport") {
    const current = await ensurePage();
    if (msg.size && typeof msg.size === "object") {
      const size = /** @type {{ preset: string | null, width: number, height: number }} */ (msg.size);
      await current.setViewportSize({ width: size.width, height: size.height });
      fs.writeFileSync(paths.viewportFile, JSON.stringify(size));
      await current.waitForTimeout(150);
    }
    const now = current.viewportSize();
    const saved = fs.existsSync(paths.viewportFile) ? readJson(paths.viewportFile) : DEFAULT_VIEWPORT;
    const inner = await current.evaluate(() => ({ innerWidth: window.innerWidth, innerHeight: window.innerHeight })).catch(() => null);
    return { ok: true, preset: saved.width === now?.width && saved.height === now?.height ? saved.preset : null, width: now?.width, height: now?.height, ...inner, url: current.url() };
  }

  if (op === "outbound") {
    const since = Number(msg.since) || 0;
    const entries = outbound.slice(since);
    const total = outbound.length;
    if (msg.clear) outbound.length = 0;
    return { ok: true, count: entries.length, total, entries, cleared: Boolean(msg.clear) };
  }

  if (op === "press") {
    const current = await ensurePage();
    if (!current.url().startsWith(origin)) {
      throw new CliError(
        "The browser is not on Radar MDE yet, so a key would go nowhere.",
        "Run control-radar-mde browser open / first, then browser press --key Control+k.",
      );
    }
    await current.keyboard.press(String(msg.key || ""), { delay: 10 });
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  if (op === "storage-get" || op === "storage-set") {
    const current = await onOrigin(timeout);
    const key = String(msg.key || "");
    if (!key) {
      throw new CliError("storage requires --key.", "Pass --key radar-mde:watch for the saved-municipality list.");
    }
    const from = await current.evaluate((k) => localStorage.getItem(k), key);
    if (op === "storage-get" || msg.dryRun) {
      return { ok: true, key, value: from, from, to: op === "storage-set" ? msg.value : from, wrote: false, dryRun: Boolean(msg.dryRun) };
    }
    await current.evaluate(({ k, v }) => localStorage.setItem(k, String(v)), { k: key, v: msg.value });
    await current.reload({ waitUntil: "domcontentloaded", timeout: b.left() });
    await current.locator("main#conteudo, [role='application']").first().waitFor({ state: "attached", timeout: b.left() });
    const to = await current.evaluate((k) => localStorage.getItem(k), key);
    rememberUrl();
    return { ok: true, key, from, to, value: to, wrote: true, dryRun: false };
  }

  if (op === "clipboard") {
    const current = await onOrigin(timeout);
    const text = await current.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (err) {
        return `ERROR ${err instanceof Error ? err.message : String(err)}`;
      }
    });
    if (String(text).startsWith("ERROR ")) {
      throw new CliError(
        `Could not read the clipboard (${text}).`,
        "Click Copiar link first (browser click --role button --name \"Copiar link\"), then retry browser clipboard. The page must be the active document.",
      );
    }
    return { ok: true, text };
  }

  const current = await ensurePage();
  if (!current.url().startsWith(origin)) {
    throw new CliError(
      "The browser has no Radar MDE page open.",
      "Run control-radar-mde browser open <path> before click, fill, wait, find, text, snapshot, or screenshot.",
    );
  }

  if (op === "wait" && typeof msg.urlIncludes === "string" && msg.urlIncludes) {
    if (!current.url().includes(msg.urlIncludes)) {
      await current.waitForURL((url) => url.toString().includes(String(msg.urlIncludes)), { timeout: b.left() });
    }
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  if (op === "wait" && (msg.text || msg.textRegex)) {
    const loc = typeof msg.textRegex === "string"
      ? current.getByText(new RegExp(msg.textRegex, "i"))
      : current.getByText(String(msg.text), { exact: Boolean(msg.exact) });
    await loc.filter({ visible: true }).first().waitFor({ state: "visible", timeout: b.left() });
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  const root = await scoped(current, msg);
  const needsTarget = ["click", "fill", "wait", "find", "text", "snapshot"].includes(op);
  const locator = needsTarget && (msg.role || msg.placeholder || msg.label || msg.selector) ? targetLocator(root, msg) : null;

  if (op === "find") {
    if (!locator) {
      throw new CliError("find needs a target.", "Pass --role and --name. find lists matches and does not click.");
    }
    const found = await resolveOne(locator, msg, true);
    return { ok: true, count: found.count, samples: found.samples, url: current.url() };
  }

  if (op === "wait") {
    if (!locator) {
      throw new CliError(
        "wait needs a condition.",
        "Pass --role and --name, --text, --text-regex, or --url-includes. Example: browser wait --role dialog --name \"Buscar município, estado ou região\".",
      );
    }
    await locator.first().waitFor({ state: msg.includeHidden ? "attached" : "visible", timeout: b.left() });
    const resolved = await resolveOne(locator, msg, false);
    rememberUrl();
    return { ok: true, url: current.url(), ...(await describe(resolved.locator)) };
  }

  if (op === "text") {
    if (!locator) throw new CliError("text needs a target.", "Pass --role and --name of the element whose text you want.");
    const resolved = await resolveOne(locator, msg, false);
    const read = await resolved.locator.evaluate((el) => {
      const tag = el.tagName.toLowerCase();
      const control = tag === "textarea" || tag === "select" || (tag === "input" && !["button", "submit", "reset", "image"].includes(/** @type {HTMLInputElement} */ (el).type));
      if (control) return { kind: "value", tag, value: /** @type {HTMLInputElement} */ (el).value };
      return { kind: "text", tag, value: null };
    });
    if (read.kind === "value") {
      return { ok: true, text: read.value, value: read.value, source: "value", tag: read.tag, url: current.url() };
    }
    const text = (await resolved.locator.innerText({ timeout: b.left() })).replace(/\s+/g, " ").trim();
    return { ok: true, text, source: "innerText", tag: read.tag, url: current.url() };
  }

  if (op === "fill") {
    if (!locator) throw new CliError("fill needs a target.", "Pass --role searchbox --name \"Buscar município pelo nome\" --value \"Santo André\", or --placeholder.");
    const resolved = await resolveOne(locator, msg, false);
    await resolved.locator.fill(String(msg.value ?? ""), { timeout: b.left() });
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  if (op === "click") {
    if (!locator) throw new CliError("click needs a target.", "Pass --role and --name. Example: browser click --role button --name Salvar.");
    const started = Date.now();
    const resolved = await resolveOne(locator, msg, false);
    const outboundBefore = outbound.length;
    if (typeof msg.download === "string" && msg.download) {
      const [download] = await Promise.all([
        current.waitForEvent("download", { timeout: b.left() }),
        resolved.locator.click({ timeout: b.left(), force: Boolean(msg.force) }),
      ]);
      fs.mkdirSync(path.dirname(msg.download), { recursive: true });
      await download.saveAs(msg.download);
      const bytes = fs.statSync(msg.download).size;
      rememberUrl();
      return { ok: true, url: current.url(), elapsedMs: Date.now() - started, download: { path: msg.download, suggestedFilename: download.suggestedFilename(), bytes } };
    }
    const before = current.url();
    const node = await resolved.locator
      .evaluate((el) => {
        const a = el.closest("a[href]");
        return {
          href: a ? a.getAttribute("href") : null,
          target: a ? a.getAttribute("target") : null,
          download: a ? a.hasAttribute("download") : false,
          role: el.getAttribute("role"),
          inDialog: Boolean(el.closest("[role=dialog]")),
        };
      }, null, { timeout: b.left() })
      .catch(() => ({ href: null, target: null, download: false, role: null, inDialog: false }));
    const expectNav = msg.expectNav === true || expectsNavigation({ ...node, current: before });
    await resolved.locator.click({ timeout: b.left(), force: Boolean(msg.force) });
    const clickedAt = Date.now();
    while (true) {
      const urlChanged = current.url() !== before;
      if (clickSettle({ expectNav, urlChanged, elapsedMs: Date.now() - clickedAt, budgetMs: b.deadline - clickedAt }) === "done") break;
      await current.waitForTimeout(50);
    }
    const navigated = current.url() !== before;
    if (expectNav && !navigated) {
      rememberUrl();
      throw new CliError(
        `Clicked, but the URL did not change within ${timeout}ms (still ${before}).`,
        `The click already happened; do not repeat it. The destination may still be compiling: run browser wait --url-includes <path> --timeout 90000, then continue. Pass a larger --timeout to the click next time.`,
        1,
        { clicked: true, expectNav, url: current.url(), elapsedMs: Date.now() - started },
      );
    }
    if (expectNav && navigated) {
      await current.waitForLoadState("domcontentloaded", { timeout: b.left() }).catch(() => {});
      await current.waitForFunction(() => document.readyState === "complete", null, { timeout: b.left() }).catch(() => {});
      await current.locator("main#conteudo, [role='application']").first().waitFor({ state: "attached", timeout: b.left() }).catch(() => {});
    }
    rememberUrl();
    const left = outbound.slice(outboundBefore);
    return { ok: true, url: current.url(), navigated, expectNav, elapsedMs: Date.now() - started, ...(left.length ? { outbound: left } : {}) };
  }

  if (op === "snapshot") {
    const target = locator ? (await resolveOne(locator, msg, false)).locator : current.locator("body");
    const aria = await target.ariaSnapshot({ timeout: b.left() });
    fs.mkdirSync(path.dirname(String(msg.path)), { recursive: true });
    fs.writeFileSync(String(msg.path), aria.endsWith("\n") ? aria : `${aria}\n`);
    return { ok: true, path: msg.path, bytes: fs.statSync(String(msg.path)).size, url: current.url() };
  }

  if (op === "screenshot") {
    fs.mkdirSync(path.dirname(String(msg.path)), { recursive: true });
    await current.screenshot({ path: String(msg.path), fullPage: Boolean(msg.fullPage), timeout: b.left() });
    return { ok: true, path: msg.path, bytes: fs.statSync(String(msg.path)).size, url: current.url() };
  }

  throw new CliError(
    `Unknown browser operation ${JSON.stringify(op)}.`,
    "Run control-radar-mde browser --help for open, click, fill, press, wait, find, text, snapshot, screenshot, url, viewport, outbound, clipboard, and storage.",
  );
}

/** @param {Record<string, unknown>} entry */
function recordOutbound(entry) {
  outbound.push(entry);
}

/** @param {import('playwright').BrowserContext} ctx */
async function guardOutbound(ctx) {
  await ctx.exposeBinding("__radarRecordOutbound", (_source, entry) => recordOutbound(entry));
  await ctx.addInitScript({ content: `(${installOutboundGuard.toString()})(${JSON.stringify(origin)}, window);` });
  // A navigation to another origin that the page guard did not catch (location assignment, a form).
  await ctx.route(
    (url) => (url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin,
    async (route) => {
      const req = route.request();
      let top = false;
      try {
        top = req.isNavigationRequest() && req.frame().parentFrame() === null;
      } catch {
        top = false;
      }
      if (!top) return route.continue();
      recordOutbound({ kind: "navigation", url: req.url(), at: new Date().toISOString(), from: page && !page.isClosed() ? page.url() : null });
      return route.abort("blockedbyclient");
    },
  );
  ctx.on("page", (popup) => {
    if (popup === page) return;
    void popup
      .waitForLoadState("domcontentloaded", { timeout: 5000 })
      .catch(() => {})
      .then(() => {
        recordOutbound({ kind: "popup", url: popup.url(), at: new Date().toISOString(), from: page && !page.isClosed() ? page.url() : null });
        return popup.close();
      })
      .catch(() => {});
  });
}

const args = ["--disable-dev-shm-usage"];
if (typeof process.getuid === "function" && process.getuid() === 0) args.push("--no-sandbox");

try {
  fs.mkdirSync(paths.profileDir, { recursive: true });
  if (fs.existsSync(paths.socketPath)) fs.unlinkSync(paths.socketPath);
  const viewport = fs.existsSync(paths.viewportFile) ? readJson(paths.viewportFile) : DEFAULT_VIEWPORT;
  context = await chromium.launchPersistentContext(paths.profileDir, {
    headless: !headed,
    viewport: { width: viewport.width, height: viewport.height },
    locale: "pt-BR",
    colorScheme: "light",
    args,
  });
  context.setDefaultTimeout(15_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin }).catch(() => {});
  page = context.pages()[0] || (await context.newPage());
  await guardOutbound(context);
  if (fs.existsSync(paths.pageUrlFile)) {
    const resume = fs.readFileSync(paths.pageUrlFile, "utf8").trim();
    if (resume.startsWith(origin)) {
      await gotoPath(resume, 30_000).catch(() => {});
    }
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const missing = /Executable doesn't exist|browserType.launch/i.test(message);
  failStart(
    message,
    missing
      ? "Chromium is not installed for this user. From the repo root run npx --prefix scripts/control playwright install chromium, then retry the browser command. If Chromium then fails on missing system libraries, run bash scripts/cloud-agent-install.sh with no verification run live."
      : "Read scripts/control state browser.log for this run. Fix the browser launch error, then retry. Do not start a second Chromium against the same profile directory.",
  );
}

const server = net.createServer((socket) => {
  let buf = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buf += chunk;
    if (!buf.includes("\n")) return;
    const line = buf.slice(0, buf.indexOf("\n"));
    buf = "";
    Promise.resolve()
      .then(() => handle(JSON.parse(line)))
      .catch((err) => {
        const payload = err instanceof CliError
          ? { ok: false, error: err.message, hint: err.hint, ...err.extra }
          : {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              hint: "The page may still be compiling. Retry the same browser command. If it names a selector, run browser find with the same --role and --name and use one of the samples.",
            };
        return payload;
      })
      .then((payload) => {
        socket.end(`${JSON.stringify(payload)}\n`);
      });
  });
});

server.listen(paths.socketPath, () => {
  fs.writeFileSync(paths.daemonFile, JSON.stringify({ pid: process.pid, socketPath: paths.socketPath, headed }, null, 2));
  fs.writeFileSync(paths.readyFile, String(process.pid));
});

async function shutdown() {
  server.close();
  if (context) await context.close().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
