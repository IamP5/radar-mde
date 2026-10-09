/**
 * Options for Playwright's getByRole from a CLI message.
 * --include-hidden also matches elements outside the accessibility tree (display:none, aria-hidden),
 * such as the phone navigation at desktop width.
 *
 * @param {Record<string, unknown>} msg
 */
export function roleOptions(msg) {
  /** @type {{ name?: string | RegExp, exact?: boolean, level?: number, includeHidden?: boolean }} */
  const opts = {};
  if (typeof msg.nameRegex === "string" && msg.nameRegex) opts.name = new RegExp(msg.nameRegex, "i");
  else if (typeof msg.name === "string" && msg.name) opts.name = msg.name;
  if (msg.exact) opts.exact = true;
  if (msg.level) opts.level = Number(msg.level);
  if (msg.includeHidden) opts.includeHidden = true;
  return opts;
}

/**
 * Options for the --within-role ancestor.
 * @param {Record<string, unknown>} msg
 */
export function withinOptions(msg) {
  /** @type {{ name?: string | RegExp, exact?: boolean, includeHidden?: boolean }} */
  const opts = {};
  if (typeof msg.withinNameRegex === "string" && msg.withinNameRegex) opts.name = new RegExp(msg.withinNameRegex, "i");
  else if (typeof msg.withinName === "string" && msg.withinName) opts.name = msg.withinName;
  if (msg.withinExact) opts.exact = true;
  if (msg.includeHidden) opts.includeHidden = true;
  return opts;
}
