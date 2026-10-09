#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { numberFlag, parseArgs, stringFlag } from "./lib/args.mjs";
import { CliError, toPayload } from "./lib/errors.mjs";
import { commandNames, helpFor } from "./lib/help.mjs";
import { assertRunId, evidenceRoot, gitRevision, readJson, repoRoot, resolveEvidencePath, runIdFrom, runPaths, stateRoot, webDir, writeJson } from "./lib/paths.mjs";
import { alive, cmdlineMatches, descendants, findFreePort, listeningPids, portFree, readTail, spawnDetached, stopProcessGroup } from "./lib/proc.mjs";
import { WATCH_KEY, assertWatchId, nextWatch, parseWatch } from "./lib/watch.mjs";

const EXPECT_NEXT = "next/dist/bin/next";
const EXPECT_DAEMON = "browser-daemon.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

/** @param {string} file */
function loadState(file) {
  if (!fs.existsSync(file)) {
    throw new CliError(
      `No verification run is recorded at ${file}.`,
      "Run control-radar-mde launch and pass the printed runId as --run-id. Do not attach to a next dev you started by hand.",
    );
  }
  return readJson(file);
}

function liveRuns() {
  const root = stateRoot();
  if (!fs.existsSync(root)) return [];
  /** @type {any[]} */
  const runs = [];
  for (const name of fs.readdirSync(root)) {
    const file = path.join(root, name, "state.json");
    if (!fs.existsSync(file)) continue;
    try {
      const state = readJson(file);
      if (state.repoRoot === repoRoot && alive(state.pid) && cmdlineMatches(state.pid, state.expectCmd || EXPECT_NEXT)) {
        runs.push(state);
      }
    } catch {
      /* ignore a corrupt record; doctor will complain if someone asks for it */
    }
  }
  return runs;
}

/** @param {any} state */
function publicState(state, extra = {}) {
  return {
    ok: true,
    runId: state.runId,
    url: state.url,
    pid: state.pid,
    port: state.port,
    host: state.host,
    revision: state.revision,
    evidenceDir: state.evidenceDir,
    stateDir: state.stateDir,
    logPath: state.logPath,
    ...extra,
  };
}

/** @param {string} url @param {number} timeoutMs */
async function probe(url, timeoutMs) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  return {
    status: response.status,
    title,
    identity: title.includes("Radar MDE") || text.includes("Radar MDE"),
  };
}

/** @param {any} state */
async function inspect(state) {
  const processOk = Boolean(state.pid) && alive(state.pid) && cmdlineMatches(state.pid, state.expectCmd || EXPECT_NEXT);
  let listeners = [];
  let portError = "";
  try {
    listeners = listeningPids(state.port);
  } catch (err) {
    portError = err instanceof Error ? err.message : String(err);
  }
  const tree = processOk ? descendants(state.pid) : new Set();
  const portOk = processOk && listeners.length > 0 && listeners.every((pid) => tree.has(pid));
  /** @type {{ status: number, title: string, identity: boolean } | null} */
  let http = null;
  let httpError = "";
  if (processOk && portOk) {
    try {
      http = await probe(state.url + "/", 45_000);
    } catch (err) {
      httpError = err instanceof Error ? err.message : String(err);
    }
  }
  const head = gitRevision();
  const revisionOk = state.revision === head;
  const httpOk = Boolean(http && http.status === 200 && http.identity);
  const ok = processOk && portOk && httpOk && revisionOk;
  return {
    ok,
    exitCode: ok ? 0 : 2,
    runId: state.runId,
    url: state.url,
    pid: state.pid,
    port: state.port,
    evidenceDir: state.evidenceDir,
    stateDir: state.stateDir,
    profileDir: state.profileDir,
    revision: state.revision,
    head,
    auth: "none",
    authNote: "Radar MDE has no login. Saved municipalities are localStorage in this run's browser profile, not an account.",
    checks: {
      process: processOk,
      port: portOk,
      http: httpOk,
      revision: revisionOk,
    },
    listeners,
    http,
    httpError,
    portError,
    hint: ok
      ? "The server is the one this run started. Drive it with control-radar-mde browser."
      : !processOk
        ? "The recorded next dev is not running. Run control-radar-mde launch to start a new run. Do not reuse this run id against a different server."
        : !portOk
          ? `Port ${state.port} is not owned by pid ${state.pid}. Run control-radar-mde cleanup --run-id ${state.runId} and launch again. Do not kill a process you found by name.`
          : !httpOk
            ? `GET ${state.url}/ did not return Radar MDE (${httpError || http?.status}). Read control-radar-mde logs --run-id ${state.runId}.`
            : `HEAD is ${head} but this server started at ${state.revision}. Cleanup and launch again so the page matches the checkout.`,
  };
}

