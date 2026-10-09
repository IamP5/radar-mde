# Phone navigation

On a narrow window the section links move to a second bar under the header, and Metodologia is shortened to Método. At the width this CLI uses, that bar is in the page and is not shown.

## Sub-features

- `phone-present` finds two Principal navigations when hidden ones count.
- `phone-hidden` finds one Principal navigation among what is visible.
- `phone-label` does not show the short label Método.
- `phone-tap` would activate a section from that second bar. It is not driven.

## How to get to it (user POV)

- Narrow the window below the desktop header. The sections wrap onto their own row under the title.
- Below 460 pixels wide, Metodologia is labeled Método. The other sections keep their names.
- The row scrolls sideways when the labels do not fit.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- The viewport is fixed at 1440×900. There is no viewport flag.

- **Both bars are in the page.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser find --role navigation --name "Principal" --include-hidden`. The count is 2.
- **Only the desktop bar is visible.** Run `./scripts/control-radar-mde browser find --role navigation --name "Principal"`. The count is 1.
- **Método is not shown.** Run `./scripts/control-radar-mde browser find --role link --name "Método" --exact --include-hidden`. The count is 0.
- **Proof of what this window shows.** Run `./scripts/control-radar-mde browser screenshot --path phone-nav/desktop-bar.png` and `./scripts/control-radar-mde browser snapshot --aria --path phone-nav/desktop-bar.aria.txt`. The screenshot shows the Radar MDE header and the words `Metodologia`, not `Método`.

## Gotchas

- `phone-tap` is not verified. The attempted command `./scripts/control-radar-mde browser click --role link --name "Método" --exact` finds no visible link. The unmet precondition is a viewport narrower than 460 pixels. This CLI has no command to resize the window, and a click ignores elements that are not visible.
- Passing `--include-hidden` does not make the two Principal bars distinguishable: they share the name `Principal`. A click that matches both is refused, and a click that matches the visible one is the desktop bar. Do not report that click as the phone bar.
- The desktop label `Metodologia` is the methodology recipe. It is not a substitute for `Método`.
