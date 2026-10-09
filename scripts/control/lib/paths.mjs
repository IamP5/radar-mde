import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./errors.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (two levels above scripts/control/lib). */
export const repoRoot = path.resolve(here, "../../..");
export const controlDir = path.resolve(here, "..");
export const webDir = path.join(repoRoot, "web");

export function stateRoot() {
  return process.env.RADAR_VERIFY_STATE_ROOT || "/tmp/radar-mde-verify";
}

export function evidenceRoot() {
  return process.env.RADAR_VERIFY_EVIDENCE_ROOT || "/tmp/radar-mde-verify-evidence";
}

/** @param {string} id */
export function assertRunId(id) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(id)) {
    throw new CliError(
      `Run id ${JSON.stringify(id)} is not safe to use as a directory name.`,
      "Use the runId printed by control-radar-mde launch (letters, digits, dot, underscore, hyphen).",
    );
  }
  return id;
}

/** @param {Record<string, string | boolean>} flags */
export function runIdFrom(flags) {
  const raw = flags["run-id"];
  const fromFlag = raw && raw !== true ? String(raw) : "";
  const id = fromFlag || process.env.RADAR_VERIFY_RUN_ID || "";
  if (!id) {
    throw new CliError(
      "No run id was given.",
      "Run control-radar-mde launch and pass its runId as --run-id <id> (or set RADAR_VERIFY_RUN_ID). Do not drive a server you did not start.",
    );
  }
  return assertRunId(id);
}

/** @param {string} runId */
export function runPaths(runId) {
  const stateDir = path.join(stateRoot(), runId);
  const evidenceDir = path.join(evidenceRoot(), runId);
  if (isInside(evidenceDir, stateDir) || path.resolve(evidenceDir) === path.resolve(stateDir)) {
    throw new CliError(
      "The evidence directory is inside the state directory, so cleanup would delete proof.",
      "Set RADAR_VERIFY_EVIDENCE_ROOT to a directory that is not under RADAR_VERIFY_STATE_ROOT.",
    );
  }
  return {
    runId,
    stateDir,
    evidenceDir,
    stateFile: path.join(stateDir, "state.json"),
    logPath: path.join(stateDir, "next.log"),
    profileDir: path.join(stateDir, "profile"),
    socketPath: path.join(stateDir, "browser.sock"),
    daemonFile: path.join(stateDir, "daemon.json"),
    daemonLog: path.join(stateDir, "browser.log"),
    daemonError: path.join(stateDir, "daemon.error"),
    readyFile: path.join(stateDir, "daemon.ready"),
    lockFile: path.join(stateDir, "daemon.lock"),
    pageUrlFile: path.join(stateDir, "page-url.txt"),
    viewportFile: path.join(stateDir, "viewport.json"),
  };
}

/** @param {string} child @param {string} parent */
export function isInside(child, parent) {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  return c.startsWith(p + path.sep);
}

/**
 * Resolve a screenshot/snapshot path. Relative paths stay under the evidence dir.
 * @param {string} evidenceDir
 * @param {string} requested
 */
export function resolveEvidencePath(evidenceDir, requested) {
  if (!requested) {
    throw new CliError(
      "A --path is required.",
      "Pass --path <file> relative to this run's evidence directory, for example save-municipality/list.png. Absolute paths are kept as given and cleanup never deletes them.",
    );
  }
  if (requested.includes("\0")) {
    throw new CliError("The path contains a NUL byte.", "Pass a normal relative path such as save-municipality/list.png.");
  }
  if (path.isAbsolute(requested)) return requested;
  const abs = path.resolve(evidenceDir, requested);
  if (!isInside(abs, evidenceDir) && abs !== path.resolve(evidenceDir)) {
    throw new CliError(
      `Path ${requested} escapes the evidence directory.`,
      "Use a relative path without .., or an absolute path you intend to keep. Evidence lives outside the state directory so cleanup can remove the server without deleting proof.",
    );
  }
  return abs;
}

export function gitRevision() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/** @param {string} file */
export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** @param {string} file @param {unknown} value */
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
