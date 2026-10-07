# Design-system contract (W5) for W2–W4

All tokens live in `web/src/app/globals.css`; Tailwind utilities exist for each (`text-critical-ink`, `bg-bin-zero`, …).

## New tokens
| token | light | dark | use |
|---|---|---|---|
| `--critical-ink` (`text-critical-ink`) | `#c0262d` | `#ff6166` | **Any critical-colored text** (badges, delta pills, "−4,0 p.p." diffs). `text-critical` on `bg-critical-soft` fails AA (4.27:1); `text-critical-ink` is 5.3:1 / 6.1:1. `text-critical` stays OK for ≥ 18px values and for dots/strokes. |
| `--bin-zero` (`bg-bin-zero`) | `#f4f3f0` | `#1c1c1a` | "0% / nenhum" step of share maps (SHARE_BINS s0). Draw with a hairline stroke (`var(--axis)`) on maps. |

## Changed values (names unchanged)
- `--bin-1..5`, `--bin-nd`: light `#b42727 #e27371 #d1cfc8 #5598e7 #1c5cab`, nd `#ebebeb`; dark `#e66767 #ad4543 #383835 #2a78d6 #6da7ec`, nd `#232323`.
  Neighbours ≥ 1.9:1 apart (light) / ≥ 1.75:1 (dark); light steps ≥ 1.56:1 vs card. bin-1 and bin-5 still have similar
  luminance (diverging scale): below-minimum classes need the redundant mark (outline/hatch) — W3 `isBelowBin`.
  Text on fills: bin-1/bin-5 → white (light) / black (dark); bin-2/3/4 → ink (light); bin-2/bin-4 → white (dark). Contrast ≥ 4.4:1.
- `--red-1..5` (light `#efaeac #e27371 #cd4a48 #a32828 #6a1616`, dark `#6b3533 #9a403e #c4504e #e57e7c #f8bfbd`):
  ≥ 1.45:1 between steps, red-1 ≥ 1.67:1 from `--bin-zero`.
- `--series-1..5` light: `#2a78d6 #d0571f #249c74 #b77610 #c4507f` (all ≥ 3:1 on white; dataviz validator PASS:
  adjacent CVD ΔE ≥ 9.9, normal ΔE ≥ 17.2). Dark unchanged (already PASS). 5 series fail the *all-pairs* gate
  in any palette, so multi-line charts with > 3 series still need dash/direct labels (A11Y-04, W3).

## Global behaviour you get for free
- `html { scroll-padding-top }` = header + sticky sub-bar. Sub-bars are detected by the class `top-(--header-h)`
  or a `data-subbar` attribute — add `data-subbar` to a sticky context bar if you change its classes.
- `@media (max-height: 30rem)`: header and sub-bars become static (A11Y-06).
- Recharts / svg: no focus ring on mouse/touch focus, ring kept on `:focus-visible` (CIT-04).
- Forced colors: any element with an inline `style` background (swatches, bars), `[data-swatch]`, `.recharts-surface`
  and `svg[role=img]` keep their colors (`forced-color-adjust: none`); selected `[role=radio][aria-checked=true]`,
  `[role=tab][aria-selected=true]`, `[aria-pressed=true]`, `[role=option][aria-selected=true]` get a `Highlight` outline.
  If a swatch uses a class (`bg-bin-1`) instead of inline style, add `data-swatch` or `forced-color-adjust-none`.
- Utilities: `fade-b` (bottom fade for in-card scroll lists, VIS-04), `fade-x` (edge fade for horizontal scrollers like
  YearPicker / mobile nav, VIS-07).
- `outline-ring/50` was removed from the `*` base rule; focus is the single `:focus-visible` 2px brand outline.

## Print (`@media print`)
- Always light theme (the `dark:` variant and `.dark` tokens are screen-only).
- Hidden automatically: site header, skip link, footer nav + theme switcher, every shadcn `Button` (`data-slot=button`),
  `role=radiogroup` (Segmented, YearPicker, ThemeSwitcher), `role=tablist`, `textarea`.
- Sticky bars become static; in-card scrollers (`overflow-*`, `max-h-*`, table containers) expand; tables are
  full-width, 0.75rem, header row repeats; `section` (Panel), charts and maps avoid page breaks.
- Use `print:hidden` for anything else that is a control (links styled as buttons, share/watch menus, action kit),
  and `print-only` (class) or `hidden print:block` for print-only notes.
- `PageHeader` prints a line with the page URL and print date (`kit/print-meta.tsx`).

## Kit API changes
- `EmptyState` no longer has `role="status"` by default. Pass `live` for async results/errors; pass `icon` to render
  the icon above the title (VIS-08).
- `Panel` `action` slot can now shrink/wrap (`min-w-0 max-w-full flex-wrap`), so a wide legend in `action` wraps
  instead of overflowing (VIS-02).
- `Stat`/`DeltaPill`: delta pill never wraps; spark sits flush at the bottom; critical tone uses `critical-ink`.
