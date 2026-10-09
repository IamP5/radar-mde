# Phone navigation

On a narrow window the section links move to a second bar under the header, and Metodologia is shortened to Método. At the width this CLI uses, that bar is in the page and is not shown.

## Sub-features

- `phone-present` finds two Principal navigations when hidden elements count.
- `phone-hidden` finds one Principal navigation among what is visible.
- `phone-label` keeps the short label Método in the page and does not show it.
- `phone-tap` would activate a section from that second bar. It is not driven.

## How to get to it (user POV)

- Narrow the window below the desktop header. The sections wrap onto their own row under the title.
- Below 460 pixels wide, Metodologia is labeled Método. The other sections keep their names.
- The row scrolls sideways when the labels do not fit.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The viewport is fixed at 1440×900. There is no viewport flag.

- **Both bars are in the page.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser find --selector "nav[aria-label=\"Principal\"]" --include-hidden`. The count is 2.
- **Only the desktop bar is visible.** Run `./scripts/control-radar-mde browser find --selector "nav[aria-label=\"Principal\"]"`. The count is 1. Run `./scripts/control-radar-mde browser find --role navigation --name "Principal"`. The count is 1.
- **Método is present and not shown.** Run `./scripts/control-radar-mde browser find --selector "span:text-is(\"Método\")" --include-hidden`. The count is 2. Run `./scripts/control-radar-mde browser find --selector "span:text-is(\"Método\")"`. The count is 0.
- **Proof of what this window shows.** Run `./scripts/control-radar-mde browser screenshot --path phone-nav/desktop-bar.png` and `./scripts/control-radar-mde browser snapshot --aria --path phone-nav/desktop-bar.aria.txt`. The screenshot shows the Radar MDE header and the words `Metodologia`, not `Método`.

## Gotchas

- `phone-tap` is not verified. The attempted command `./scripts/control-radar-mde browser click --role link --name "Método" --exact` finds no visible link. The unmet precondition is a viewport narrower than 460 pixels. This CLI has no command to resize the window, and a click ignores elements that are not visible. `--force` would press a hidden label; that is not the phone bar a person sees.
- `browser find --role navigation --name "Principal" --include-hidden` still returns 1. Role queries skip the `display:none` bar. `--selector` with `--include-hidden` is what counts both bars. `--selector` is accepted by the CLI and is missing from `browser --help`.
- The two Principal bars share a name, so a click cannot pick the hidden one. The visible Principal navigation is the desktop bar.
- The desktop label `Metodologia` is the methodology recipe. It is not a substitute for `Método`.
