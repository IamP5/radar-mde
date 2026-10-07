# QA · Accessibility & visual/responsive: Radar MDE · Brasil

- **Date:** 2026-10-07 · **Build:** dev server `http://localhost:3210` (commit 5f9d42f + working tree)
- **Tester role:** a11y + visual/responsive QA (Phase 1: test and report only, no source edits)
- **Tooling:** Playwright 1.63 (Chromium), @axe-core/playwright 4.13 (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa), CDP vision-deficiency emulation, forced-colors / reduced-motion / print emulation
- **Routes:** `/`, `/regiao/sudeste`, `/sp`, `/sp/santo-andre`, `/explorar`, `/acompanhar`, `/dados`, `/sobre`, 404 (`/rota-inexistente`), ⌘K palette
- **Matrix:** light + dark (`colorScheme` + `localStorage.theme`, verified `html.dark` present) × 320/375/414/768/1024/1280/1440/1920
- **Evidence:** `qa/reports/a11y-visual/shots/` (full pages, keyboard, CVD grids, forced colors, zoom, print) and `qa/reports/a11y-visual/sec/` (per-panel crops)
- **Regression script:** `cd qa && node reports/a11y-visual/a11y-regression.mjs [--quick] [--base URL]`. It prints axe counts per route and theme, horizontal overflow, and small-target counts per viewport, writes `results.json`, and exits 1 on any failure.

## Summary

The foundation is solid. `lang="pt-BR"` is set and the skip link works. Landmarks are present, and every page has one h1 and an ordered h2/h3 outline. Icon buttons have names. Charts carry `sr-only` text descriptions. Tables use `scope`/`aria-sort`. Segmented controls and the year picker are real radiogroups with roving focus and arrow keys. The ⌘K palette traps focus, Escape closes it, and focus returns to the trigger. **No page scrolls horizontally at any of the 8 widths in either theme** (144 checks pass). Reduced motion is honored. Dark mode passes axe with 0 violations.

The problems that remain sit in four areas: the data colors (contrast and colorblind or grayscale legibility), the sticky bars hiding focus and eating the viewport at zoom, forced-colors mode, and table and legend layout on small screens.

| | blocker | major | minor | polish |
|---|---|---|---|---|
| Count | 0 | 7 | 10 | 8 |

**axe results (light):** 1 rule fails, `color-contrast`, on 18 nodes across 5 routes. All of them are the same pill: `text-critical` on `bg-critical-soft` at 4.27:1 (→ A11Y-01). **Dark:** 0 on every route.

| route | light | dark |
|---|---|---|
| / | 1 | 0 |
| /regiao/sudeste | 2 | 0 |
| /sp | 1 | 0 |
| /sp/santo-andre | 2 | 0 |
| /explorar | 12 | 0 |
| /acompanhar, /dados, /sobre, 404 | 0 | 0 |

**Overflow:** `document.scrollWidth == innerWidth` on all 9 routes × 8 widths × 2 themes. Some content is still clipped inside cards (VIS-02, VIS-03).

**Fix first:** A11Y-02 (focus hidden under the sticky bars), A11Y-03 and A11Y-04 (map and chart colors), A11Y-05 (forced colors), VIS-01 (ranking table on mobile).

---

## Findings: accessibility

### A11Y-01 · minor · WCAG 1.4.3 Contrast (Minimum)
- **Where:** light theme, any viewport. `/` and `/regiao/sudeste` KPI delta pills ("vs 2024"), `/sp` and `/explorar` "Abaixo" status badges, `/sp/santo-andre` "Posição" diff pills (−4,0 p.p.).
- **Steps:** run axe in the light theme.
- **Expected:** 12px text ≥ 4.5:1. **Actual:** `#da2f35` on `#fff0f0` = **4.27:1** (18 nodes). In dark mode the same pill is 6.06:1, which passes.
- **Root cause:** `web/src/components/kit/status.tsx:16` (`below: "bg-critical-soft text-critical"`), `web/src/components/kit/stat.tsx:46` (`DeltaPill` bad tone), and `web/src/app/[uf]/[slug]/page.tsx:540`. There is a `--good-ink` and a `--warning-ink` but no `--critical-ink`.
- **Fix:** add a `--critical-ink: #c0262d` token in light (5.34:1 on `#fff0f0`; 5.90:1 on white) and `--critical-ink: #ff6166` in dark (`globals.css` near lines 51 and 135, plus `--color-critical-ink` in `@theme`). Use `text-critical-ink` in the three places above.