/** @param {Record<string, string | boolean>} flags */
async function launch(flags) {
  const host = "127.0.0.1";
  if (flags.host && flags.host !== host) {
    throw new CliError(
      `Refusing to bind ${flags.host}.`,
      "Omit --host. The verification server listens on 127.0.0.1 only.",
    );
  }
  const requestedId = flags["run-id"] && flags["run-id"] !== true ? String(flags["run-id"]) : "";
  const runId = assertRunId(requestedId || `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const running = liveRuns();
  const others = running.filter((item) => item.runId !== runId);
  if (others.length) {
    const other = others[0];
    throw new CliError(
      `This checkout already has a verification server (run ${other.runId}, pid ${other.pid}, ${other.url}).`,
      `Next.js shares web/.next, so a second next dev here corrupts the cache. Reuse --run-id ${other.runId}, or run control-radar-mde cleanup --run-id ${other.runId}. Do not kill next by process name. Another git checkout can run its own server.`,
      1,
      { blockingRunId: other.runId, blockingUrl: other.url },
    );
  }
  const same = running.find((item) => item.runId === runId);
  if (same) return publicState(same, { reused: true, hint: "This run is already serving. Do not start another next dev." });

  const nextBin = path.join(webDir, "node_modules/next/dist/bin/next");
  if (!fs.existsSync(nextBin)) {
    throw new CliError(
      "Next.js is not installed in web/.",
      "Run npm install in the web directory, then control-radar-mde launch again. The site does not need API keys.",
    );
  }

  const paths = runPaths(runId);
  if (fs.existsSync(paths.stateDir)) fs.rmSync(paths.stateDir, { recursive: true, force: true });
  fs.mkdirSync(paths.stateDir, { recursive: true });
  fs.mkdirSync(paths.evidenceDir, { recursive: true });
  fs.mkdirSync(paths.profileDir, { recursive: true });

  const explicitPort = flags.port != null && flags.port !== true;
  const port = explicitPort ? numberFlag(flags, "port", 4173) : await findFreePort(host, 4173);
  if (explicitPort && !(await portFree(host, port))) {
    throw new CliError(
      `Port ${port} on ${host} is already in use.`,
      "Pass a different --port, or cleanup the verification run that owns it. Do not kill whatever is listening unless its pid is in a run record you started.",
    );
  }

  const env = { ...process.env, PORT: String(port), HOSTNAME: host, NEXT_TELEMETRY_DISABLED: "1" };
  for (const key of [
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "NEXT_PUBLIC_VERCEL_URL",
    "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
    "NEXT_PUBLIC_SITE_URL",
  ]) {
    delete env[key];
  }

  const args = [nextBin, "dev", "--hostname", host, "--port", String(port)];
  const pid = spawnDetached(process.execPath, args, { cwd: webDir, env, logPath: paths.logPath });
  const state = {
    runId,
    pid,
    port,
    host,
    url: `http://${host}:${port}`,
    repoRoot,
    webDir,
    revision: gitRevision(),
    startedAt: new Date().toISOString(),
    logPath: paths.logPath,
    profileDir: paths.profileDir,
    evidenceDir: paths.evidenceDir,
    stateDir: paths.stateDir,
    expectCmd: EXPECT_NEXT,
    auth: "none",
  };
  writeJson(paths.stateFile, state);

  const timeout = numberFlag(flags, "timeout", 180_000);
  const deadline = Date.now() + timeout;
  let last = "no response yet";
  while (Date.now() < deadline) {
    if (!alive(pid)) {
      const tail = readTail(paths.logPath, 40).join("\n");
      throw new CliError(
        "next dev exited before the home page was ready.",
        `Read the log tail below, fix the cause, then launch again. Do not reuse pid ${pid}.\n${tail}`,
        1,
        { runId, logPath: paths.logPath },
      );
    }
    try {
      const http = await probe(`${state.url}/`, 120_000);
      if (http.status === 200 && http.identity) {
        return publicState(state, { ready: true, title: http.title, reused: false });
      }
      last = `HTTP ${http.status} title=${JSON.stringify(http.title)}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await stopProcessGroup(pid, EXPECT_NEXT, false);
  const tail = readTail(paths.logPath, 40).join("\n");
  throw new CliError(
    `Timed out after ${timeout}ms waiting for Radar MDE at ${state.url}/ (${last}).`,
    `The process was stopped. Inspect the log tail, then launch again.\n${tail}`,
    1,
    { runId, logPath: paths.logPath },
  );
}

/** @param {any} state @param {Record<string, unknown>} msg @param {number} timeout */
function rpc(state, msg, timeout) {
  const socketPath = runPaths(state.runId).socketPath;
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buf = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new CliError(
        "The browser daemon did not answer in time.",
        "Retry the command. If it keeps hanging, run control-radar-mde cleanup --run-id " + state.runId + " and launch again. Do not start a second browser against the same profile.",
      ));
    }, timeout + 5000);
    socket.setEncoding("utf8");
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(new CliError(
        `Could not reach the browser daemon (${err.message}).`,
        "Retry once. If the socket is missing, the next browser command starts it. If the profile is locked, cleanup this run and launch again.",
      ));
    });
    socket.on("data", (chunk) => {
      buf += chunk;
      if (!buf.includes("\n")) return;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(buf.slice(0, buf.indexOf("\n"))));
      } catch {
        reject(new CliError("The browser daemon returned malformed JSON.", "Retry the command. If it persists, cleanup this run and launch again."));
      }
    });
    socket.on("connect", () => {
      socket.write(`${JSON.stringify(msg)}\n`);
    });
  });
}

/** @param {any} state @param {boolean} headed */
async function ensureDaemon(state, headed) {
  const paths = runPaths(state.runId);
  const report = await inspect(state);
  if (!report.ok) {
    throw new CliError(
      "Refusing to drive a server that is not this run.",
      report.hint,
      2,
      { checks: report.checks },
    );
  }
  try {
    const pong = await rpc(state, { op: "ping" }, 2000);
    if (pong && pong.ok) return;
  } catch {
    /* start it */
  }
  fs.rmSync(paths.daemonError, { force: true });
  fs.rmSync(paths.readyFile, { force: true });
  const args = [path.join(here, "browser-daemon.mjs"), state.runId];
  if (headed) args.push("--headed");
  const logFd = fs.openSync(paths.daemonLog, "a");
  const child = spawn(process.execPath, args, { detached: true, stdio: ["ignore", logFd, logFd] });
  child.unref();
  fs.closeSync(logFd);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(paths.daemonError)) {
      const err = readJson(paths.daemonError);
      throw new CliError(err.error || "Browser daemon failed to start.", err.hint || "See browser.log in the state directory.");
    }
    if (fs.existsSync(paths.readyFile)) {
      try {
        const pong = await rpc(state, { op: "ping" }, 2000);
        if (pong && pong.ok) return;
      } catch {
        /* ready file beat the socket */
      }
    }
    if (child.pid && !alive(child.pid) && !fs.existsSync(paths.readyFile)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const tail = readTail(paths.daemonLog, 30).join("\n");
  throw new CliError(
    "The browser daemon did not become ready.",
    `Install Chromium if the log asks for it: cd scripts/control && npx playwright install chromium\n${tail}`,
  );
}

/** @param {any} state @param {Record<string, string | boolean>} flags @param {Record<string, unknown>} msg */
async function browserCall(state, flags, msg) {
  await ensureDaemon(state, Boolean(flags.headed));
  const timeout = numberFlag(flags, "timeout", 15_000);
  const result = await rpc(state, { timeout, ...msg }, timeout);
  if (!result || result.ok === false) {
    throw new CliError(result?.error || "Browser command failed.", result?.hint || "Run control-radar-mde browser --help.", 1, {
      samples: result?.samples,
      count: result?.count,
    });
  }
  return { ...result, runId: state.runId, ok: true };
}

/** @param {Record<string, string | boolean>} flags */
function targetMsg(flags) {
  return {
    role: stringFlag(flags, "role"),
    name: flags.name == null || flags.name === true ? "" : String(flags.name),
    nameRegex: stringFlag(flags, "name-regex"),
    exact: Boolean(flags.exact),
    level: flags.level && flags.level !== true ? Number(flags.level) : 0,
    placeholder: stringFlag(flags, "placeholder"),
    label: stringFlag(flags, "label"),
    selector: stringFlag(flags, "selector"),
    withinRole: stringFlag(flags, "within-role"),
    withinName: stringFlag(flags, "within-name"),
    withinExact: Boolean(flags["within-exact"]),
    includeHidden: Boolean(flags["include-hidden"]),
    force: Boolean(flags.force),
  };
}

/** @param {string[]} positionals @param {Record<string, string | boolean>} flags @param {any} state */
async function browser(positionals, flags, state) {
  const sub = positionals[1] || "";
  const target = targetMsg(flags);
  if (sub === "open") {
    const openPath = positionals[2] || stringFlag(flags, "path") || "/";
    return browserCall(state, flags, { op: "open", path: openPath });
  }
  if (sub === "url") return browserCall(state, flags, { op: "url" });
  if (sub === "press") {
    const key = stringFlag(flags, "key");
    if (!key) throw new CliError("press needs --key.", "Example: control-radar-mde browser press --key Control+k");
    return browserCall(state, flags, { op: "press", key });
  }
  if (sub === "clipboard") return browserCall(state, flags, { op: "clipboard" });
  if (sub === "storage") {
    const action = positionals[2];
    const key = stringFlag(flags, "key");
    if (action !== "get" && action !== "set") {
      throw new CliError("storage needs get or set.", "Example: browser storage get --key radar-mde:watch");
    }
    if (!key) throw new CliError("storage needs --key.", "The watchlist key is radar-mde:watch. Recent search is radar-mde:recent-search. Theme is theme.");
    if (action === "set" && (flags.value == null || flags.value === true)) {
      throw new CliError("storage set needs --value.", "Pass the raw localStorage string. For the watchlist prefer control-radar-mde seed watch add --id sp/santo-andre.");
    }
    return browserCall(state, flags, { op: action === "get" ? "storage-get" : "storage-set", key, value: stringFlag(flags, "value"), dryRun: Boolean(flags["dry-run"]) });
  }
  if (sub === "click") {
    /** @type {Record<string, unknown>} */
    const msg = { op: "click", ...target };
    if (flags.download && flags.download !== true) {
      msg.download = resolveEvidencePath(state.evidenceDir, String(flags.download));
    }
    return browserCall(state, flags, msg);
  }
  if (sub === "fill") {
    if (flags.value == null || flags.value === true) {
      throw new CliError("fill needs --value.", "Example: browser fill --role searchbox --name \"Buscar município pelo nome\" --value \"Santo André\".");
    }
    return browserCall(state, flags, { op: "fill", ...target, value: String(flags.value) });
  }
  if (sub === "wait") {
    return browserCall(state, flags, {
      op: "wait",
      ...target,
      text: stringFlag(flags, "text"),
      textRegex: stringFlag(flags, "text-regex"),
      urlIncludes: stringFlag(flags, "url-includes"),
    });
  }
  if (sub === "find") return browserCall(state, flags, { op: "find", ...target });
  if (sub === "text") return browserCall(state, flags, { op: "text", ...target });
  if (sub === "snapshot") {
    const dest = resolveEvidencePath(state.evidenceDir, stringFlag(flags, "path"));
    return browserCall(state, flags, { op: "snapshot", ...target, path: dest });
  }
  if (sub === "screenshot") {
    const dest = resolveEvidencePath(state.evidenceDir, stringFlag(flags, "path"));
    return browserCall(state, flags, { op: "screenshot", path: dest, fullPage: Boolean(flags["full-page"]) });
  }
  throw new CliError(
    `Unknown browser subcommand ${JSON.stringify(sub)}.`,
    `Use one of: open, click, fill, press, wait, find, text, snapshot, screenshot, url, clipboard, storage. Run control-radar-mde browser --help.`,
  );
}

/** @param {string[]} positionals @param {Record<string, string | boolean>} flags @param {any} state */
async function seed(positionals, flags, state) {
  const group = positionals[1];
  const action = positionals[2];
  if (group !== "watch" || !["list", "add", "remove", "clear"].includes(action)) {
    throw new CliError(
      "seed only knows the watchlist.",
      "Run control-radar-mde seed watch list, add --id sp/santo-andre, remove --id sp/santo-andre, or clear. Add --dry-run to preview a write.",
    );
  }
  const current = await browserCall(state, flags, { op: "storage-get", key: WATCH_KEY });
  if (action === "list") {
    return { ok: true, runId: state.runId, key: WATCH_KEY, ids: parseWatch(current.value), raw: current.value };
  }
  const dryRun = Boolean(flags["dry-run"]);
  let next = "[]";
  if (action === "clear") next = "[]";
  else {
    const id = assertWatchId(stringFlag(flags, "id"));
    next = nextWatch(current.value, id, action === "add" ? "add" : "remove");
  }
  if (dryRun) {
    return {
      ok: true,
      runId: state.runId,
      dryRun: true,
      wrote: false,
      key: WATCH_KEY,
      from: current.value ?? "[]",
      to: next,
      hint: "Nothing was written. Run control-radar-mde seed watch list and confirm the ids still match from.",
    };
  }
  const written = await browserCall(state, flags, { op: "storage-set", key: WATCH_KEY, value: next, dryRun: false });
  return { ok: true, runId: state.runId, dryRun: false, wrote: true, key: WATCH_KEY, from: current.value, to: written.value, ids: parseWatch(written.value) };
}

/** @param {string[]} positionals @param {Record<string, string | boolean>} flags @param {any} state */
async function httpGet(positionals, flags, state) {
  const report = await inspect(state);
  if (!report.ok) throw new CliError("Refusing to request a server that failed doctor.", report.hint, 2, { checks: report.checks });
  const reqPath = positionals[2] || stringFlag(flags, "path");
  if (!reqPath || reqPath.includes("://") || reqPath.startsWith("//")) {
    throw new CliError(
      "http get needs a path on this run.",
      "Example: control-radar-mde http get /dados/csv/sp --save sp.csv. Do not pass another host.",
    );
  }
  const url = new URL(reqPath.startsWith("/") ? reqPath : `/${reqPath}`, state.url);
  if (url.origin !== state.url) {
    throw new CliError(`Refusing to request ${url.origin}.`, `Stay on ${state.url}. Pass a path such as /explorar.`);
  }
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(numberFlag(flags, "timeout", 60_000)) });
  const buf = Buffer.from(await response.arrayBuffer());
  /** @type {Record<string, unknown>} */
  const payload = {
    ok: response.ok,
    runId: state.runId,
    status: response.status,
    url: response.url,
    contentType: response.headers.get("content-type"),
    bytes: buf.length,
  };
  const type = String(payload.contentType || "");
  if (type.startsWith("text/") || type.includes("json") || type.includes("xml") || type.includes("csv")) {
    payload.preview = buf.subarray(0, 800).toString("utf8");
  }
  if (flags.save && flags.save !== true) {
    const dest = resolveEvidencePath(state.evidenceDir, String(flags.save));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    payload.savedTo = dest;
  }
  if (!response.ok) {
    payload.hint = `HTTP ${response.status} from ${url.pathname}. Check the path against web/src/app. CSV files are /dados/csv/<uf> and /dados/csv/brasil.`;
  }
  return payload;
}

/** @param {Record<string, string | boolean>} flags @param {any} state */
function logs(flags, state) {
  const lines = readTail(state.logPath, numberFlag(flags, "tail", 80));
  /** @type {Record<string, unknown>} */
  const payload = { ok: true, runId: state.runId, path: state.logPath, lines };
  if (flags.save && flags.save !== true) {
    const dest = resolveEvidencePath(state.evidenceDir, String(flags.save));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, lines.join("\n") + "\n");
    payload.savedTo = dest;
    payload.hint = "The copy under evidence survives cleanup. The file at path does not.";
  }
  return payload;
}

/** @param {string} runId */
function evidenceDirFor(runId) {
  const paths = runPaths(runId);
  if (fs.existsSync(paths.stateFile)) {
    try {
      const state = readJson(paths.stateFile);
      if (state.evidenceDir) return state.evidenceDir;
    } catch {
      /* fall through to the stable path */
    }
  }
  return paths.evidenceDir;
}

/** @param {string[]} positionals @param {string} runId */
function evidence(positionals, runId) {
  const evidenceDir = evidenceDirFor(runId);
  const sub = positionals[1] || "path";
  if (sub === "path") {
    return {
      ok: true,
      runId,
      evidenceDir,
      hint: "cleanup does not delete this directory. evidence list still works after cleanup.",
    };
  }
  if (sub === "list") {
    /** @param {string} dir @param {string[]} out */
    const walk = (dir, out) => {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) walk(abs, out);
        else out.push(abs);
      }
    };
    /** @type {string[]} */
    const files = [];
    walk(evidenceDir, files);
    return {
      ok: true,
      runId,
      evidenceDir,
      files: files.map((file) => ({ path: file, bytes: fs.statSync(file).size })),
    };
  }
  throw new CliError("Unknown evidence subcommand.", "Use control-radar-mde evidence path or evidence list.");
}

/** @param {Record<string, string | boolean>} flags */
async function cleanup(flags) {
  const runId = runIdFrom(flags);
  const paths = runPaths(runId);
  const dryRun = Boolean(flags["dry-run"]);
  if (!fs.existsSync(paths.stateFile)) {
    return {
      ok: true,
      runId,
      alreadyClean: true,
      dryRun,
      evidenceDir: path.join(evidenceRoot(), runId),
      hint: "No state record. Evidence, if any, is left in place.",
    };
  }
  const state = readJson(paths.stateFile);
  const server = await stopProcessGroup(state.pid, state.expectCmd || EXPECT_NEXT, dryRun);
  /** @type {any} */
  let daemon = { killed: false, reason: "not-running" };
  if (fs.existsSync(paths.daemonFile)) {
    try {
      const info = readJson(paths.daemonFile);
      daemon = await stopProcessGroup(info.pid, EXPECT_DAEMON, dryRun);
    } catch {
      daemon = { killed: false, reason: "unreadable-record" };
    }
  }
  const wouldRemove = [paths.stateDir];
  if (!dryRun) fs.rmSync(paths.stateDir, { recursive: true, force: true });
  const evidenceDir = state.evidenceDir || path.join(evidenceRoot(), runId);
  return {
    ok: true,
    runId,
    dryRun,
    server,
    daemon,
    removed: dryRun ? [] : wouldRemove,
    wouldRemove: dryRun ? wouldRemove : [],
    evidenceDir,
    evidenceKept: true,
    hint: dryRun
      ? "Dry-run did not signal or delete. Run control-radar-mde doctor --run-id " + runId + " and confirm the server is still healthy, then cleanup without --dry-run."
      : "State and the browser profile were removed. Evidence is still at " + evidenceDir + ". Confirm with control-radar-mde evidence list only if you still have the run id; the directory is " + evidenceDir + ".",
  };
}

/** @param {string[]} argv */
export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    emit(toPayload(err));
    return 1;
  }
  const { positionals, flags } = parsed;
  if (flags.help || positionals.length === 0 || positionals[0] === "help") {
    process.stdout.write(helpFor(positionals[0] === "help" ? positionals.slice(1) : positionals));
    return 0;
  }
  const command = positionals[0];
  if (!commandNames.includes(command)) {
    emit({
      ok: false,
      error: `Unknown command ${JSON.stringify(command)}.`,
      hint: `Use one of: ${commandNames.join(", ")}. Run control-radar-mde --help.`,
    });
    return 1;
  }
  try {
    /** @type {any} */
    let payload;
    if (command === "launch") payload = await launch(flags);
    else if (command === "cleanup") payload = await cleanup(flags);
    else if (command === "evidence") payload = evidence(positionals, runIdFrom(flags));
    else {
      const runId = runIdFrom(flags);
      const paths = runPaths(runId);
      const state = loadState(paths.stateFile);
      if (command === "doctor") payload = await inspect(state);
      else if (command === "browser") payload = await browser(positionals, flags, state);
      else if (command === "seed") payload = await seed(positionals, flags, state);
      else if (command === "http") payload = await httpGet(positionals, flags, state);
      else if (command === "logs") payload = logs(flags, state);
      else {
        throw new CliError(`Unknown command ${command}.`, "Run control-radar-mde --help.");
      }
    }
    emit(payload);
    return payload.ok === false ? payload.exitCode ?? 1 : 0;
  } catch (err) {
    emit(toPayload(err));
    return err instanceof CliError ? err.code : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
