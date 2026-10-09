import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../lib/args.mjs";
import { commandNames } from "../lib/help.mjs";
import { isInside, repoRoot, resolveEvidencePath, runPaths } from "../lib/paths.mjs";
import { alive } from "../lib/proc.mjs";
import { budget, clickSettle, expectsNavigation } from "../lib/click-settle.mjs";
import { roleOptions, withinOptions } from "../lib/locate.mjs";
import { installOutboundGuard } from "../lib/outbound.mjs";
import { resolveViewport } from "../lib/viewport.mjs";
import { nextWatch, parseWatch } from "../lib/watch.mjs";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli.mjs");

function run(args, env = {}) {
  const res = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    json = null;
  }
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, json };
}

test("parseArgs keeps boolean flags and the value after them", () => {
  const parsed = parseArgs(["browser", "click", "--role", "button", "--name", "Salvar", "--dry-run", "--timeout", "1000"]);
  assert.deepEqual(parsed.positionals, ["browser", "click"]);
  assert.equal(parsed.flags.role, "button");
  assert.equal(parsed.flags.name, "Salvar");
  assert.equal(parsed.flags["dry-run"], true);
  assert.equal(parsed.flags.timeout, "1000");
});

test("help names every command and the app", () => {
  const res = run(["--help"]);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Radar MDE/);
  for (const name of commandNames) assert.match(res.stdout, new RegExp(`\\b${name}\\b`));
  assert.match(run(["browser", "--help"]).stdout, /--name-regex/);
  assert.match(run(["browser", "--help"]).stdout, /--url-includes/);
  assert.match(run(["cleanup", "--help"]).stdout, /--dry-run/);
});

test("browser help documents selector, within-exact, viewport, outbound, and fullscreen", () => {
  const help = run(["browser", "--help"]).stdout;
  for (const flag of ["--selector", "--within-exact", "--within-name-regex", "--expect-nav", "viewport", "outbound"]) {
    assert.match(help, new RegExp(flag.replace(/-/g, "\\-")), flag);
  }
  assert.match(help, /One budget for the whole command/);
  assert.match(help, /Sair da tela cheia/);
  assert.match(run(["browser", "viewport", "--help"]).stdout, /--preset phone/);
  assert.match(run(["browser", "outbound", "--help"]).stdout, /window\.open/);
  assert.match(run(["browser", "text", "--help"]).stdout, /textarea/);
  assert.match(run(["browser", "find", "--help"]).stdout, /--include-hidden/);
  assert.match(run(["browser", "click", "--help"]).stdout, /400 ms/);
  assert.match(run(["http", "get", "--help"]).stdout, /--fail-on-status/);
});

test("subcommand help is specific and still names dry-run on writes", () => {
  const click = run(["browser", "click", "--help"]);
  assert.equal(click.status, 0);
  assert.match(click.stdout, /--download/);
  assert.match(click.stdout, /download\.bytes/);
  const watch = run(["seed", "watch", "clear", "--help"]);
  assert.equal(watch.status, 0);
  assert.match(watch.stdout, /--dry-run/);
  assert.match(watch.stdout, /wrote/);
  const http = run(["http", "get", "--help"]);
  assert.equal(http.status, 0);
  assert.match(http.stdout, /\/dados\/csv\/sp/);
  assert.doesNotMatch(http.stdout, /Start next dev/);
});

test("unknown http subcommand says to use get, before any server", () => {
  const res = run(["http", "post", "/explorar"], { RADAR_VERIFY_RUN_ID: "" });
  assert.equal(res.status, 1);
  assert.equal(res.json.ok, false);
  assert.match(res.json.hint, /http get/);
  assert.match(res.json.hint, /--help/);
});