### A11Y-02 · major · WCAG 2.4.11 Focus Not Obscured (Minimum)
- **Where:** `/`, `/sp`, `/sp/santo-andre`, `/explorar` at every width, both themes. Worst on `/sp`, where the sticky bar is about 132px tall (two rows).
- **Steps:** focus the footer, then press Shift+Tab repeatedly. When the focused row scrolls in from above, the browser parks it at the very top of the viewport, under the sticky site header and year bar. 6 elements on `/`, 6 on `/sp/santo-andre` ("SIOPE" links), 2 on `/sp`, and 1 on `/explorar` end up fully hidden.
- **Evidence:** `shots/focus-obscured-sp.png`. The focused "≠" tooltip trigger sits under the year bar, and only its tooltip is visible.
- **Root cause:** there is no `scroll-padding-top` for the sticky stack. `web/src/app/globals.css:255-260` defines `--header-h` but nothing reserves space for it. The context bar comes from `components/territory/TerritoryDashboard.tsx:176` and `components/UfDashboard.tsx:159`.
- **Fix:** in `globals.css` add `html { scroll-padding-top: calc(var(--header-h) + 3.5rem); }` (use +5.5rem on pages with the two-row UF bar, or set a `--subbar-h` variable from the bar). Also add `scroll-margin-top` to the focusable rows of internal scroll lists if needed.

