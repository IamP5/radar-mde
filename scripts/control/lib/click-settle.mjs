/**
 * Decide before a click whether it should navigate, from plain values read off the clicked node.
 * A same-origin link to another path or query navigates. So does a search result inside the dialog,
 * which routes after the dialog closes. A link to the current page, a hash, a download, a new tab,
 * or another origin does not move this page.
 *
 * @param {{ href?: string | null, target?: string | null, download?: boolean, role?: string | null, inDialog?: boolean, current: string }} node
 * @returns {boolean}
 */
export function expectsNavigation(node) {
  if (node.href) {
    if (node.download) return false;
    if (node.target && node.target !== "_self") return false;
    let url;
    try {
      url = new URL(node.href, node.current);
    } catch {
      return false;
    }
    const here = new URL(node.current);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.origin !== here.origin) return false;
    return url.pathname + url.search !== here.pathname + here.search;
  }
  return node.role === "option" && Boolean(node.inDialog);
}

/**
 * After a click, decide whether to keep waiting for the URL.
 * A click that should navigate waits for the URL to change, up to the click's budget.
 * Any other click settles after 400 ms, whether or not the control renamed, unmounted, or went behind a dialog.
 *
 * @param {{ expectNav: boolean, urlChanged: boolean, elapsedMs: number, budgetMs: number }} state
 * @returns {"done" | "wait"}
 */
export function clickSettle(state) {
  if (state.urlChanged) return "done";
  if (state.elapsedMs >= state.budgetMs) return "done";
  if (!state.expectNav && state.elapsedMs >= 400) return "done";
  return "wait";
}

/**
 * One deadline for a whole daemon operation, so actionability, settle, and trailing waits share --timeout.
 * @param {number} timeoutMs
 * @param {() => number} [now]
 */
export function budget(timeoutMs, now = Date.now) {
  const deadline = now() + timeoutMs;
  return {
    deadline,
    left: () => Math.max(1, deadline - now()),
    spent: () => now() >= deadline,
  };
}
