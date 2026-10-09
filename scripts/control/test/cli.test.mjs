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
import { clickSettle } from "../lib/click-settle.mjs";
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

test("click waits for a link or a detached control, and not for a menu button", () => {
  const timeoutMs = 15000;
  assert.equal(clickSettle({ href: "/regiao/sudeste", urlChanged: false, stillThere: true, elapsedMs: 500, timeoutMs }), "wait");
  assert.equal(clickSettle({ href: "/regiao/sudeste", urlChanged: true, stillThere: true, elapsedMs: 500, timeoutMs }), "done");
  assert.equal(clickSettle({ href: "", urlChanged: false, stillThere: false, elapsedMs: 500, timeoutMs }), "wait");
  assert.equal(clickSettle({ href: "", urlChanged: false, stillThere: true, elapsedMs: 400, timeoutMs }), "done");
  assert.equal(clickSettle({ href: "", urlChanged: true, stillThere: false, elapsedMs: 80, timeoutMs }), "done");
});

test("a bad --timeout names the flag and does not start a server", () => {
  const res = run(["launch", "--timeout", "nope"]);
  assert.equal(res.status, 1);
  assert.match(res.json.error, /--timeout/);
  assert.match(res.json.hint, /--timeout 180000/);
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