### A11Y-03 · major · WCAG 1.4.11 Non-text Contrast, 1.4.1 Use of Color
- **Where:** home and region choropleth in "% abaixo de 25%" mode (state map), plus every MDE map, histogram, and Explorer swatch. Light theme is worst.
- **Measured against the card (#fff):**
  - `bin-3` (25–26%, and "0%" on the state map) 1.40
  - `red-1` (até 2%) 1.32
  - `red-2` 1.86
  - `bin-2` 2.18
  - `bin-4` 2.11
  - `bin-nd` 1.12
- **Adjacent bins:** 0% vs até 2% = **1.06**, so they are effectively the same color. `bin-2`/`bin-3` = 1.56, `bin-3`/`bin-4` = 1.51.
- **Evidence:** `shots/cvd-home-map-grid.png` (normal / deuteranopia / protanopia / achromatopsia). Under protanopia and achromatopsia, the "até 2%" states (PA, MT, GO, MG, SP, PR…) disappear into the "0%" gray. `shots/cvd-sudeste-map-grid.png`: in grayscale, `<22%` (bin-1) and `≥30%` (bin-5) are the same dark gray, so "below the constitutional minimum" reads as "best performers". On municipal maps, the few below-25% municipalities are 2–3px specks and nearly invisible even with normal vision (`sec/sudeste-light-1440-02.png`).
- **Root cause:** `web/src/lib/bins.ts:55-60` puts the "0%" step at `--bin-3` (warm gray), next to `--red-1`. Palette values are in `globals.css:56-81`. On top of that, the map shapes carry hue alone: the shape fill in `components/Choropleth.tsx` around lines 199-206 has no redundant encoding.
- **Fix:**
  - (a) Render "0%" as `--bin-nd`/white with a hairline (`stroke var(--axis)`) and start the red ramp at `--red-2`. Or drop to 4 red steps, so each step is ≥ 1.4:1 from its neighbors and the first non-zero step is ≥ 1.8:1 from 0%.
  - (b) For below-minimum municipalities (bin-1, bin-2), add a redundant mark: a 1px `var(--critical)` stroke, or reuse the existing hatch pattern idea (`Choropleth.tsx:131`) with a dot pattern. Then "below 25%" survives grayscale, print, and CVD.
  - (c) Give light-fill shapes a darker stroke (`stroke: color-mix(in oklab, var(--foreground) 15%, transparent)`) so they meet 3:1 against the card.
  - (d) Link each map to its data table with `aria-describedby` (see A11Y-07).

### A11Y-04 · major · WCAG 1.4.11, 1.4.1 (charts)
- **Where:** "Evolução 2008–2025" multi-line chart (`/`, `/regiao/*`), and the Santo André MDE chart (Mediana SP vs Mediana Brasil).
- **Actual:** light series contrast on white: `series-3` green 2.82, `series-4` amber **2.17**, `series-5` pink 2.69 (needs 3:1). Six region lines differ by hue only.
- **Evidence:** `shots/cvd-home-evol-grid.png`. Under deuteranopia, Norte/Sul/Nordeste/Centro-Oeste collapse into 2 olive tones. Under achromatopsia, all regions are the same gray. The legend is a separate row, not direct labels.
- **Root cause:** `globals.css:66-70` (light series), and `components/MultiLine.tsx` (legend, no dash or marker differentiation).
- **Fix:**
  - Darken the light series: amber `#a87700` (3.96), green `#178a62` (4.33), pink `#c4507f` (4.37), orange `#c95a26`.
  - Vary `strokeDasharray` or add end-of-line direct labels. DESIGN.md already asks for direct labels for ≤4 series, so highlight the selected region and grey the others.
  - Make the active series ink-heavy, which the sr-only data text already supports.

### A11Y-05 · major · WCAG 1.4.11 / 1.4.1 under Windows High Contrast (forced-colors)
- **Where:** all pages with `forced-colors: active`.
- **Evidence:** `shots/forced_.png`, `shots/forced-map_.png`, `shots/forced-segmented.png`.
- **Actual:**
  - (1) Every legend swatch disappears, because they are inline `background` spans, so the map legend becomes text with no key.
  - (2) In the segmented controls and the year picker, the selected option is indistinguishable: "2025", "Estados", and "% abaixo de 25%" look the same as the unselected options, because the selected state is only `bg-background` plus a box-shadow.
  - (3) Status dots and the ranking bars vanish.
  - (4) The selected tab in "Evolução" loses its indicator.
- **Root cause:** `components/Choropleth.tsx:186` (Swatch) and `:202-208`, `components/kit/segmented.tsx:47`, `components/YearPicker.tsx` (radio item classes), `components/kit/status.tsx:22`, `components/territory/UfTable.tsx:114-116`.
- **Fix:** add `forced-color-adjust-none` (Tailwind `forced-color-adjust-none`) to Swatch, StatusDot, the UfTable bar, and the sparkline wrappers. On selected radios add `forced-colors:outline forced-colors:outline-2 forced-colors:outline-[Highlight]` (or `aria-checked:forced-colors:bg-[Highlight] aria-checked:forced-colors:text-[HighlightText]`). Do the same for the active tab.

### A11Y-06 · major · WCAG 1.4.10 Reflow / 2.4.11 at high zoom
- **Where:** territory pages at 400% zoom (320×256 CSS px) and 200% zoom on a short laptop (640×400).
- **Actual:** the sticky stack (2-row mobile header at 94px, `--header-h: 5.875rem`, plus the year bar at 48px) covers **about 53% of the viewport at 400%** and 36% at 200%. On `/sp` the bar has 2 rows, so it covers more. Content scrolls in a strip about 120px tall (`shots/zoom-320x256-_.png`).
- **Root cause:** `app/layout.tsx:33` (`sticky top-0` header with the second nav row), `globals.css:255-260`, `TerritoryDashboard.tsx:176`, `UfDashboard.tsx:159`.
- **Fix:** `@media (max-height: 30rem) { header, .subbar { position: static } }` (or `max-height:500px`). On mobile, let the nav row scroll away and keep only the 56px bar sticky: move `md:hidden` NavLinks out of the sticky header, or hide it on scroll.

### A11Y-07 · major · WCAG 2.1.1 Keyboard / 1.1.1 (maps)
- **Where:** all choropleths (`/`, `/regiao/*`, `/sp`, `/sp/santo-andre`).
- **Actual:** the map is a single `role="img"` with no focusable shapes. Hover tooltips are mouse-only (`pointerType === "mouse"`), and click-to-drill (`router.push`) is mouse/touch only. A keyboard user cannot get the value for a state or municipality from the map. Equivalent data does exist elsewhere: the state grid and ranking table on `/`, the "Todos os municípios" table on `/sp`, and `/explorar`. Nothing points to them, and the map `aria-label` is generic ("Mapa do Brasil por estado, 2025").
- **Root cause:** `components/Choropleth.tsx:103-128`.
- **Fix:** make the `aria-label` describe the encoding and the key finding (e.g. "…Acre tem a maior parcela, 18%"), and add `aria-describedby` pointing to the table or ranking id. Add a visible "Ver como tabela" link under the legend. Optionally make the ≤27 state shapes focusable `<a>` elements (`tabIndex=0`, `aria-label` with the value, Enter → navigate, focus shows the tooltip). This is cheap at the state level. Leave the 645/5,570 municipal shapes out of tab order.

### A11Y-08 · minor · WCAG 4.1.3 Status Messages
- **Where:** `/`, `/regiao/*` (year picker and series toggle), ⌘K palette.
- **Actual:** changing the year rewrites the headline sentence and all KPIs with no live announcement (home has 0 live regions). The palette's "9 resultados" count is not announced. `/sp` and `/explorar` do announce their counts.
- **Root cause:** `components/territory/TerritoryDashboard.tsx:188` (summary `<p>`), `components/SearchPalette.tsx` (footer count).
- **Fix:** add `aria-live="polite"` to the summary paragraph, or an `sr-only` `role="status"` with "Exibindo 2024: N municípios abaixo…". Add `role="status"` to the palette result count.

### A11Y-09 · minor · WCAG 1.3.1 / 2.4.6: h1 reads "Santo AndréSP"
- **Where:** `/[uf]/[slug]`.
- **Actual:** the accessible heading text is "Santo AndréSP", because the UF badge sits inside the h1 with no separator.
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx:152-157`.
- **Fix:** move the badges out of the `<h1>`, or render `<span className="sr-only"> (</span>SP<span className="sr-only">)</span>`, or give the badge `aria-hidden` plus an sr-only " – São Paulo".

### A11Y-10 · minor · WCAG 2.4.4 / 2.4.9: 19 identical "SIOPE" links
- **Where:** `/sp/santo-andre` "Ano a ano" table ("Fonte" column).
- **Fix:** `aria-label={`Fonte SIOPE, ${ano}`}` on each link (`app/[uf]/[slug]/page.tsx`, Ano a ano table, Fonte cell).

### A11Y-11 · minor · WCAG 2.4.3: skip link target not focusable
- **Actual:** after "Pular para o conteúdo", `document.activeElement` is `<body>`. Chromium continues from `#conteudo`, but older Safari and some screen reader / browser pairs restart from the top.
- **Fix:** `app/layout.tsx:52` → `<main id="conteudo" tabIndex={-1} className="flex-1 outline-none">`.

### A11Y-12 · minor · WCAG 2.5.8 Target Size: UF table sort buttons 19px tall
- **Where:** `/sp` "Todos os municípios" header (Município, População, MDE 2025…), 75×19px.
- **Root cause:** `components/UfDashboard.tsx:140`. The button has no height, unlike `UfTable.tsx` and `Explorer.tsx`, which use `h-7 -mx-1.5 px-1.5`.
- **Fix:** use the same classes as `Explorer.tsx:280` (`-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 hover:bg-accent`). This also aligns the hover pill with DESIGN.md.

### A11Y-13 · minor · tables without captions / truncated info without access
- **Tables:** `/` and `/regiao/*` ranking table, both `/dados` tables, and the two `/sp/santo-andre` tables have no `<caption>`. `/sp` and `/explorar` do have one. Add `<caption className="sr-only">` matching the panel title (`UfTable.tsx:78`, `app/dados/page.tsx`, `app/[uf]/[slug]/page.tsx`).
- **Truncated text:** "Maiores déficits" years (`5 anos abaixo: 2021, 2022, 2023, 2025…`) and "Vizinhos" names on mobile (`Pirapora do Bom Jesus`) are cut with an ellipsis and have no `title` or tooltip. The link name keeps the full text for screen readers, but sighted users lose it. Allow 2 lines (`line-clamp-2`) or add `title`.

### A11Y-14 · minor · EmptyState announces the whole block
- **Actual:** `components/kit/panel.tsx:48` puts `role="status"` on every EmptyState, so `/acompanhar` announces the full paragraph on load. Use `role="status"` only for async results. Static empty pages don't need it.

### A11Y-15 · minor · text-only zoom (browser default font size)
- **Actual:** with the root font at 200%, most UI scales but `text-[11px]`/`[13px]`/`[15px]`/`[26px]` (KPI values, labels, header logo text) stay fixed, so hierarchy inverts. Descriptions become larger than KPI values, and the desktop nav clips ("Acom…") (`shots/textzoom_sp_santo-andre.png`).
- **Fix:** convert arbitrary px font sizes to rem, e.g. `text-[0.8125rem]` and `text-[0.9375rem]`, or define `--text-label`/`--text-kpi` theme tokens in rem.

### A11Y-16 · minor · Chart/map focus outlines are a faint brand at 50% alpha
- **Actual:** the `* { outline-ring/50 }` base rule (`globals.css:265`) tints most focus rings to about 73% alpha of `#006bff`, roughly 3.2:1 on white, and the rings animate with `transition-colors`. It passes, but narrowly, and is inconsistent with the 100% `:focus-visible` rule two lines below.
- **Fix:** drop `outline-ring/50` from the `*` rule, or set `:focus-visible { outline-color: var(--brand) !important }`. Exclude `outline-color` from `transition-colors` on interactive elements.

---

## Findings: visual / responsive

### VIS-01 · major · Ranking table on mobile hides the key metric; last column clipped on desktop
- **Where:** `/` and `/regiao/*` "Ranking dos estados" at ≤768px. At 375px only *Estado* and *Municípios* are visible (`sec/home-light-375-10.png`), and "% abaixo de 25%", the one column the page is about, is off-screen with no scroll hint. At 1280 and 1440px the 9th column "Governo estadual" is still cut at the card edge (`shots/v-home-ranking.png`, container `sw=1448 > cw=1230`).
- **Root cause:** `components/territory/UfTable.tsx:78-89` has 9 columns and no sticky first column. The region text column and the inline bar take width.
- **Fix:**
  - Make the name cell `sticky left-0 z-[1] bg-card` (the pattern already used in `Watchlist.tsx:122` and `UfDashboard.tsx:426`).
  - Order columns so "% abaixo" comes right after Estado.
  - Hide Municípios / Fundeb / R$ por aluno below `sm` (`hidden sm:table-cell`).
  - Add a right-edge fade (`mask-image: linear-gradient(to right, #000 92%, transparent)`) when the table scrolls horizontally.
  - Also fix the `R$ 14.173,5` money format (`UfTable.tsx:126`: use `Math.round` or `fmt` from `lib/format.ts`).

### VIS-02 · minor · Explorer legend clipped on mobile
- **Where:** `/explorar` at ≤414px. The bin legend in the panel header runs past the card and "≥ 30%" is cut (`sec/explorar-light-375-01.png`, section `scrollWidth 447 > 341`).
- **Root cause:** `components/Explorer.tsx:466` passes `<BinLegend/>` as Panel `action` (`shrink-0`, `kit/panel.tsx:24`).
- **Fix:** let the action wrap: in Panel use `min-w-0 shrink` on the action container, or render the legend in the body or footer below sm.

### VIS-03 · minor · KPI delta pill breaks at narrow widths
- **Where:** `/sp/santo-andre` at 320px. "+0,1 p.p. vs 2024" wraps to 2 lines inside a fixed `h-5` pill and spills out of the tint (`sec/santo-light-320-00top.png`). The same pill at 200% text zoom: `shots/textzoom_sp_santo-andre.png`.
- **Root cause:** `components/kit/stat.tsx:45`.
- **Fix:** add `whitespace-nowrap`. If space is tight, shorten the copy to "+0,1 p.p." and put "vs 2024" in the `title` / sr-only text.

### VIS-04 · minor · Internal scroll lists cut rows mid-height with no affordance
- **Where:** "Maiores déficits acumulados" (`/`, `/regiao/*`, `/sp`) and "Vizinhos" (`/sp/santo-andre`). The last visible row is sliced ("Cabo Frio … R$ 57,6 mi" half shown) and the panel bottoms don't align with the neighbor panel (`sec/home-light-1440-07.png`, `sec/santo-light-1440-13.png`).
- **Root cause:** `TerritoryDashboard.tsx:378` `max-h-[23rem]`, `app/[uf]/[slug]/page.tsx:439` `max-h-[30rem]`, `UfDashboard.tsx:309`.
- **Fix:** add a bottom fade (`[mask-image:linear-gradient(to_bottom,#000_85%,transparent)]`) or a "Ver todos (N)" footer link, and size `max-h` to a whole number of rows.

### VIS-05 · polish · Map / histogram panels leave large empty areas
- **Where:** `/` 1440 "Distribuição dos municípios" (chart about 200px in a 470px panel, `sec/home-light-1440-07.png`). `/sp/santo-andre` "Onde fica" map panel vs "Vizinhos". `/dados` "Cobertura" and "Dicionário" tables use only about 60% width with an empty right column.
- **Fix:** let the chart grow (`h-full min-h-[260px]` with a flex-col body), or set `items-start` on the grid so panels don't stretch. On `/dados`, make the tables full width or use the right column for "Como citar" and notes.

### VIS-06 · polish · KPI sparklines float instead of sitting flush at the bottom
- **Where:** home KPI row (all widths). In stretched grid cards the spark sits right under the text, leaving a gap below it, and sparks don't align across cards (`sec/home-light-1440-00top.png`, `sec/home-light-375-00top.png`).
- **Root cause:** `components/kit/stat.tsx:36` (`mt-3` only).
- **Fix:** `mt-auto pt-3` on the spark wrapper, as DESIGN.md says ("optional spark flush at bottom").

### VIS-07 · polish · Clipped scrollers with no edge hint
- **Where:** year picker (`2011` shows as "ı1" or ")20" at the left edge on every width) and mobile nav ("Met…" cut at 375 and 320).
- **Root cause:** `components/YearPicker.tsx` (track `overflow-x-auto`), `components/kit/nav.tsx:20`.
- **Fix:** add an edge-fade mask on the scroll containers (`[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)]`). On mobile, shorten "Metodologia" → "Método" or let the nav wrap.

### VIS-08 · polish · Nested card look on "Por região" and the empty state
- **Por região:** the region mini-cards are bordered boxes inside a Panel, which goes against DESIGN.md "Never nest panels" (`sec/home-light-1440-02.png`). Use `divide-y` rows instead of bordered tiles (`TerritoryDashboard.tsx`).
- **Empty state:** `/acompanhar` puts the title above the icon (icon between title and body). Put the icon first, then the title.

### VIS-09 · polish · Dark-mode map: "Sem dados" invisible, low step separation
- **Where:** dark `/`. `--bin-nd #1a1a1a` on `#0a0a0a` is 1.14:1, and "até 2%" vs "0%" is 1.12:1 (`sec/home-dark-1440-02.png`). Fold into the A11Y-03 palette rework.
- **Fix:** give dark mode its own step selection: `--bin-nd` with a visible hatch or stroke `var(--axis)`, and the first red step ≥ `#833a38`.

### VIS-10 · polish · No print stylesheet
- **Where:** all routes. Printing `/sp/santo-andre` gives 6 A4 pages that include the sticky header, the nav, the theme switcher, and the action buttons, with charts and panels split across pages (`shots/print-santo-pages.png`, `shots/print_sp_santo-andre.pdf`). There are 0 `@media print` rules.
- **Fix:** in `globals.css` add:
  ```css
  @media print {
    header.sticky, .sticky, nav[aria-label=Principal], footer [role=radiogroup], [data-slot=button] { display: none !important }
    section { break-inside: avoid }
    body { background: #fff }
    a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 10px }
  }
  ```
  Keep the page header and the h1.

### VIS-11 · polish · Santo André highlight hard to find on the state map
- **Where:** `/sp/santo-andre` "Onde fica". The selected municipality is a 2px black outline on a small polygon (`sec/santo-light-1440-13.png`).
- **Fix:** add a pin or label (`<circle r=4>` at the centroid plus a text label), or dim the other shapes to 40% opacity.

---

## Non-issues / passes (verified)
- No page-level horizontal overflow at 320–1920 in light and dark. Tables scroll inside `data-slot=table-container`, and those containers hold focusable links, so keyboard users can scroll them.
- Theme toggle, footer ThemeSwitcher (radiogroup), search, and share buttons all have accessible names. The Share menu opens on Enter and Escape returns focus to the trigger. Watch/Acompanhar uses `aria-pressed`, and its status is announced through a live region.
- Palette: `role=dialog` with a title, combobox and listbox with `aria-activedescendant`, Tab stays in the input, and Escape closes it and returns focus to the opener.
- Charts: the svg is `aria-hidden` and paired with an `sr-only` `<p>` description holding the year-by-year values. The Evolução chart is a focusable group with arrow-key year navigation.
- `prefers-reduced-motion`: 0 running animations, and transitions are clamped (`globals.css:300`).
- The "N" circle at bottom-left in screenshots is the Next.js dev indicator. It is dev only, not a product issue.

## Scripts (in `qa/reports/a11y-visual/`)
- `a11y-regression.mjs`: the **regression test**. It runs axe per route and theme, plus overflow and small-target checks per viewport. Exit code 1 means something failed.
- `shots.mjs`, `sections.mjs`, `view.mjs`: full-page, per-panel, and anchored viewport screenshots.
- `semantics.mjs`, `names.mjs`: heading outline, landmarks, svg/chart labels, live regions, duplicate link names.
- `keyboard.mjs`, `shifttab.mjs`, `obscured-shot.mjs`, `dialogs.mjs`, `palette.mjs`, `palette2.mjs`: the keyboard journey, focus-obscured detection, and dialog, menu, and palette behavior.
- `clipping.mjs`: content clipped by overflow, horizontal scroll regions, ellipsis without a title.
- `cvd.mjs`: deuteranopia, protanopia, and achromatopsia captures. `contrast.mjs`: palette contrast math.
- `modes.mjs`: 200% and 400% zoom, text-only zoom, forced colors, reduced motion, print.
