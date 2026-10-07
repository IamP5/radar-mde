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

---

## Round 2 · re-validation (commit ff4a309, production build `:3299`)

- **Date:** 2026-10-07. Evidence for this round is in `qa/reports/a11y-visual/r2/` (`shots/`, `sec/`, `*.txt` logs, `results.json`). I opened and checked every screenshot cited below.
- **Re-runs on `:3299`:**
  - The full regression (`BASE=http://localhost:3299 node reports/a11y-visual/a11y-regression.mjs`) returns **0 axe violations** on all 9 routes in light and dark, and **0 horizontal overflow** at all 8 widths in both themes. Log: `r2/regression.txt`.
  - The script now also checks that **the first Tab on each page lands on the skip link**. This new check **fails on all 9 routes** (A11Y-17 below). Log: `r2/regression-quick.txt`.
- **`:3299` rebuild:** the server was rebuilt during this round. One `/explorar` run hit connection-refused, and `/sp/santo-andre` showed 6 "obscured" hits on the first pass. I re-ran both after the rebuild, and the results below come from the post-rebuild runs.

### Status of round-1 findings

| ID | Sev | Status | Evidence / note |
|---|---|---|---|
| A11Y-01 critical pill contrast | minor | **FIXED** | axe light: 0 nodes. `--critical-ink` is `#c0262d` |
| A11Y-02 focus hidden under sticky bars | major | **FIXED** | Shift+Tab sweep: 0 obscured on `/`, `/sp`, `/sp/santo-andre`, `/regiao/sudeste`. The 2 hits on `/explorar` are artefacts (skip link and body). `r2/shifttab.txt` |
| A11Y-03 map bins (contrast, CVD) | major | **PARTIAL** | State map is fixed: 0% is near-white and the red ramp is separable even in achromatopsia (`r2/shots/cvd-home-map-grid.png`). On municipal maps the "contorno escuro" for below-25% is about 1px and disappears in grayscale. In normal vision you have to look for the 2 Sudeste cities (`r2/shots/cvd-sudeste-zoom.png`). → A11Y-18 |
| A11Y-04 region lines colour-only | major | **FIXED** (one nit) | Dash patterns plus a direct label block (`r2/sec/home-light-1440-05.png`). Distinguishable under deuteranopia, protanopia and achromatopsia (`r2/shots/cvd-home-evol-grid.png`). Nit: Nordeste (dotted) and Sul (dot-dash) are close in grayscale. |
| A11Y-05 forced-colors | major | **FIXED** (one nit) | Swatches stay visible. Selected year, segmented controls and tabs get a Highlight outline (`r2/shots/forced-map_.png`). Nit: the "Posição" percentile track and fill vanish, leaving only the marker ring (`r2/shots/forced_sp_santo-andre.png`). |
| A11Y-06 sticky stack at 400% zoom | major | **FIXED** | At 320×256 and 640×400 the header and sub-bar become static, so sticky coverage is 0% (`r2/shots/zoom-320x256-_.png`) |
| A11Y-07 maps keyboard / table alternative | major | **FIXED** (state level) | State map is a `role=group` with 27 focusable shapes ("Rondônia: 0 de 52 … MDE mediana 27,14%"); focus shows the tooltip with "Enter para abrir". `aria-describedby` points to the ranking table. Every map now has a "Os mesmos números em tabela" link. Municipal maps stay `role=img` with a table link, which is acceptable. |
| A11Y-08 live updates | minor | **FIXED** | `role=status` "Exibindo 2025: 23 de 5.560…" on territory pages; the palette count "76 resultados, mostrando 8" is live |
| A11Y-09 h1 "Santo AndréSP" | minor | **FIXED** | Accessible name is "Santo André (São Paulo)" |
| A11Y-10 19× "SIOPE" links | minor | **FIXED** | "Dados brutos de 2025 no SIOPE (JSON, abre em nova aba)" |
| A11Y-11 skip-link target | minor | **FIXED** | `main tabindex=-1`; focus moves to `MAIN#conteudo` and the next Tab reaches the breadcrumb. **But** the skip link itself is now skipped (A11Y-17) |
| A11Y-12 UF sort buttons 19px | minor | **FIXED** | Sort buttons no longer appear in the small-target list |
| A11Y-13 captions / ellipsis without text | minor | **PARTIAL** | Captions were added on `/`, `/sp` and `/sp/santo-andre`. Still missing on `/dados` (2 tables) and `/sobre` (2 tables). Explorer at 375px truncates names ("Chapada da Nati…") with no `title` |
| A11Y-14 EmptyState `role=status` | minor | **FIXED** | No status role on the empty `/acompanhar` |
| A11Y-15 text-only zoom (px fonts) | minor | **NOT FIXED → REGRESSED** | px font sizes remain, and with 200% root text the city page header now collapses (→ VIS-12) |
| A11Y-16 50% focus ring | minor | **FIXED** | Settled ring is `rgb(0,112,243)` 2px. It still animates in from the text color for about 150ms, which is harmless |
| VIS-01 ranking table mobile / desktop cut | major | **FIXED** | Sticky name column, "% abaixo" second, all columns fit at 1280 and 1440, R$/aluno is rounded (`r2/shots/v-home-ranking-375.png`, `-1280.png`) |
| VIS-02 explorer legend clipped | minor | **FIXED** | Wraps to 2 lines at 375px (`r2/shots/explorar-scrolled-light-375.png`) |
| VIS-03 delta pill wraps | minor | **FIXED** | "+0,1 ponto" stays on one line at 320 and 375 |
| VIS-04 scroll lists cut rows | minor | **FIXED** | `fade-b` on the déficits and vizinhos lists |
| VIS-05 empty space under histogram | polish | **NOT FIXED** | `r2/sec/home-light-1440-07.png`: chart about 200px tall in a 470px panel; same on `/sp` |
| VIS-06 spark not at bottom | polish | **FIXED** | Sparks are flush at the bottom. KPI cards are now tall with a large empty middle when one card has 4 sub-lines (`r2/sec/home-light-1440-00top.png`) |
| VIS-07 clipped scrollers | polish | **FIXED** | Nav labels are shortened on mobile ("Salvos", "Método") and the year picker has `fade-x` |
| VIS-08 nested tiles / empty-state order | polish | **PARTIAL** | Empty state fixed (icon, then title; `r2/shots/acompanhar-empty.png`). The "Por região" bordered tiles inside a Panel are unchanged |
| VIS-09 dark map nd / steps | polish | **FIXED** | New dark bins; "Sem dados" `#232323` is visible |
| VIS-10 print | polish | **FIXED** (one nit) | Light theme even when the site is dark. No header, nav or buttons. A URL and date line prints. Panels aren't split (`r2/shots/print-*-pages.png`: 7, 7 and 8 pages). Nit: money in "Ano a ano" wraps ("R$ 643,8 / mi", `r2/shots/p7-7.png`); add `whitespace-nowrap` to numeric cells in print |
| VIS-11 city highlight on map | polish | **PARTIAL** | Outline is thicker and white in dark mode, but still no pin or label (`r2/shots/d1280-santo-map.png`) |

