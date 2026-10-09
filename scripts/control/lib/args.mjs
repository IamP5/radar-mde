import { CliError } from "./errors.mjs";

const BOOL = new Set([
  "help",
  "dry-run",
  "exact",
  "full-page",
  "headed",
  "include-hidden",
  "force",
  "aria",
  "expect-nav",
  "clear",
  "fail-on-status",
  "within-exact",
]);

/**
 * @param {string[]} argv
 * @returns {{ positionals: string[], flags: Record<string, string | boolean> }}
 */
export function parseArgs(argv) {
  const positionals = [];
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (BOOL.has(body) || next == null || next.startsWith("--")) {
      flags[body] = true;
    } else {
      flags[body] = next;
      i++;
    }
  }
  return { positionals, flags };
}

/** @param {Record<string, string | boolean>} flags @param {string} name @param {number} fallback */
export function numberFlag(flags, name, fallback) {
  if (flags[name] == null || flags[name] === true) return fallback;
  const n = Number(flags[name]);
  if (!Number.isFinite(n) || n < 0) {
    throw new CliError(
      `--${name} must be a non-negative number, received ${JSON.stringify(flags[name])}.`,
      `Example: --timeout 180000 or --port 4173 or --tail 80. Run control-radar-mde --help.`,
    );
  }
  return n;
}

/** @param {Record<string, string | boolean>} flags @param {string} name */
export function stringFlag(flags, name) {
  const v = flags[name];
  if (v == null || v === true) return "";
  return String(v);
}
