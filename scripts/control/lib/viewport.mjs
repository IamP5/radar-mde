import { CliError } from "./errors.mjs";

/** Phone is narrower than the 460 px breakpoint where Metodologia becomes Método. */
export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

export const DEFAULT_VIEWPORT = { preset: "desktop", ...VIEWPORTS.desktop };

/**
 * @param {{ preset?: string, width?: string, height?: string }} input
 * @returns {{ preset: string | null, width: number, height: number } | null} null when nothing was asked
 */
export function resolveViewport(input) {
  const preset = input.preset || "";
  const hasSize = Boolean(input.width || input.height);
  if (!preset && !hasSize) return null;
  if (preset && hasSize) {
    throw new CliError(
      "Pass --preset or --width/--height, not both.",
      "Example: browser viewport --preset phone, or browser viewport --width 375 --height 812.",
    );
  }
  if (preset) {
    const size = VIEWPORTS[/** @type {keyof typeof VIEWPORTS} */ (preset)];
    if (!size) {
      throw new CliError(
        `Unknown viewport preset ${JSON.stringify(preset)}.`,
        `Use one of: ${Object.entries(VIEWPORTS).map(([k, v]) => `${k} (${v.width}×${v.height})`).join(", ")}. Or pass --width and --height.`,
      );
    }
    return { preset, ...size };
  }
  const width = Number(input.width);
  const height = Number(input.height);
  for (const [name, n] of [["width", width], ["height", height]]) {
    if (!Number.isInteger(n) || n < 200 || n > 4000) {
      throw new CliError(
        `--${name} must be a whole number of pixels between 200 and 4000, received ${JSON.stringify(input[/** @type {"width" | "height"} */ (name)] ?? "")}.`,
        "Pass both, for example browser viewport --width 375 --height 812, or use --preset phone.",
      );
    }
  }
  return { preset: null, width, height };
}
