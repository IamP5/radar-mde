# Phone navigation

On a narrow window the section links move to a second bar under the header, and Metodologia is shortened to Método. `browser viewport --preset phone` is 390×844, which is that window.

## Sub-features

- `phone-present` finds two Principal navigations when hidden elements count.
- `phone-hidden` finds one Principal navigation among what is visible at phone width.
- `phone-label` shows the short label Método on that bar.
- `phone-tap` opens Metodologia from Método.

## How to get to it (user POV)

- Narrow the window below the desktop header. The sections wrap onto their own row under the title.
- Below 460 pixels wide, Metodologia is labeled Método. The other sections keep their names.
- The row scrolls sideways when the labels do not fit.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.
- Run `./scripts/control-radar-mde browser viewport --preset phone`. The width is 390 and the height is 844. The phone bar is the visible Principal navigation.

- **Both bars are in the page.** Run `./scripts/control-radar-mde browser open /`. Run `./scripts/control-radar-mde browser find --selector "nav[aria-label=\"Principal\"]" --include-hidden`. The count is 2. Run `./scripts/control-radar-mde browser find --role navigation --name "Principal" --include-hidden`. The count is 2.
- **Only the phone bar is visible.** Run `./scripts/control-radar-mde browser find --role navigation --name "Principal"`. The count is 1. Run `./scripts/control-radar-mde browser find --role link --name "Método" --exact`. The count is 1.
- **Tap Método.** Run `./scripts/control-radar-mde browser click --role link --name "Método" --exact --timeout 90000`. The click's JSON `url` path is `/sobre` and `navigated` is true. A level-1 heading named `Metodologia` is visible: `./scripts/control-radar-mde browser wait --role heading --name "Metodologia" --exact --level 1`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path phone-nav/metodo.png` and `./scripts/control-radar-mde browser snapshot --aria --path phone-nav/metodo.aria.txt`. The screenshot shows the Radar MDE header and `Metodologia`.
- **Restore the desktop window.** Run `./scripts/control-radar-mde browser viewport --preset desktop`. The width is 1440 and the height is 900.

## Gotchas

- The two Principal bars share a name. At phone width the visible one is the second bar, so `Método` is one match. At 1440×900 that link is not visible and the same click is refused.
- The desktop label `Metodologia` is the methodology recipe. It is not a substitute for `Método`.
- The viewport stays at phone size until `--preset desktop`. Later recipes assume 1440×900, so this recipe sets desktop again before it ends.
