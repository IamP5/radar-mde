import { CliError } from "./errors.mjs";

export const WATCH_KEY = "radar-mde:watch";

const WATCH_ID = /^[a-z]{2}\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @param {string} id */
export function assertWatchId(id) {
  if (!WATCH_ID.test(id)) {
    throw new CliError(
      `Watch id ${JSON.stringify(id)} is not a uf/slug pair.`,
      "Pass --id sp/santo-andre. The id is the city path without the leading slash: /sp/santo-andre on screen becomes sp/santo-andre in radar-mde:watch.",
    );
  }
  return id;
}

/** @param {string | null | undefined} raw */
export function parseWatch(raw) {
  if (raw == null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}

/**
 * @param {string | null | undefined} raw
 * @param {string} id
 * @param {"add" | "remove"} mode
 */
export function nextWatch(raw, id, mode) {
  const list = parseWatch(raw).filter((item) => item !== id);
  if (mode === "add") list.push(id);
  return JSON.stringify(list);
}
