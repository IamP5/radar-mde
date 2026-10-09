/**
 * After a click, decide whether the URL has settled.
 * A link stays in the old document until the next page commits, so keep waiting.
 * A control that unmounts (a search option, once the dialog closes) is about to navigate; keep waiting.
 * A control that stays and does not change the URL (opening a menu) is done after a short settle.
 *
 * @param {{ href: string, urlChanged: boolean, stillThere: boolean, elapsedMs: number, timeoutMs: number }} state
 * @returns {"done" | "wait"}
 */
export function clickSettle(state) {
  if (state.urlChanged) return "done";
  if (state.elapsedMs >= state.timeoutMs) return "done";
  if (!state.href && state.elapsedMs >= 400 && state.stillThere) return "done";
  return "wait";
}
