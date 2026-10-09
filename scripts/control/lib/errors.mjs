/** Failures the CLI can explain. `hint` tells the agent the next command to run. */
export class CliError extends Error {
  /**
   * @param {string} message
   * @param {string} hint
   * @param {number} [code]
   * @param {Record<string, unknown>} [extra]
   */
  constructor(message, hint, code = 1, extra = {}) {
    super(message);
    this.name = "CliError";
    this.hint = hint;
    this.code = code;
    this.extra = extra;
  }
}

/** @param {unknown} err */
export function toPayload(err) {
  if (err instanceof CliError) {
    return { ok: false, error: err.message, hint: err.hint, ...err.extra };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: false,
    error: message,
    hint: "Re-run the same command with --help. If a server was started, run control-radar-mde cleanup --run-id <id> --dry-run and then without --dry-run.",
  };
}
