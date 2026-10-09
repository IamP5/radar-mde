// Lets `node --experimental-strip-types` load src/ as Next does: the "@/" alias, extensionless .ts imports, and
// JSON imports without an import attribute. server-only is not stubbed, so a test that reaches a server module fails.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  let url = specifier.startsWith("@/") ? new URL(specifier.slice(2), src).href : specifier;
  if ((url.startsWith(".") || url.startsWith("file:")) && !/\.([cm]?[jt]sx?|json)$/.test(url)) {
    const abs = new URL(url, context.parentURL);
    if (existsSync(`${fileURLToPath(abs)}.ts`)) url = `${abs.href}.ts`;
  }
  const resolved = await next(url, context);
  return resolved.url.endsWith(".json") ? { ...resolved, importAttributes: { type: "json" } } : resolved;
}
