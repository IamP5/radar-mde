#!/usr/bin/env node
/**
 * Holds one Chromium profile open so browser commands share a page.
 * Started by cli.mjs. Speaks one JSON line per connection on a unix socket.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { clickSettle } from "./lib/click-settle.mjs";
import { CliError } from "./lib/errors.mjs";
import { readJson, runPaths } from "./lib/paths.mjs";
import { alive } from "./lib/proc.mjs";

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
  const url = target.startsWith("http") ? target : new URL(target.startsWith("/") ? target : `/${target}`, origin).toString();
  const response = await current.goto(url, { waitUntil: "domcontentloaded", timeout });
  await current.locator("main#conteudo, [role='application']").first().waitFor({ state: "attached", timeout });
  rememberUrl();
  return { url: current.url(), title: await current.title(), status: response ? response.status() : null };
}

async function onOrigin(timeout) {
  const current = await ensurePage();
  if (!current.url().startsWith(origin)) await gotoPath("/", timeout);
  return current;
}

/** @param {import('playwright').Page | import('playwright').Locator} scope @param {Record<string, unknown>} msg */
function nameOptions(msg) {
  /** @type {Record<string, unknown>} */
  const opts = {};
  if (typeof msg.nameRegex === "string" && msg.nameRegex) opts.name = new RegExp(msg.nameRegex, "i");
  else if (typeof msg.name === "string" && msg.name) opts.name = msg.name;
  if (msg.exact) opts.exact = true;
  if (msg.level) opts.level = Number(msg.level);
  return opts;
}

/** @param {import('playwright').Page | import('playwright').Locator} scope @param {Record<string, unknown>} msg */
function targetLocator(scope, msg) {
  const placeholder = typeof msg.placeholder === "string" ? msg.placeholder : "";
  const label = typeof msg.label === "string" ? msg.label : "";
  const role = typeof msg.role === "string" ? msg.role : "";
  let loc = null;
  if (placeholder) loc = scope.getByPlaceholder(placeholder, { exact: Boolean(msg.exact) });
  else if (label) loc = scope.getByLabel(label, { exact: Boolean(msg.exact) });
  else if (role) loc = scope.getByRole(/** @type {any} */ (role), nameOptions(msg));
  else if (typeof msg.selector === "string" && msg.selector) loc = scope.locator(msg.selector);
  if (loc && role && (placeholder || label)) loc = loc.and(scope.getByRole(/** @type {any} */ (role)));
  if (!loc) {
    throw new CliError(
      "No target was given.",
      "Pass --role and --name (for example --role button --name Salvar), or --placeholder, or --label. Run control-radar-mde browser --help.",
    );
  }
  if (!msg.includeHidden) loc = loc.filter({ visible: true });
  return loc;
}