### New findings (round 2)

#### A11Y-17 · major · REGRESSION · WCAG 2.4.1 Bypass Blocks / 2.4.3 Focus Order: first Tab skips the skip link, logo and active nav item
- **Where:** every route, dev and prod, desktop widths ≥ md.
- **Steps:** load `/` and press Tab once.
- **Expected:** focus lands on "Pular para o conteúdo".
- **Actual:** focus lands on the nav item *after* the current section:
  - `/` → "Explorar"
  - `/dados` → "Metodologia"
  - `/sobre` → "Buscar"
  
  The skip link, the logo and the active nav link are never reached going forward. No focus event fires on load. What moved is the browser's sequential-focus starting point. The new regression check fails on 9 of 9 routes.
- **Root cause:** `web/src/components/kit/nav.tsx` (useEffect, about line 37): `el.querySelector("[aria-current=page]")?.scrollIntoView({block:"nearest",inline:"nearest"})`. In Chromium, `scrollIntoView` moves the sequential focus navigation starting point to that element. It runs for the visible desktop nav even when nothing needs to scroll.
- **Fix:** scroll the nav container instead of the element, and only on the mobile nav:
  ```ts
  const a = el.querySelector<HTMLElement>("[aria-current=page]");
  if (a && el.scrollWidth > el.clientWidth) el.scrollLeft = a.offsetLeft - (el.clientWidth - a.offsetWidth) / 2;
  ```
  This is the same approach `YearPicker` uses.

#### VIS-12 · major · REGRESSION · City page header squeezes the title column when there are 4 actions
- **Where:** `/sp/santo-andre`.
  - **768px (iPad portrait):** the title wraps "Santo / André", the summary runs about 5 words per line in a 180px column, and the right half of the band is empty above the buttons (`r2/shots/v-santo-768-top.png`).
  - **1024px:** the summary column is about 420px.
  - **200% default font size (A11Y-15):** the column is 90px wide and the text runs one word per line (`r2/shots/textzoom-santo-tall.png`).
