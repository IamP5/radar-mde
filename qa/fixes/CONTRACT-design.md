# Design-system contract (W5) for W2–W4

All tokens live in `web/src/app/globals.css`; Tailwind utilities exist for each (`text-critical-ink`, `bg-bin-zero`, …).

## New tokens
| token | light | dark | use |
|---|---|---|---|
| `--critical-ink` (`text-critical-ink`) | `#c0262d` | `#ff6166` | **Any critical-colored text** (badges, delta pills, "−4,0 p.p." diffs). `text-critical` on `bg-critical-soft` fails AA (4.27:1); `text-critical-ink` is 5.3:1 / 6.1:1. `text-critical` stays OK for ≥ 18px values and for dots/strokes. |
| `--bin-zero` (`bg-bin-zero`) | `#f4f3f0` | `#1c1c1a` | "0% / nenhum" step of share maps (SHARE_BINS s0). Draw with a hairline stroke (`var(--axis)`) on maps. |

## Changed values (names unchanged)
- `--bin-1..5`, `--bin-nd`: light `#b42727 #e27371 #d1cfc8 #5598e7 #1c5cab`, nd `#ebebeb`; dark `#e66767 #ad4543 #383835 #2468bd #6da7ec`, nd `#232323`.
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
  Wave 2: class-colored meters/rank bars: put `data-track` on the gray track (gets a CanvasText outline) and `data-bar`
  on the fill (painted `Highlight`), e.g. the city "Posição" percentile bar (A11Y-05).
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

## Wave 2 · `ChartActions` (JOR-04) — `@/components/kit/chart-actions`
Export menu for a chart or map, placed in the Panel `action` slot. It is a ghost icon button (32px, download icon,
`aria-label="Exportar: <title>"`, hidden in print). The menu has:
- **Imagem PNG** (2×) and **Imagem SVG (editável)**: the chart's own `<svg>` with a title and a source footer
  ("Fonte: FNDE/SIOPE. Radar MDE · Brasil — <SITE_URL + path + query>") drawn in. Every computed style is inlined, so
  `var(--series-n)`, classes and the current theme resolve, and the background is the panel color. HTML legends
  outside the svg are not included, so put anything essential in `title` or `note`.
- **Dados em CSV** / **Dados em CSV (Excel Brasil)**: from `csv` (uses `toCsv`, BOM, `;` and decimal comma for Excel).
  The CSV items are hidden when `csv` is omitted.
- **Copiar citação**: `Radar MDE (<ano atual>). <title>. <SITE_URL><path>?<query>. Fonte: <source>. Acesso em dd/mm/aaaa.`
  (also exported as `citation(title, source?)`). A sr-only `role=status` announces "Citação copiada" / "PNG baixado".

```tsx
import { ChartActions } from "@/components/kit/chart-actions";

<Panel
  title="% da receita aplicado em educação (MDE)"
  action={
    <ChartActions
      title={`% da receita de impostos aplicado em MDE — ${c.name} (${c.uf}), 2008–2025`}
      filename={[slug, "mde"]}                       // → radar-mde_santo-andre_mde.png / .svg / .csv
      csv={{ columns: ["ano", "mde_pct", "mediana_uf_pct"], rows: years.map((y, i) => ({ ano: y, mde_pct: v[i], mediana_uf_pct: m[i] })) }}
      note="Valores declarados ao SIOPE; R$ nominais."   // optional extra footer line
      // svgSelector=".recharts-surface"               // optional: which svg in the Panel (default: largest non-icon svg)
      // getSvg={() => ref.current?.querySelector("svg") ?? null}  // optional explicit lookup
      // source="FNDE/SIOPE e Tesouro/SICONFI"         // default "FNDE/SIOPE"
    />
  }
>
  <TrendChart … />
</Panel>
```
- The svg is found inside the closest `<section>` (the Panel) around the button. With two charts in one Panel, pass
  `svgSelector` or `getSvg`.
- Rows are `Record<string, string | number | null>`. Use CSV column names from `lib/csv.ts` (`ano`, `mde_pct`,
  `fundeb_pessoal_pct`, `por_aluno_rs`, `faltou_rs`, …) when they fit, so the vocabulary matches `/dados`.
- Maps (Choropleth) work too: patterns and hatches live inside the svg's `<defs>` and are exported.

## Wave 2 · other changes
- `PageHeader`: title and actions sit side by side only from `lg` (1024px), and the actions wrap (max 50% width). Below
  `lg` the actions go under the title (VIS-12).
- Print: whole panels may now split across pages. Charts, maps, KPI cards (`div.rounded-xl.border`) and table rows don't
  split, and a Panel header stays with its body. Numeric table cells (`text-right` / `tnum`) never wrap (GOV-22, VIS-10).
- Dark `--bin-4` is now `#2468bd` (white text 5.5:1, A11Y-19).
- `Segmented` and `StatusBadge` use `min-h-*` and rem sizes so they grow with text zoom (A11Y-15).

## Wave 3 · `ChartActions` additions
- **`legend?: ChartLegendItem[]`**: drawn under the chart in the PNG/SVG, as a wrapped row of marker + label.
  ```ts
  type ChartLegendItem = { label: string; color: string; kind?: "line" | "swatch" | "dot" | "ring" | "hatch"; dash?: string | boolean };
  // e.g. [{ label: "Santo André", color: "var(--series-1)" },
  //       { label: "Mediana SP", color: "var(--series-2)", dash: "1 3" },
  //       { label: "mínimo 25%", color: "var(--foreground)", dash: true },
  //       { label: "fora do padrão", color: "var(--warning)", kind: "ring" }]
  // maps: bins.map(b => ({ label: b.label, color: b.color, kind: "swatch" })) + { label: "Não declarou", color: "var(--critical)", kind: "hatch" }
  ```
  - `color` may be any CSS color, including `var(--x)` or `color-mix()`. It is resolved against the panel, so it
    follows the theme.
  - Without `legend`, the Panel's on-screen legend is collected automatically: each `li` outside the chart svg whose
    first marker is `aria-hidden` (a span swatch or line, or a small svg line/circle) followed by its text.
    Pass `legend={[]}` for no legend.
- **Footer** is never clipped: "Fonte: … Radar MDE · Brasil." is on one line, then the page URL on its own line,
  wrapped at `/ ? & =`, then `note`, all wrapped to the image width. Long titles wrap too.
- **URL / citation origin** comes from `currentPageUrl()` in `@/lib/site` (W4). That is SITE_URL when configured,
  otherwise `window.location.origin`, so it is never `localhost:3000`. `PrintMeta` uses the same helper.
- **CSV numbers** are rounded to at most 4 decimals before serialising (`28.244999999999997` → `28.245`). Callers can
  still round to 2 decimals themselves.
- **"Compartilhar imagem…"** is the first item on touch devices (`pointer: coarse`) when `navigator.canShare({files})`
  is true. It calls `navigator.share({ files: [png], title, text: citation })`. It isn't shown on desktop.