test("a click that should not navigate settles at 400 ms, however the control changed", () => {
  const budgetMs = 15000;
  // Salvar→Salvo, Remover (unmounted), a dialog trigger gone inert, a link to this page: all expectNav false.
  assert.equal(clickSettle({ expectNav: false, urlChanged: false, elapsedMs: 399, budgetMs }), "wait");
  assert.equal(clickSettle({ expectNav: false, urlChanged: false, elapsedMs: 400, budgetMs }), "done");
  assert.equal(clickSettle({ expectNav: false, urlChanged: true, elapsedMs: 30, budgetMs }), "done");
});

test("a click that should navigate waits for the URL, but never past its budget", () => {
  assert.equal(clickSettle({ expectNav: true, urlChanged: false, elapsedMs: 5000, budgetMs: 15000 }), "wait");
  assert.equal(clickSettle({ expectNav: true, urlChanged: false, elapsedMs: 15000, budgetMs: 15000 }), "done");
  assert.equal(clickSettle({ expectNav: true, urlChanged: true, elapsedMs: 80, budgetMs: 15000 }), "done");
  assert.equal(clickSettle({ expectNav: true, urlChanged: false, elapsedMs: 900, budgetMs: 800 }), "done");
});

test("navigation is expected only for same-origin links elsewhere and dialog search results", () => {
  const current = "http://127.0.0.1:4173/explorar?uf=SP";
  assert.equal(expectsNavigation({ href: "/regiao/sudeste", current }), true);
  assert.equal(expectsNavigation({ href: "/explorar?uf=RJ", current }), true);
  assert.equal(expectsNavigation({ href: "/explorar?uf=SP", current }), false, "same path and query");
  assert.equal(expectsNavigation({ href: "/explorar?uf=SP#tabela", current }), false, "hash only");
  assert.equal(expectsNavigation({ href: "/", current: "http://127.0.0.1:4173/" }), false, "logo on the home page");
  assert.equal(expectsNavigation({ href: "/dados", target: "_blank", current }), false, "new tab");
  assert.equal(expectsNavigation({ href: "/dados/csv/sp", download: true, current }), false, "download");
  assert.equal(expectsNavigation({ href: "https://wa.me/?text=x", current }), false, "other origin");
  assert.equal(expectsNavigation({ href: "mailto:?subject=x", current }), false, "mailto");
  assert.equal(expectsNavigation({ role: "option", inDialog: true, current }), true, "search result");
  assert.equal(expectsNavigation({ role: "option", inDialog: false, current }), false, "UF select option");
  assert.equal(expectsNavigation({ role: "button", current }), false, "button");
});

test("one budget covers the whole operation", () => {
  let t = 1000;
  const b = budget(1500, () => t);
  assert.equal(b.left(), 1500);
  t = 2000;
  assert.equal(b.left(), 500);
  t = 2600;
  assert.equal(b.left(), 1, "never zero, so Playwright does not read it as no timeout");
  assert.equal(b.spent(), true);
});

test("a bad --timeout is rejected before launch creates a run or spawns next", () => {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rv-state-"));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "rv-evidence-"));
  const env = { RADAR_VERIFY_STATE_ROOT: stateRoot, RADAR_VERIFY_EVIDENCE_ROOT: evidence, RADAR_VERIFY_RUN_ID: "" };
  try {
    const res = run(["launch", "--timeout", "nope"], env);
    assert.equal(res.status, 1);
    assert.match(res.json.error, /--timeout/);
    assert.match(res.json.hint, /--timeout 180000/);
    assert.deepEqual(fs.readdirSync(stateRoot), [], "launch wrote a run record, so it got past validation");
  } finally {
    for (const name of fs.readdirSync(stateRoot)) run(["cleanup", "--run-id", name], env);
  }
});

test("viewport presets and sizes", () => {
  assert.equal(resolveViewport({}), null);
  assert.deepEqual(resolveViewport({ preset: "phone" }), { preset: "phone", width: 390, height: 844 });
  assert.ok(resolveViewport({ preset: "phone" }).width < 460, "phone must be below the Método breakpoint");
  assert.deepEqual(resolveViewport({ width: "375", height: "812" }), { preset: null, width: 375, height: 812 });
  assert.throws(() => resolveViewport({ preset: "watch" }), /Unknown viewport preset/);
  assert.throws(() => resolveViewport({ width: "375" }), /--height/);
  assert.throws(() => resolveViewport({ preset: "phone", width: "375" }), /not both/);
});

