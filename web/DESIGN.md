# Radar MDE design system (Vercel / Geist look, shadcn/ui on Base UI)

Read this before touching UI. Tokens live in `src/app/globals.css`.

## Principles
- Flat, quiet, precise. Hairline borders (`border`), no gradients, no glows, no grid backgrounds, no pulsing.
- Page = white `PageHeader` band (title + one-line muted description + actions) on top of the gray canvas (`bg-canvas`, #fafafa / #000); content in `PageBody` (max-w-7xl, px-4 sm:px-6, space-y-6).
- Cards = `Panel` (rounded-xl border bg-card, 15px semibold title, 13px muted description). Never nest panels. Use `divided` when the body is a table/chart that runs edge to edge.
- Text: `text-foreground` (primary), `text-muted-foreground` (secondary). Sentence case, never all-caps eyebrows. Numbers `tnum`. Geist Mono (`font-mono`) only for identifiers: IBGE codes, UF siglas in chips, ⌘K, years in compact chips, source metadata.
- Type: page title 24→32px semibold tracking-[-0.04em]; section 20px semibold -0.02em; card title 15px semibold; KPI value 26–28px semibold tracking-[-0.04em] tnum; label 13px muted; body 14–15px.
- Colors: brand blue `text-brand` / `bg-brand` / `text-brand-ink` (links); status `good`, `warning`, `critical` (+ `-soft` tints, `-ink` text). Text in a status color always uses the `-ink` token (`text-critical-ink`, `text-good-ink`, `text-warning-ink`); the plain token is for dots, strokes and ≥ 18px values. Never dim colored text with `opacity-*`. `bg-accent` = hover gray. `bg-muted` = gray track. Data: `--bin-1..5` diverging MDE, `--series-1..5` categorical (fixed order), `--seq-1..5`, `--red-1..5`, `--grid` gridlines, `--axis` baselines, `--ink` emphasis line.
- Status: `StatusDot` / `StatusBadge` from `@/components/kit/status` (ok=good, edge=warning, below=critical, nd=gray). Always with a label.
- Controls: `Segmented` from `@/components/kit/segmented` for 2–5 mutually exclusive options; shadcn `Button` (variant outline / ghost / secondary, size sm) for actions; shadcn `Badge`, `Tooltip`, `DropdownMenu`, `Popover`, `Select`, `Input`, `Table`, `Tabs`, `Skeleton`, `Command`, `Dialog`, `Sheet`, `Kbd` in `@/components/ui/*` (Base UI flavored: use `render` prop instead of `asChild`; read the component file before using).
- KPI: `Stat` from `@/components/kit/stat` (label, value, delta pill with tone, sub, context, optional `spark` flush at bottom).
- Empty/loading: `EmptyState` or `Skeleton` with the final geometry.
- Icons: lucide-react, size-4 (size-3.5 in dense UI), `text-muted-foreground`.
- Motion: 150ms color transitions; popovers 150–200ms ease-out; charts `isAnimationActive={false}`.
- Sticky sub-bars go under the site header: `sticky top-(--header-h) z-30`.
- Hover rows: `hover:bg-accent/60`; table header `h-10 text-[13px] font-medium text-muted-foreground`, numeric columns right-aligned tnum.

## Charts (shadcn chart = Recharts v3)
- `ChartContainer` + `ChartTooltip`/`ChartTooltipContent` from `@/components/ui/chart`, config colors `var(--series-n)` etc. Always give ChartContainer a height (`h-[260px] w-full aspect-auto`).
- Horizontal grid only (`<CartesianGrid vertical={false} />`), no axis lines or tick lines, 12px muted ticks, tickMargin 8, 3–5 y ticks.
- Lines 2px `type="linear"` (annual data), no dots except active dot r=4 with background-colored 2px stroke; area fill gradient 0.2 → 0.
- 25% minimum: dashed `ReferenceLine` in foreground with a small label.
- Context series (Brasil / parent) in `var(--ink)` dashed or thin; siblings gray.
- Legend: direct labels at line end when ≤4 series, otherwise `ChartLegendContent`.
- Export: every main chart/map Panel gets `ChartActions` (`@/components/kit/chart-actions`) in its `action` slot (PNG, SVG, CSV of its rows, citation). Its `title` is drawn on the image, so make it self-explanatory (metric, place, years).
- Tooltip: shadcn content with `indicator="line"`, values formatted pt-BR.

## Data colors (validated)
- Categorical `--series-1..5` (fixed order: blue, orange, green, amber, pink) are validated with the dataviz validator
  (`validate_palette.js`, light surface `#ffffff`, dark `#0a0a0a`): every slot ≥ 3:1 on the card, adjacent CVD ΔE ≥ 8,
  normal-vision ΔE ≥ 15. No 5-hue palette passes the all-pairs gate, so > 3 simultaneous series also need a second
  channel (dash pattern, end labels, highlight-one/grey-the-rest).
- Diverging `--bin-1..5` (MDE around 25%) and sequential `--red-1..5` / `--seq-1..5`: neighbouring steps ≥ 1.45:1
  luminance apart, light steps ≥ 1.5:1 vs the card where possible. `--bin-zero` is the "0% / nenhum" step (outline it on maps),
  `--bin-nd` is "sem dados". bin-1 and bin-5 share luminance (diverging): below-minimum classes always get a redundant
  mark (outline/hatch) so they survive grayscale, print and CVD. Dark mode has its own selected steps.
- If you change any data color, re-run the validator and the contrast numbers; record them in `globals.css` comments.

## Accessibility & print
- Focus: one rule, `:focus-visible` 2px `--brand` outline. Recharts/svg internals never show a ring on mouse/touch focus.
- Sticky bars: site header + context bar (`sticky top-(--header-h)` and `data-subbar`). `html` reserves
  `scroll-padding-top` for both, so focused elements never hide under them; at `max-height: 30rem` (zoom/short screens)
  they become static.
- Targets: interactive controls ≥ 24px tall (`h-7` minimum in dense UI, `size-8` icon buttons).
- Forced colors: swatches/bars with inline `background` keep their color automatically; for class-colored swatches add
  `data-swatch` or `forced-color-adjust-none`. Selected states (radio, tab, pressed, option) get a `Highlight` outline globally.
- Text sizes in rem (`text-[0.8125rem]`, not `text-[13px]`) so browser text zoom keeps the hierarchy.
- In-card scrollers: `fade-b` (vertical lists) / `fade-x` (horizontal tracks) show that more content exists.
- `EmptyState`: `live` only for async results/errors; `icon` renders above the title.
- Print (`@media print`, A4): always light; site header, skip link, footer nav, theme switcher, `Button`s,
  radiogroups/tablists and textareas are hidden; sticky bars static; scrollers/tables expanded with repeating header;
  panels may split, but charts, maps, KPI cards and table rows don't, and a panel header stays with its body; charts fit their box (never taller than the container); numeric cells in data tables don't wrap. `PageHeader` prints URL + print date (`kit/print-meta.tsx`).
  Mark any other control `print:hidden`; print-only notes use `.print-only` or `hidden print:block`.

## /mapa (immersive view)
Deliberate exception to the flat document look: a full-bleed map with floating glass panels (`src/components/mapa/`).
It brings its own chrome (the site header/footer are hidden by `ChromeGate`) and follows the app theme (`.dark` on `<html>`;
a sun/moon button in its top bar). `mapa.css` scopes its tokens to `.mapa-shell` (light) and `.dark .mapa-shell`, unlayered so
they beat the global ones: `--m-ink` for text/hairlines (mix it, `text-(--m-ink)/60`; never hard-code white/black),
`--m-on-strong` + `--m-halo` for labels over fills, and a data palette per mode (red below 25%, a neutral "no limite" 25–26%,
blue above; the stronger the step, the further from 25% — brighter in dark, deeper in light).
- Navigation lives in the map: click state → fly (van Wijk smooth zoom, 600–1000 ms) → click city → drawer (‹ › walk the
  state's ranking). Place in the URL hash, view in the query. State labels and callouts are buttons (keyboard: Tab + Enter).
- The drawer, legend, rankings and charts follow the active indicator. R$ por aluno is in R$ of IPCA_BASE with fixed classes;
  "Anos abaixo" accumulates up to the chosen year and can leave out 2020–21 (EC 119, also shaded on charts and timeline).
- Every municipality below the minimum gets a marker; when there are many (2020–21) only the 30 lowest pulse, 3 times.
- Performance rule: never dim thousands of paths with `opacity` (offscreen buffer per path, ~30 ms/frame); use `fill-opacity`.
  The camera moves one `<g>`; labels, callouts and pulse markers are screen-space HTML placed per frame.
- Year changes run on one clock, `--m-step` (0.6 s): fills crossfade, markers pop in or fade out, chips/labels recolour,
  timeline thumb + fill, chart playhead, legend/ranking bars and counts all glide together. Play advances one year per
  `BEAT` (1.5 s, a ring on the play button shows it) as a React transition; nothing pulses while playing (the pulse returns
  on the year it stops), panels never remount or change height per year (`Reveal` for notes that come and go), and tweened
  numbers are leaf `<Num>` components. Fills are written only when a path's class changes, big batches over ≤ 4 frames.
- Motion respects `prefers-reduced-motion` (no fly, no pulse, no tweens, no glides).