/** @param {import('playwright').Page} current @param {Record<string, unknown>} msg */
async function scoped(current, msg) {
  if (typeof msg.withinRole !== "string" || !msg.withinRole) return current;
  let visible = current.getByRole(/** @type {any} */ (msg.withinRole), {
    name: typeof msg.withinNameRegex === "string" && msg.withinNameRegex ? new RegExp(msg.withinNameRegex, "i") : msg.withinName || undefined,
    exact: Boolean(msg.withinExact),
  });
  if (!msg.includeHidden) visible = visible.filter({ visible: true });
  const count = await visible.count();
  if (count !== 1) {
    const described = await describe(visible);
    throw new CliError(
      `Expected one visible ${msg.withinRole} named ${JSON.stringify(msg.withinName || "")}, found ${count}.`,
      `Scope with --within-role and a tighter --within-name. Samples: ${formatSamples(described)}. The header nav is navigation named Principal; the phone copy is display:none at 1440px and is skipped unless you pass --include-hidden.`,
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
  const op = String(msg.op || "");
  if (op === "ping") return { ok: true, url: page && !page.isClosed() ? page.url() : null };

  if (op === "open") return { ok: true, ...(await gotoPath(String(msg.path || "/"), timeout)) };

  if (op === "url") {
    const current = await ensurePage();
    return { ok: true, url: current.url(), title: await current.title() };
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
    await current.reload({ waitUntil: "domcontentloaded", timeout });
    await current.locator("main#conteudo, [role='application']").first().waitFor({ state: "attached", timeout });
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
      await current.waitForURL((url) => url.toString().includes(String(msg.urlIncludes)), { timeout });
    }
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  if (op === "wait" && (msg.text || msg.textRegex)) {
    const loc = typeof msg.textRegex === "string"
      ? current.getByText(new RegExp(msg.textRegex, "i"))
      : current.getByText(String(msg.text), { exact: Boolean(msg.exact) });
    await loc.filter({ visible: true }).first().waitFor({ state: "visible", timeout });
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
    await locator.first().waitFor({ state: "visible", timeout });
    const resolved = await resolveOne(locator, msg, false);
    rememberUrl();
    return { ok: true, url: current.url(), ...(await describe(resolved.locator)) };
  }

  if (op === "text") {
    if (!locator) throw new CliError("text needs a target.", "Pass --role and --name of the element whose text you want.");
    const resolved = await resolveOne(locator, msg, false);
    const text = (await resolved.locator.innerText()).replace(/\s+/g, " ").trim();
    return { ok: true, text, url: current.url() };
  }

  if (op === "fill") {
    if (!locator) throw new CliError("fill needs a target.", "Pass --role searchbox --name \"Buscar município pelo nome\" --value \"Santo André\", or --placeholder.");
    const resolved = await resolveOne(locator, msg, false);
    await resolved.locator.fill(String(msg.value ?? ""), { timeout });
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  if (op === "click") {
    if (!locator) throw new CliError("click needs a target.", "Pass --role and --name. Example: browser click --role button --name Salvar.");
    const resolved = await resolveOne(locator, msg, false);
    if (typeof msg.download === "string" && msg.download) {
      const [download] = await Promise.all([
        current.waitForEvent("download", { timeout }),
        resolved.locator.click({ timeout, force: Boolean(msg.force) }),
      ]);
      fs.mkdirSync(path.dirname(msg.download), { recursive: true });
      await download.saveAs(msg.download);
      const bytes = fs.statSync(msg.download).size;
      rememberUrl();
      return { ok: true, url: current.url(), download: { path: msg.download, suggestedFilename: download.suggestedFilename(), bytes } };
    }
    const before = current.url();
    const href = await resolved.locator
      .evaluate((el) => {
        const node = el.closest("a");
        return node ? node.getAttribute("href") : "";
      })
      .catch(() => "");
    await resolved.locator.click({ timeout, force: Boolean(msg.force) });
    const started = Date.now();
    while (true) {
      const elapsedMs = Date.now() - started;
      const urlChanged = current.url() !== before;
      const stillThere = urlChanged ? false : (await resolved.locator.count().catch(() => 0)) > 0;
      if (clickSettle({ href, urlChanged, stillThere, elapsedMs, timeoutMs: timeout }) === "done") break;
      await current.waitForTimeout(50);
    }
    if (href && current.url() !== before) {
      await current.locator("main#conteudo, [role='application']").first().waitFor({ state: "attached", timeout }).catch(() => {});
    }
    rememberUrl();
    return { ok: true, url: current.url() };
  }

  if (op === "snapshot") {
    const target = locator ? (await resolveOne(locator, msg, false)).locator : current.locator("body");
    const aria = await target.ariaSnapshot({ timeout });
    fs.mkdirSync(path.dirname(String(msg.path)), { recursive: true });
    fs.writeFileSync(String(msg.path), aria.endsWith("\n") ? aria : `${aria}\n`);
    return { ok: true, path: msg.path, bytes: fs.statSync(String(msg.path)).size, url: current.url() };
  }

  if (op === "screenshot") {
    fs.mkdirSync(path.dirname(String(msg.path)), { recursive: true });
    await current.screenshot({ path: String(msg.path), fullPage: Boolean(msg.fullPage), timeout });
    return { ok: true, path: msg.path, bytes: fs.statSync(String(msg.path)).size, url: current.url() };
  }

  throw new CliError(
    `Unknown browser operation ${JSON.stringify(op)}.`,
    "Run control-radar-mde browser --help for open, click, fill, press, wait, find, text, snapshot, screenshot, url, clipboard, and storage.",
  );
}

const args = ["--disable-dev-shm-usage"];
if (typeof process.getuid === "function" && process.getuid() === 0) args.push("--no-sandbox");

try {
  fs.mkdirSync(paths.profileDir, { recursive: true });
  if (fs.existsSync(paths.socketPath)) fs.unlinkSync(paths.socketPath);
  context = await chromium.launchPersistentContext(paths.profileDir, {
    headless: !headed,
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    colorScheme: "light",
    args,
  });
  context.setDefaultTimeout(15_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin }).catch(() => {});
  page = context.pages()[0] || (await context.newPage());
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
      ? "Chromium is not installed for this user. From the repo root run bash scripts/cloud-agent-install.sh, then retry the browser command."
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