test("browser viewport rejects a bad preset before starting a browser", () => {
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rv-state-"));
  const dir = path.join(stateRoot, "vp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ runId: "vp", pid: 0, port: 1, url: "http://127.0.0.1:1", repoRoot, stateDir: dir }));
  const res = run(["browser", "viewport", "--preset", "watch"], { RADAR_VERIFY_STATE_ROOT: stateRoot, RADAR_VERIFY_RUN_ID: "vp" });
  assert.equal(res.status, 1);
  assert.match(res.json.hint, /phone \(390×844\)/);
  assert.equal(fs.existsSync(path.join(dir, "browser.sock")), false);
});

test("--include-hidden reaches role queries and the within scope", () => {
  assert.equal(roleOptions({ name: "Principal" }).includeHidden, undefined);
  assert.equal(roleOptions({ name: "Principal", includeHidden: true }).includeHidden, true);
  assert.deepEqual(withinOptions({ withinName: "Nível", withinExact: true }), { name: "Nível", exact: true });
  assert.ok(withinOptions({ withinNameRegex: "^Nível$" }).name instanceof RegExp);
});

test("the outbound guard records window.open, mailto, and share, and leaves same-origin alone", async () => {
  /** @type {any[]} */
  const seen = [];
  /** @type {Record<string, Function>} */
  const listeners = {};
  let opened = 0;
  const win = {
    location: { href: "http://127.0.0.1:4173/sp/santo-andre" },
    open: () => {
      opened++;
      return {};
    },
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    navigator: { share: () => Promise.reject(new Error("real share")) },
    __radarRecordOutbound: (entry) => seen.push(entry),
  };
  installOutboundGuard("http://127.0.0.1:4173", win);
  assert.equal(win.open("https://wa.me/?text=oi", "_blank", "noopener"), null);
  assert.notEqual(win.open("/dados"), null);
  assert.equal(opened, 1, "same-origin window.open still opens");
  const click = (href, target = null) => {
    let prevented = false;
    const anchor = { getAttribute: (n) => (n === "href" ? href : n === "target" ? target : null), textContent: "E-mail" };
    listeners.click({ target: { closest: () => anchor }, preventDefault: () => (prevented = true) });
    return prevented;
  };
  assert.equal(click("mailto:?subject=x"), true);
  assert.equal(click("/explorar"), false);
  assert.equal(click("#citar"), false);
  await win.navigator.share({ url: "http://127.0.0.1:4173/sp", title: "Radar" });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(seen.map((e) => e.kind), ["window.open", "link", "share"]);
  assert.equal(seen[0].url, "https://wa.me/?text=oi");
  assert.equal(seen[1].url, "mailto:?subject=x");
});

test("unknown command tells the agent what to run", () => {
  const res = run(["explode"]);
  assert.equal(res.status, 1);
  assert.equal(res.json.ok, false);
  assert.match(res.json.hint, /control-radar-mde --help/);
});

test("doctor without a run id explains how to launch", () => {
  const res = run(["doctor"], { RADAR_VERIFY_RUN_ID: "" });
  assert.equal(res.status, 1);
  assert.match(res.json.error, /No run id/);
  assert.match(res.json.hint, /control-radar-mde launch/);
});

test("watchlist helper adds and removes uf/slug ids", () => {
  assert.deepEqual(parseWatch(null), []);
  const added = nextWatch("[]", "sp/santo-andre", "add");
  assert.deepEqual(parseWatch(added), ["sp/santo-andre"]);
  const again = nextWatch(added, "sp/santo-andre", "add");
  assert.deepEqual(parseWatch(again), ["sp/santo-andre"]);
  assert.deepEqual(parseWatch(nextWatch(again, "sp/santo-andre", "remove")), []);
});

test("evidence paths cannot escape into the state directory", () => {
  const paths = runPaths("sample");
  assert.equal(isInside(paths.evidenceDir, paths.stateDir), false);
  const file = resolveEvidencePath(paths.evidenceDir, "save-municipality/list.png");
  assert.equal(file, path.join(paths.evidenceDir, "save-municipality/list.png"));
  assert.throws(() => resolveEvidencePath(paths.evidenceDir, "../state/secret"), /escapes/);
});

test("launch refuses a second server while one run is alive", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "radar-state-"));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "radar-evidence-"));
  const child = spawn("sleep", ["120"], { detached: true, stdio: "ignore" });
  child.unref();
  try {
    const runId = "sibling";
    const dir = path.join(root, runId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "state.json"),
      JSON.stringify({
        runId,
        pid: child.pid,
        port: 1,
        url: "http://127.0.0.1:1",
        repoRoot,
        expectCmd: "sleep",
        evidenceDir: path.join(evidence, runId),
        stateDir: dir,
      }),
    );
    const env = { RADAR_VERIFY_STATE_ROOT: root, RADAR_VERIFY_EVIDENCE_ROOT: evidence, RADAR_VERIFY_RUN_ID: "" };
    const res = run(["launch", "--run-id", "other"], env);
    assert.equal(res.status, 1);
    assert.match(res.json.error, /already has a verification server/);
    assert.match(res.json.hint, /cleanup --run-id sibling/);
    assert.equal(alive(child.pid), true);
  } finally {
    try {
      process.kill(child.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
});

test("cleanup --dry-run leaves the process and evidence, then a real cleanup removes only state", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "radar-state-"));
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "radar-evidence-"));
  const runId = "dryrun1";
  const stateDir = path.join(root, runId);
  const evidenceDir = path.join(evidence, runId);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "list.png"), "proof");
  const child = spawn("sleep", ["120"], { detached: true, stdio: "ignore" });
  child.unref();
  const env = { RADAR_VERIFY_STATE_ROOT: root, RADAR_VERIFY_EVIDENCE_ROOT: evidence, RADAR_VERIFY_RUN_ID: "" };
  try {
    fs.writeFileSync(
      path.join(stateDir, "state.json"),
      JSON.stringify({
        runId,
        pid: child.pid,
        port: 9,
        url: "http://127.0.0.1:9",
        repoRoot,
        expectCmd: "sleep",
        evidenceDir,
        stateDir,
        logPath: path.join(stateDir, "next.log"),
      }),
    );
    const preview = run(["cleanup", "--run-id", runId, "--dry-run"], env);
    assert.equal(preview.status, 0);
    assert.equal(preview.json.dryRun, true);
    assert.equal(preview.json.evidenceKept, true);
    assert.deepEqual(preview.json.removed, []);
    assert.ok(preview.json.wouldRemove.includes(stateDir));
    assert.equal(preview.json.wouldRemove.includes(evidenceDir), false);
    assert.equal(alive(child.pid), true);
    assert.equal(fs.existsSync(path.join(evidenceDir, "list.png")), true);
    assert.equal(fs.existsSync(path.join(stateDir, "state.json")), true);

    const done = run(["cleanup", "--run-id", runId], env);
    assert.equal(done.status, 0);
    assert.equal(done.json.dryRun, false);
    assert.equal(done.json.evidenceKept, true);
    assert.equal(alive(child.pid), false);
    assert.equal(fs.existsSync(stateDir), false);
    assert.equal(fs.readFileSync(path.join(evidenceDir, "list.png"), "utf8"), "proof");

    const again = run(["evidence", "list", "--run-id", runId], env);
    assert.equal(again.status, 0);
    assert.equal(again.json.files.length, 1);
    assert.equal(again.json.files[0].path, path.join(evidenceDir, "list.png"));
    assert.equal(again.json.files[0].bytes, 5);
  } finally {
    if (alive(child.pid)) {
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
});
