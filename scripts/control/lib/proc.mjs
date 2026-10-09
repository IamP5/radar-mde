import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { CliError } from "./errors.mjs";

/** @param {number} pid */
export function alive(pid) {
  if (!pid) return false;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const state = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0];
    // A zombie is already dead; the parent just has not reaped it. Signaling again will not remove it.
    if (state === "Z") return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** @param {number} pid */
export function cmdline(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ").trim();
  } catch {
    return "";
  }
}

/** @param {number} pid @param {string} expectCmd */
export function cmdlineMatches(pid, expectCmd) {
  if (!expectCmd) return false;
  return cmdline(pid).includes(expectCmd);
}

/** @param {number} pid */
function statFields(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
  return stat.slice(stat.lastIndexOf(")") + 2).split(" ");
}

/** @param {number} pid */
export function ppidOf(pid) {
  try {
    return Number(statFields(pid)[1]);
  } catch {
    return 0;
  }
}

/** @param {number} pid */
export function processGroup(pid) {
  try {
    return Number(statFields(pid)[2]);
  } catch {
    return 0;
  }
}

/** Process ids in `root`'s tree, including `root`. */
export function descendants(root) {
  const all = new Set([root]);
  /** @type {Map<number, number>} */
  const parent = new Map();
  let entries = [];
  try {
    entries = fs.readdirSync("/proc");
  } catch {
    return all;
  }
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    const pid = Number(name);
    const ppid = ppidOf(pid);
    if (ppid) parent.set(pid, ppid);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [pid, ppid] of parent) {
      if (all.has(ppid) && !all.has(pid)) {
        all.add(pid);
        grew = true;
      }
    }
  }
  return all;
}

/** @param {number} port */
export function listeningPids(port) {
  let out = "";
  try {
    out = execFileSync("ss", ["-H", "-ltnp", `sport = :${port}`], { encoding: "utf8" });
  } catch (err) {
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    throw new CliError(
      `Could not inspect listeners on port ${port} (${stderr.trim() || "ss failed"}).`,
      "Install iproute2 (the ss command) and re-run control-radar-mde doctor. Do not guess which process owns the port.",
    );
  }
  return [...out.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
}

/**
 * @param {string} host
 * @param {number} port
 */
export function portFree(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * @param {string} host
 * @param {number} start
 * @param {number} [count]
 */
export async function findFreePort(host, start, count = 50) {
  for (let port = start; port < start + count; port++) {
    if (await portFree(host, port)) return port;
  }
  throw new CliError(
    `No free TCP port on ${host} between ${start} and ${start + count - 1}.`,
    "Pass --port with an explicit free port, or stop another verification run with control-radar-mde cleanup --run-id <id>.",
  );
}

/**
 * @param {number} pid
 * @param {string} expectCmd
 * @param {boolean} dryRun
 */
export async function stopProcessGroup(pid, expectCmd, dryRun) {
  if (!pid || !alive(pid)) return { killed: false, reason: "not-running" };
  const line = cmdline(pid);
  if (!cmdlineMatches(pid, expectCmd)) {
    return {
      killed: false,
      reason: "pid-reused",
      cmdline: line,
    };
  }
  const leader = processGroup(pid) === pid;
  if (dryRun) return { killed: false, dryRun: true, pid, cmdline: line, processGroupLeader: leader };
  const signal = (sig) => {
    if (leader) {
      try {
        process.kill(-pid, sig);
        return;
      } catch {
        /* not a group we can signal; fall through to the tree */
      }
    }
    const ids = [...descendants(pid)].filter((id) => id !== pid);
    for (const id of [...ids, pid]) {
      try {
        process.kill(id, sig);
      } catch {
        /* already gone */
      }
    }
  };
  signal("SIGTERM");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && alive(pid)) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (alive(pid)) signal("SIGKILL");
  return { killed: !alive(pid), pid, cmdline: line, processGroupLeader: leader };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env: NodeJS.ProcessEnv, logPath: string }} opts
 */
export function spawnDetached(command, args, opts) {
  fs.mkdirSync(path.dirname(opts.logPath), { recursive: true });
  const logFd = fs.openSync(opts.logPath, "a");
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  fs.closeSync(logFd);
  if (!child.pid) {
    throw new CliError("The process did not receive a pid.", "Retry the command. If it keeps failing, inspect the log path printed by the error.");
  }
  return child.pid;
}

/** @param {string} file @param {number} tail */
export function readTail(file, tail) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/).filter((line, i, arr) => line.length || i < arr.length - 1);
  return lines.slice(-tail);
}