- **Root cause:** `web/src/components/kit/page-header.tsx:19`. The actions wrapper is `shrink-0` inside `md:flex-row`, and the city page now passes 4 actions ("O que posso fazer?", Acompanhar, Compartilhar, SIOPE).
- **Fix:** change the wrapper to `flex min-w-0 flex-wrap items-center gap-2 md:max-w-[50%] md:justify-end`, give the title block `md:flex-1 md:min-w-[22rem]`, or switch to `lg:flex-row` so actions go below the title under 1024px.

#### A11Y-18 · minor · Below-minimum mark on municipal maps is not perceivable
- **Where:** `/regiao/*`, `/sp`, `/sp/santo-andre`, and the "Municípios" map mode.
- **Actual:** the 1px dark outline on 3–6px shapes next to dark `bin-5` neighbours can't be seen in grayscale. `bin-1` and `bin-5` have similar luminance, which the contract itself notes (`r2/shots/cvd-sudeste-zoom.png`). In normal vision you still have to hunt for them.
- **Fix:** in `Choropleth.tsx` (below-bin overlay):
  - Draw below-25% shapes last, with a 2px `var(--background)` halo under a 1.5px `var(--critical-ink)` stroke.
  - Add a centroid marker (`<circle r=3>`) when the shape's bbox is under 8px.
  - Or render them with the hatch pattern.

#### A11Y-19 · minor · White text on dark-mode `bin-4` tiles is 4.42:1
- **Where:** `/acompanhar` (watchlist year tiles) in dark mode. Values 26–30% render as white 11–12px text on `#2a78d6`. axe did not catch it because the watchlist is empty during the regression run.
- **Fix:** use black text on `bin-4` in dark (`#000` on `#2a78d6` is 4.75:1), or darken dark `--bin-4` to `#2468bd`. Also seed `radar-mde:watch` in the regression run so axe covers the filled watchlist.

#### A11Y-20 · minor · WCAG 2.5.8: tiny targets introduced or kept
- **"≠" divergence marker:** in the `/sp` table it is a 9×16px focusable span. Give it `p-1 -m-1` so it reaches 24×24.
- **Home state map on mobile:** each state shape is a tap target, and DF is 5×3px, AL/SE about 10px. Equivalent links exist in "Todos os estados", so the 2.5.8 equivalent-control exception applies. Consider `tabIndex=-1` on shapes smaller than 8px and rely on the grid.
- **Glossary term buttons:** 16–20px tall. They pass as inline targets inside sentences, but "MDE em 2025" in the KPI label is not a sentence; add `py-0.5`.

#### VIS-13 · polish · Smaller visual notes on the redesigned surfaces
- **Home search hero (1280/1440):** "Baixar CSV" and "Explorar municípios" are bottom-aligned with the description, while the new search field sits below them. The actions float mid-band (`r2/sec/home-light-1440-00top.png`). Align the actions with the search row, or move them under the field.
- **Palette "Ver todos":** it expands to "203 resultados, mostrando 100" with no way to reach 101–203 and no bottom fade on the scrolling list (`r2/shots/palette-vertodos-light-1280.png`). Add "Mostrar mais" or a link to `/explorar?q=…`.
- **Explorer at 375px:** the "vs 2024" column is cut at the card edge with no edge fade, and its values ("−19,5") have no unit (`r2/shots/explorar-scrolled-light-375.png`). Add `fade-x` and "p.p.".
- **Footer at 375px:** the version token "2026-10-07.586603bb" breaks mid-token, and the theme switcher pill stretches the full width (`r2/shots/watch-light-375.png`). Use `whitespace-nowrap` on the mono token and `w-fit` on the switcher.
- **Watchlist at 768px dark:** the year columns run past the card edge with no fade or sticky hint (`r2/shots/watch-dark-768.png`). The 375px card layout is good.
- **City breadcrumb:** "Brasil" is indented about 6px from the h1 left edge because of the pill padding (`r2/sec/santo-light-1440-00top.png`). Use `-ml-1.5` on the first crumb.

### Verified OK this round (new surfaces)
- **KPI rename:** "Faltou aplicar (estimativa)" has an info popover with the formula, the caveat and a methodology link. The popover is reachable by keyboard and labelled "Como o valor que faltou aplicar é calculado".
- **Region chart:** dash patterns plus a direct label block. Brasil is ink and dashed, as intended.
- **UF table:** sticky first column and right fade. The recurrence filter ("Qualquer histórico") renders cleanly in dark mode.
- **City page:** the sticky year bar is static at short heights. Glossary terms are `button[aria-haspopup=dialog]`; Enter opens and Escape returns focus to the term. The action kit is a real `tablist` with selected state, visible in forced colors.
- **Explorer:** the virtualized table keeps the sort header and status pills. The CSV menu has the "CSV padrão" and "Excel Brasil" groups and no overflow at 1280 or 375. The mobile palette has a visible "Fechar".
