import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { repoRoot } from "../lib/paths.mjs";
import { alive } from "../lib/proc.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "cli.mjs");
const site = path.join(here, "fixtures", "fake-site.mjs");
const hasChromium = fs.existsSync(chromium.executablePath());

const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rv-browser-state-"));
const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rv-browser-evidence-"));
const runId = "browsertest";
const env = { ...process.env, RADAR_VERIFY_STATE_ROOT: stateRoot, RADAR_VERIFY_EVIDENCE_ROOT: evidenceRoot, RADAR_VERIFY_RUN_ID: runId };
/** @type {number} */
let serverPid = 0;

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = /** @type {net.AddressInfo} */ (srv.address());
      srv.close(() => resolve(port));
    });
  });
}

/** @param {string[]} args */
function run(args) {
  const started = Date.now();
  const res = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env, timeout: 60_000 });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    json = null;
  }
  return { status: res.status, json, stdout: res.stdout, wallMs: Date.now() - started };
}

before(async () => {
  if (!hasChromium) return;
  const port = await freePort();
  const stateDir = path.join(stateRoot, runId);
  fs.mkdirSync(stateDir, { recursive: true });
  const logPath = path.join(stateDir, "next.log");
  const logFd = fs.openSync(logPath, "a");
  const child = spawn(process.execPath, [site, String(port)], { detached: true, stdio: ["ignore", logFd, logFd] });
  child.unref();
  fs.closeSync(logFd);
  serverPid = child.pid ?? 0;
  const url = `http://127.0.0.1:${port}`;
  fs.writeFileSync(
    path.join(stateDir, "state.json"),
    JSON.stringify({
      runId,
      pid: serverPid,
      port,
      host: "127.0.0.1",
      url,
      repoRoot,
      revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
      logPath,
      profileDir: path.join(stateDir, "profile"),
      evidenceDir: path.join(evidenceRoot, runId),
      stateDir,
      expectCmd: "fake-site.mjs",
    }),
  );
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(() => {
  if (!hasChromium) return;
  run(["cleanup"]);
  if (serverPid && alive(serverPid)) process.kill(serverPid, "SIGKILL");
  fs.rmSync(stateRoot, { recursive: true, force: true });
  fs.rmSync(evidenceRoot, { recursive: true, force: true });
});

const skip = hasChromium ? false : "Playwright Chromium is not installed (npx --prefix scripts/control playwright install chromium)";

test("controls that rename, unmount, open a modal, or link to this page return without waiting for a URL", { skip }, () => {
  assert.equal(run(["browser", "open", "/"]).status, 0);
  const cases = [
    ["--role", "button", "--name", "Salvar"],
    ["--role", "button", "--name", "Remover Santo André dos salvos"],
    ["--role", "button", "--name", "Abrir diálogo"],
  ];
  for (const args of cases) {
    const res = run(["browser", "click", ...args]);
    assert.equal(res.status, 0, res.stdout);
    assert.equal(res.json.expectNav, false);
    assert.equal(res.json.navigated, false);
    assert.ok(res.json.elapsedMs < 1500, `${args.join(" ")} took ${res.json.elapsedMs}ms`);
  }
  assert.equal(run(["browser", "click", "--role", "button", "--name", "Fechar"]).status, 0);
  const same = run(["browser", "click", "--role", "link", "--name", "Este endereço"]);
  assert.equal(same.status, 0, same.stdout);
  assert.equal(same.json.expectNav, false);
  assert.ok(same.json.elapsedMs < 1500, `same-page link took ${same.json.elapsedMs}ms`);
});

test("a link waits for a slow document and for a delayed client route", { skip }, () => {
  run(["browser", "open", "/"]);
  const slow = run(["browser", "click", "--role", "link", "--name", "Página lenta"]);
  assert.equal(slow.status, 0, slow.stdout);
  assert.equal(slow.json.navigated, true);
  assert.match(slow.json.url, /\/slow$/);
  assert.ok(slow.json.elapsedMs >= 1000, `slow page returned after ${slow.json.elapsedMs}ms`);
  run(["browser", "open", "/"]);
  const client = run(["browser", "click", "--role", "link", "--name", "Rota cliente"]);
  assert.equal(client.status, 0, client.stdout);
  assert.match(client.json.url, /\/client$/);
  assert.ok(client.json.elapsedMs >= 800, `client route returned after ${client.json.elapsedMs}ms`);
});

test("a navigating click that never moves fails inside --timeout and says it already clicked", { skip }, () => {
  run(["browser", "open", "/"]);
  const res = run(["browser", "click", "--role", "link", "--name", "Link preso", "--timeout", "1500"]);
  assert.equal(res.status, 1);
  assert.equal(res.json.clicked, true);
  assert.match(res.json.hint, /do not repeat it/);
  assert.ok(res.wallMs < 6500, `stuck link took ${res.wallMs}ms of wall time`);
  assert.ok(res.json.elapsedMs <= 2000, `daemon spent ${res.json.elapsedMs}ms on a 1500ms budget`);
});

test("text returns the value of a textarea and an input", { skip }, () => {
  run(["browser", "open", "/"]);
  const area = run(["browser", "text", "--role", "textbox", "--name", "Carta para a prefeitura"]);
  assert.equal(area.status, 0, area.stdout);
  assert.equal(area.json.text, "Prezada prefeita, Ana Costa");
  assert.equal(area.json.source, "value");
  run(["browser", "fill", "--role", "textbox", "--name", "Nome", "--value", "Bruno"]);
  assert.equal(run(["browser", "text", "--role", "textbox", "--name", "Nome"]).json.value, "Bruno");
});

test("popups, mailto, and external links are recorded and the page stays", { skip }, () => {
  run(["browser", "open", "/"]);
  run(["browser", "outbound", "--clear"]);
  const wa = run(["browser", "click", "--role", "button", "--name", "Enviar no WhatsApp"]);
  assert.equal(wa.status, 0, wa.stdout);
  assert.equal(wa.json.navigated, false);
  assert.equal(wa.json.outbound[0].kind, "window.open");
  assert.match(wa.json.outbound[0].url, /^https:\/\/wa\.me\/\?text=Radar/);
  const mail = run(["browser", "click", "--role", "link", "--name", "E-mail"]);
  assert.equal(mail.json.outbound[0].kind, "link");
  assert.match(mail.json.outbound[0].url, /^mailto:\?subject=Radar/);
  const ext = run(["browser", "click", "--role", "link", "--name", "Fonte externa"]);
  assert.equal(ext.json.outbound[0].target, "_blank");
  assert.match(run(["browser", "url"]).json.url, /\/$/);
  const list = run(["browser", "outbound"]);
  assert.equal(list.json.count, 3);
  assert.deepEqual(list.json.entries.map((e) => e.kind), ["window.open", "link", "link"]);
});

test("viewport phone shows the second navigation bar and its short label", { skip }, () => {
  run(["browser", "open", "/"]);
  assert.equal(run(["browser", "find", "--role", "navigation", "--name", "Principal"]).json.count, 1);
  assert.equal(run(["browser", "find", "--role", "navigation", "--name", "Principal", "--include-hidden"]).json.count, 2);
  assert.equal(run(["browser", "find", "--role", "link", "--name", "Método", "--exact"]).json.count, 0);
  const phone = run(["browser", "viewport", "--preset", "phone"]);
  assert.equal(phone.status, 0, phone.stdout);
  assert.equal(phone.json.width, 390);
  assert.equal(phone.json.innerWidth, 390);
  const tap = run(["browser", "click", "--role", "link", "--name", "Método", "--exact", "--within-role", "navigation", "--within-name", "Principal"]);
  assert.equal(tap.status, 0, tap.stdout);
  assert.match(tap.json.url, /\/sobre$/);
  const back = run(["browser", "viewport", "--preset", "desktop"]);
  assert.equal(back.json.width, 1440);
  assert.equal(back.json.preset, "desktop");
});

test("http get on a 404 exits 0 with the status, and --fail-on-status exits 1", { skip }, () => {
  const plain = run(["http", "get", "/nao-existe"]);
  assert.equal(plain.status, 0, plain.stdout);
  assert.equal(plain.json.status, 404);
  assert.equal(plain.json.statusOk, false);
  const strict = run(["http", "get", "/nao-existe", "--fail-on-status"]);
  assert.equal(strict.status, 1);
  assert.equal(strict.json.status, 404);
});
