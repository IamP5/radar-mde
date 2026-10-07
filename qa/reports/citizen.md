# QA: Persona CITIZEN (parent in a small town, cheap Android phone)

Tested on 2026-10-07 against `http://localhost:3210` (Next dev server). Device setups: Playwright iPhone 13 (390×844, touch), plus an Android-like 360×740 context with touch, an Android UA, 4× CPU throttling and about 1.6 Mbps / 150 ms network (CDP). Light and dark mode. Scripts and screenshots are in `qa/reports/citizen/` (`s1.mjs`, `shots.mjs`, `search.mjs`, `interact.mjs`, `map2.mjs`, `misc.mjs`, `perf.mjs`, `weight.mjs`, `ring.mjs`). No console errors or page errors appeared on any route tested.

Cities used: Conceição do Almeida (BA, 16k inhabitants, 10,47% in 2024), Bom Princípio do Piauí (PI, 5.8k), Goiás (GO), Itapeva (SP and MG), Porto do Mangue (RN, did not declare 2024–2025).

## 1. Journey narrative

**A. Arriving from a WhatsApp link to `/ba/conceicao-do-almeida`.** First paint took about 1 s even with throttling (dev mode). The answer to "is my city investing enough?" sits at the top: a badge ("No limite em 2025"), a one-line verdict ("Em 2025, aplicou 25,00% — cumpriu, mas no limite") and a "1 ano" abaixo marker. It took **under 10 s** to answer. "Is it getting better or worse?" took about 20–30 s. The only direct cue is "+14,5 p.p. vs 2024", and a lay parent will not understand "p.p.". The line chart is readable on a phone, and tapping it shows a tooltip, but tapping also draws a stray blue focus rectangle (CIT-04). "How does it compare to nearby cities?" is answered by the **Vizinhos** list, which is about 4 screens down (around 4,500 px). It is clear once found, but nothing at the top points to it. "What can I do?" is the **Kit de ação**, which is the very last block on a 6,400 px page. Its letters are good, but they assume the reader knows what e-SIC, CACS-Fundeb and TCM are, and the only action is "Copiar texto". There is no "Enviar por WhatsApp/e-mail" and no link to the e-SIC portal. The kit took **about 60–90 s** to reach by scrolling. Overall the first two questions get answered, and the last two take too long.

**B. Opening the home page to find my city.** The home hero offers **"Baixar CSV"** and **"Explorar municípios"**. There is no search field. The only way in is a 32×32 magnifier icon in the header. A low-literacy user is likely to tap "Explorar municípios" and land on a 5,570-row data table with filter chips ("Reincidentes", "Exercício"). The magnifier search itself works well. Accents are ignored ("sao joao" = "São João"). "itapeva" correctly lists SP and MG with their UF, and "picos pi" / "mundo novo ba" filter by UF. It does **not** tolerate typos ("conceicao do almeda" → 0 results, "sto antonio" → 0). It also caps results at 8 with no "see more". There are 54 "São João…" municipalities, so "sao joao" never shows São João do Piauí.

**C. Map on mobile.** Tapping a state or municipality shows a tooltip with "Toque de novo para abrir →", and a second tap navigates. This works well (verified on the home, `/ba` and city maps). The panel copy, though, still says "Passe o mouse… clique…". Coastal municipalities on the state map are too small to hit reliably at 360 px.

**D. Watch, share, dark mode.** WhatsApp sharing works: it opens `wa.me` with "Conceição do Almeida (BA): Em 2025, aplicou 25,00% — cumpriu, mas no limite. Veja no Radar MDE: <url>". Star/watch saves to localStorage, and `/acompanhar` lists the city. However, right after tapping on a phone the star shows a **crossed-out "star-off" icon** next to "Acompanhando" (CIT-02). Dark mode is legible, with good contrast and no broken colours. There is no horizontal page overflow at 360 or 390 px (wide tables scroll inside their own container).

**E. Performance.** In dev, the home page transfers about **4.0 MB**, mostly `/data/municipios.json` at 2.27 MB, which is not gzipped by the dev server and is about 870 KB gzipped. The home loads it eagerly, and `/acompanhar` loads it too just to show one starred city. The city page transfers about 1.9 MB (dev JS plus `indice.json` at 274 KB). DOMContentLoaded and FCP with throttling were 0.9–1.9 s, and network idle was about 9 s. Production bundles will be smaller. The dataset fetch on home and watchlist is the real cost on a prepaid data plan.

## 2. Findings

### CIT-01: Home has no visible "find my city" search; primary CTAs target analysts
- **Severity:** major · **Type:** UX · **URL:** `/`
- **Steps:** Open `/` on a phone and look for a way to find your town.
- **Expected:** A big search field above the fold ("Digite o nome da sua cidade").
- **Actual:** The CTAs are "Baixar CSV" and "Explorar municípios" (a dense table). Search is a 32×32 icon in the header with no label (aria-label only).
- **Evidence:** `qa/reports/citizen/c___0.png`, `qa/reports/citizen/a360_home.png`
- **Root cause:** `web/src/app/page.tsx:20-32` (hero CTAs); `web/src/components/kit/nav.tsx` (icon-only trigger).
- **Fix:** Add a full-width button styled as an input in the hero that opens `SearchPalette`. Proposed copy: placeholder **"Digite o nome da sua cidade"** and helper text **"Veja quanto a sua prefeitura aplica em educação."** Make "Baixar CSV" a secondary/ghost link. In the header on mobile, give the icon a visible label "Buscar" or at least a 44×44 target.

### CIT-02: Watch button shows a "crossed-out star" after tapping on touch devices
- **Severity:** minor · **Type:** bug · **URL:** `/ba/conceicao-do-almeida` (any city)
- **Steps:** On a touch phone, tap "Acompanhar".
- **Expected:** A filled yellow star with "Acompanhando".
- **Actual:** A `StarOff` icon (a struck-through star) with "Acompanhando". It looks like the action failed or was undone, and stays until the user taps elsewhere. Reproduced on iPhone 13 and on 360 Android (`aria-pressed=true`, icon `lucide-star-off`).
- **Evidence:** `qa/reports/citizen/watch_after_tap.png`
- **Root cause:** `web/src/components/WatchButton.tsx:17-24`. On touch, `onMouseEnter` fires on tap and `onMouseLeave` never fires, so `hover` stays true.
- **Fix:** Use `onPointerEnter/Leave` and ignore `e.pointerType !== "mouse"`, or use the CSS `@media (hover:hover)` group-hover to swap icons. Also move the "salvo só neste navegador" note out of `title` (hover-only), for example with a toast after the tap: **"Salvo em Acompanhando (só neste celular)."**

### CIT-03: Hover/click language on mobile ("Passe o mouse", "Clique")
- **Severity:** minor · **Type:** content/UX · **URL:** `/`, `/ba`, city pages
- **Steps:** Read the map and chart panel descriptions on a phone.
- **Actual:** "Passe o mouse para ver os números; clique para descer de nível", "Passe o mouse para ver o valor; clique para abrir o município", "Clique num município para abri-lo", "Clique numa barra…". The touch behaviour itself works (tap → tooltip → "Toque de novo para abrir").
- **Evidence:** `qa/reports/citizen/home_map_mun.png`, `qa/reports/citizen/maptap_ba_1.png`
- **Root cause:** `web/src/components/territory/TerritoryDashboard.tsx:278,304,353,405`; `web/src/components/UfDashboard.tsx:240,276,289,333`; `web/src/app/[uf]/[slug]/page.tsx:430`; `web/src/components/territory/TerritoryMap.tsx:98`.
- **Fix:** Use device-neutral copy: **"Toque ou passe o mouse sobre um estado para ver os números; toque de novo para abrir."** Alternatively, render two spans and toggle them with `@media (hover:hover)`.

### CIT-04: Tapping a chart draws a blue focus rectangle around the plot
- **Severity:** minor · **Type:** UI · **URL:** `/ba/conceicao-do-almeida` (MDE trend chart)
- **Steps:** Tap on the line or area of the first chart.
- **Expected:** Only the tooltip appears.
- **Actual:** A thick blue outline appears around the whole plot area. `document.activeElement` is `g.recharts-zIndex-layer_100` with `outline: auto 5px`. Reproduced 2/2 on this city. It does not happen when the tap lands on empty plot space (Goiás).
- **Evidence:** `qa/reports/citizen/ring_conceicao-do-almeida_1.png`, `qa/reports/citizen/chart_tap.png`
- **Root cause:** Recharts' focusable layers (accessibility layer) with no `:focus-visible` scoping. See `web/src/components/TrendChart.tsx`, `web/src/components/MultiLine.tsx`, `web/src/components/ui/chart.tsx`.
- **Fix:** In `globals.css`, add `.recharts-wrapper :focus:not(:focus-visible){outline:none}`, which keeps keyboard focus visible.

### CIT-05: Jargon with no in-place explanation on the city page
- **Severity:** major · **Type:** content · **URL:** any city page
- **Actual:** The page uses these terms without explanation:
  - MDE ("MDE 2025")
  - "p.p." ("+14,5 p.p. vs 2024")
  - "Fundeb em salários"
  - "Déficit não compensado"
  - "Mediana BA"
  - "região imediata"
  - "SIOPE ↗" (a bare link)
  - "IBGE 2908309"
  - "Fundeb não usado" / "Saldo devedor" / "EC 119/2022" (table footnote)
  - CACS-Fundeb, e-SIC, TCM-BA / MP (kit)

  Definitions exist only in "Metodologia", which is cut off in the mobile nav as "Metod…", and nothing on the city page links to them.
- **Evidence:** `qa/reports/citizen/c__ba_conceicao_do_almeida_0.png`, `qa/reports/citizen/c__ba_conceicao_do_almeida_2.png`, `qa/reports/citizen/a360_city_top.png`
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx` (Stat labels ~L190–260, footnotes ~L349+); `web/src/components/kit/stat.tsx`.
- **Fix:** Add a small "O que é isso?" line under the hero and a tap-able (not hover) info popover on each Stat. Proposed copy:
  - **MDE**: "Dinheiro de impostos que a prefeitura usou em educação (escolas, professores, transporte escolar). A Constituição exige pelo menos 25%."
  - **"+14,5 p.p. vs 2024"**: replace with **"14,5 pontos a mais que em 2024"**, or "subiu de 10,5% para 25,0%".
  - **Fundeb em salários**: "Do dinheiro do Fundeb (fundo da educação básica), quanto foi para pagar professores e profissionais. Mínimo: 70%."
  - **Déficit não compensado**: "Quanto deixou de ir para a educação nos anos abaixo de 25% e ainda não foi reposto."
  - **Mediana BA**: "Valor típico das cidades da Bahia."

  Rename "Metodologia" in the nav to "Como ler" or "Sobre" on mobile.

### CIT-06: "What can I do" (Kit de ação) is buried at the bottom and hard to act on
- **Severity:** major · **Type:** UX · **URL:** any city page (`#agir`)
- **Steps:** Arrive on a city page and look for what to do.
- **Actual:** The kit is the last panel, about 6,000 px down, with no link to it from the hero. Its tabs are cut off at 390 px ("R…", "Comunicação ao TCM-BA / MP" off-screen). The only action is "Copiar texto". There is no WhatsApp/e-mail send and no link to the city's e-SIC or ouvidoria. Letters open with "Com fundamento na Lei nº 12.527/2011…", which is fine for officials, but nothing helps a parent choose which letter to send.
- **Evidence:** `qa/reports/citizen/c__ba_conceicao_do_almeida_3.png`
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx:469-482` (placement), `web/src/components/ActionKit.tsx` (tabs, single action), `web/src/lib/templates.ts`.
- **Fix:**
  1. Add a hero button next to Compartilhar: **"O que posso fazer?"** → `#agir`. When status is below or edge, also show a callout under the verdict.
  2. Replace the tabs with a vertical chooser list on mobile, with one plain sentence per option, for example "Pedir informações à prefeitura (qualquer pessoa pode, pela Lei de Acesso)", "Avisar o conselho do Fundeb", "Pedir a um vereador", "Denunciar ao Tribunal de Contas / Ministério Público".
  3. Add "Enviar por WhatsApp" (`wa.me/?text=`) and "Enviar por e-mail" (`mailto:?subject=&body=`) buttons next to "Copiar texto".
  4. Add a "Onde enviar" link (Fala.BR / e-SIC of the prefeitura, or a search hint).

### CIT-07: Search does not tolerate typos and hides results beyond 8
- **Severity:** minor (major for very common names) · **Type:** UX · **URL:** any page → search
- **Steps:** Search "conceicao do almeda", "sto antonio" and "sao joao".
- **Actual:**
  - The first two return 0 results.
  - "sao joao" shows 8 of 54 municipalities, with no "ver mais" and no hint to add the UF. São João do Piauí is unreachable without typing more.
  - "S. Paulo" ranks "Paulo Afonso" second.
  - "bom jesus go" returns "Córrego do Bom Jesus (MG)" because "go" is matched inside "corrego".
- **Evidence:** `qa/reports/citizen/search_conceicao_do_almeda.png`, `qa/reports/citizen/search_sao_joao.png`, `search.mjs` output
- **Root cause:** `web/src/components/SearchPalette.tsx`. `rankName` is exact/prefix/substring only, there is a fixed `limit` of 8, and `readings()` keeps the raw reading even when a UF token is detected.
- **Fix:**
  - Add a fallback edit-distance pass (Damerau ≤1 per word, or a trigram score) when there are 0 hits, labelled **"Você quis dizer…"**.
  - Expand common abbreviations (`sto`→santo, `sta`→santa, `s.`→são, `n. sra`→nossa senhora).
  - When results exceed the limit, show "**+46 municípios.** Digite também o estado, ex.: 'são joão pi'", or allow scrolling up to 50.
  - When a 2-letter UF token is present and matches a UF, drop the unfiltered reading.

### CIT-08: Home and watchlist download the whole 2.3 MB dataset on a phone
- **Severity:** major · **Type:** perf · **URL:** `/`, `/acompanhar`
- **Steps:** Load `/` on a phone and inspect the network.
- **Actual:** `/data/municipios.json` is fetched eagerly: 2,273 KB uncompressed from dev, about 870 KB gzip -9. Home transfers about 4.0 MB in dev. `/acompanhar` fetches the full file to show one city (3.4 MB total in dev). On a 1.6 Mbps prepaid connection that is about 10 s of data use before the "Municípios" map toggle is even used.
- **Evidence:** `weight.mjs` output (`/ totalKB 4061`, `/acompanhar totalKB 3386`), `perf.mjs`
- **Root cause:** `web/src/components/territory/TerritoryDashboard.tsx:121-129` (eager `loadAllRows()` on mount); `web/src/components/Watchlist.tsx` (uses `loadAllRows`); `web/src/lib/rows.ts:156`.
- **Fix:**
  - Load rows lazily, only when the "Municípios" map, histogram or deficit list scrolls into view (IntersectionObserver) or is toggled.
  - Precompute the home aggregates server-side, since they are already in `states.json`/`meta`.
  - For `/acompanhar`, fetch only the starred cities: a per-city JSON (`/data/m/{id}.json`) or `indice.json` plus the MDE series.
  - Make sure the production host gzips/brotlis JSON. The dev route returned no `content-encoding`.

### CIT-09: Ranking card wording is confusing ("5.510º de 5.560 … Aplicou mais que 1% dos municípios")
- **Severity:** minor · **Type:** content · **URL:** `/ba/conceicao-do-almeida`
- **Actual:** A huge "5.510º" plus "aplicou mais que 1%" reads as a double negative for a parent.
- **Evidence:** `qa/reports/citizen/c__ba_conceicao_do_almeida_1.png`
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx:281-300`
- **Fix:** Lead with plain language: **"Entre as 417 cidades da Bahia, só 3 aplicaram menos que Conceição do Almeida em 2025."** Keep the ordinal as secondary text.

### CIT-10: City that stopped declaring shows a green "Cumpre" first
- **Severity:** minor · **Type:** content · **URL:** `/rn/porto-do-mangue`
- **Actual:** The first badge is a green "Cumpre 25% em 2023", next to a red "Não declarou 2025". The verdict line ("Em 2023, aplicou 34,83% — acima do mínimo"), which is also the WhatsApp share text, never says the city sent nothing for 2024–2025. The info box further down does.
- **Evidence:** `qa/reports/citizen/c__rn_porto_do_mangue_0.png`
- **Root cause:** `web/src/app/[uf]/[slug]/page.tsx:132-145` (verdict uses the last reported year and ignores later `nd` years).
- **Fix:** When later years are `nd`, put the non-declaration first: **"Não enviou os dados de 2024 e 2025 ao governo federal. No último ano informado (2023), aplicou 34,83%."** Badge order: red first.

### CIT-11: Small touch targets
- **Severity:** minor · **Type:** a11y · **URL:** city pages, header
- **Actual:**
  - Header search 32×32.
  - Breadcrumb links and switchers 24 px high.
  - "SIOPE" source links in the year table 20 px.
  - Vizinhos rows 32 px.
  - "Copiar texto" 28 px.
  - Footer nav links 17 px.
  - Theme toggles 28 px.

  WCAG 2.5.8 sets a 24 px minimum, and comfortable thumb targets are about 44 px.
- **Evidence:** `interact.mjs` output ("small targets 36…")
- **Root cause:** `web/src/components/Breadcrumbs.tsx`, `web/src/components/kit/nav.tsx`, `web/src/components/ui/button.tsx` (`size="sm"`/icon sizes), Vizinhos list in `web/src/app/[uf]/[slug]/page.tsx:~436`.
- **Fix:** Use `min-h-11` for list rows and nav links on `<sm`, `size-11` for header icon buttons, and padded hit areas (`py-2.5`) for breadcrumbs and footer links.

### CIT-12: Mobile top nav is cut off with no scroll affordance
- **Severity:** polish · **Type:** UI · **URL:** all
- **Actual:** "Metodologia" is clipped to "Metod…" or "M" at 360 px, with no fade or chevron to show that the nav scrolls.
- **Evidence:** `qa/reports/citizen/a360_explorar.png`
- **Root cause:** `web/src/components/kit/nav.tsx` / `nav-items.ts`
- **Fix:** Add a right-edge fade mask, or shorten the labels on mobile ("Sobre" instead of "Metodologia", "Lista" instead of "Explorar").

### CIT-13: Search dialog shows an "Esc" key hint and no close button on phones
- **Severity:** polish · **Type:** UI · **URL:** search
- **Actual:** A non-interactive `Esc` kbd chip is shown on touch devices, and `showCloseButton={false}`. Users must tap the backdrop to close.
- **Evidence:** `qa/reports/citizen/search_open.png`
- **Root cause:** `web/src/components/SearchPalette.tsx:372,397`
- **Fix:** On `(hover:none)`, replace the chip with a "Fechar" text button (44 px).

### CIT-14: Watchlist table hides the year series off-screen; empty-state promises updates that never arrive
- **Severity:** polish · **Type:** UX · **URL:** `/acompanhar`
- **Actual:** At 360 px only "Município | Em 2025" is visible, and the year-by-year columns are clipped with no hint. The empty state says "para você conferir quando sair um novo relatório", but there are no alerts.
- **Evidence:** `qa/reports/citizen/a360_acompanhar.png`, `qa/reports/citizen/c__acompanhar_0.png`
- **Root cause:** `web/src/components/Watchlist.tsx:62` and the table layout.
- **Fix:** On mobile, render a card per city with a sparkline and the verdict sentence. Change the copy to **"Volte aqui quando sair um novo ano de dados."**

### Verified as working (no bug)
- Accent-insensitive search.
- UF disambiguation (Itapeva SP/MG; "picos pi").
- Tap-tooltip-then-tap-to-open on all maps.
- Chart tooltips on tap, which dismiss on an outside tap.
- WhatsApp share URL and text.
- "Copiar texto" writes the letter to the clipboard.
- Watchlist persistence.
- Dark mode contrast.
- No horizontal page overflow at 360 and 390 px.
- No console errors.

## 3. Top 5 recommendations for this persona
1. **Search-first home:** a big "Digite o nome da sua cidade" field in the hero, with typo tolerance and "ver mais" (CIT-01, CIT-07).
2. **A plain-language answer block at the top of the city page** with four sentences matching the four questions:
   - "Está aplicando o mínimo?"
   - "Melhorou ou piorou?" ("subiu de 10,5% para 25,0%")
   - "E as vizinhas?" ("8 de 12 cidades da região aplicaram mais")
   - "O que eu posso fazer?" (a button to `#agir`)
3. **Explain every number in place** with tap-able "O que é isso?" popovers, and drop "p.p.", "mediana" and "déficit não compensado" from headline positions (CIT-05, CIT-09).
4. **Make the kit actionable from a phone:** a chooser written in plain words, send by WhatsApp/e-mail, and a link to where to send it (CIT-06).
5. **Respect prepaid data:** stop shipping the full 2.3 MB dataset on home and watchlist, and lazy-load maps and histograms below the fold (CIT-08). Also fix the touch-only glitches (CIT-02, CIT-03, CIT-04, CIT-11).

---

## Round 2 — re-validation (commit ff4a309, production build on :3299)

Same personas and devices as round 1: iPhone 13 touch, plus Android 360×740 with touch, 4× CPU and about 1.6 Mbps / 150 ms. Scripts and screenshots are in `qa/reports/citizen/r2/` (`r2a.mjs` search/home, `r2b.mjs` city page, `r2c.mjs` Android/watchlist/dark, `perf.mjs`, `weight.mjs`, `zoom.mjs`). No console errors and no horizontal overflow at 360 or 390 px on any route.

### Journey, round 2
- **WhatsApp link → city page.**
  - All four questions are now answered in the hero in about 15 s. The verdict carries the trend in plain words: "Em 2025, aplicou 25,00% … cumpriu, mas no limite. Subiu 14,5 pontos em relação a 2024 (10,47%)."
  - "O que posso fazer?" is one tap and jumps to `#agir`.
  - Vizinhos is still about 3 screens down, but the ranking now reads "0 aplicaram menos e 413 aplicaram mais".
- **Home → my city.** A 44 px "Digite o nome da sua cidade" field sits above the fold (y≈434 on iPhone). Tapping it opens the palette with the input focused. Typos and abbreviations now work, there is "Ver todos os N", and the palette has a "Fechar" button.
- **Perf, throttled phone, production build** (transferred bytes):

  | Page | Transferred | Was (round 1, dev) | FCP | load | network idle |
  |---|---|---|---|---|---|
  | `/` | 910 KB | 4.0 MB | ~0.95 s | 2.5 s | 5.6 s |
  | city page | 890 KB | 1.9 MB | ~0.95 s | 3.7 s | 5.4 s |
  | `/acompanhar` | 550 KB | 3.4 MB | ~0.95 s | 1.8 s | 4.0 s |

  `municipios.json` is no longer fetched on home or watchlist, and it is served with brotli.

### Status of round-1 findings

| ID | Status | Evidence / note |
|---|---|---|
| CIT-01 home search | **FIXED** | `r2/c___0.png`. The field is 358×44 and opens the palette with focus. "Baixar CSV" still comes before it visually (acceptable). |
| CIT-02 watch star-off on touch | **FIXED** | `r2/watch_0.png`. Tap → filled star + "Acompanhando"; tap again → "Acompanhar". A status message "Removido da sua lista…" is announced. Reproduced 2× (iPhone and Android). |
| CIT-03 "Passe o mouse/Clique" | **FIXED** | Maps and bars now say "Toque ou passe o mouse… toque de novo ou clique". A leftover "clique para fixar" remains in the `MultiLine.tsx:113` tooltip, which is not on the citizen path. |
| CIT-04 chart focus rectangle | **FIXED** | After tapping, `activeElement` has `outline: none` (2/2 taps). `r2/chart_tap.png` |
| CIT-05 jargon | **FIXED** | 19 dotted-underline glossary triggers on the city page (MDE, Fundeb, Déficit, Mediana, SIOPE, EC 119, pontos percentuais, região imediata, e-SIC, CACS-Fundeb, Tribunal de Contas). They open on tap and close on an outside tap. The copy is plain (`r2/glossary_mde.png`). "p.p." is replaced by "pontos". The triggers are small, see CIT-11. |
| CIT-06 action kit | **FIXED** | Hero button jumps to `#agir`. The four options are 60 px cards with plain titles and an explanation ("Qualquer pessoa pode pedir… 20 dias"). Each has "Onde enviar" with Fala.BR and e-SIC search links, plus Copiar / WhatsApp (`api.whatsapp.com/send?text=<letter>`) / E-mail (`mailto:?subject=…&body=…`). |
| CIT-07 search | **FIXED** | "conceicao do almeda" → "Você quis dizer… Conceição do Almeida". "sto antonio" → 38 results. "sao joao" → "Ver todos os 54 resultados", which expands to the full list. "S. Paulo" ranks the São Paulo cities only. "bom jesus go" → only Bom Jesus de Goiás. "xiquexique" → Xique-Xique. "bahia" and "para" list the states first. |
| CIT-08 page weight | **FIXED** | Figures in the perf table above. `/acompanhar` makes no `/data/*` request. |
| CIT-09 ranking wording | **FIXED** | "0 aplicaram menos e 413 aplicaram mais que Conceição do Almeida; 3 aplicaram o mesmo." The ordinal is now secondary text. |
| CIT-10 non-declaring city | **FIXED** | `r2/a360_nd_city.png`. Red "Não declarou 2024 e 2025" plus "Último dado: 2023". The verdict and the WhatsApp share text start with "Não enviou ao governo federal os dados de 2024 e 2025…". The year picker defaults to 2023. |
| CIT-11 touch targets | **PARTIAL** | Kit cards (60 px), buttons (32–44 px), Vizinhos rows and the header are improved. Still under 24 px: the inline glossary triggers (16–20 px tall, e.g. "Mediana", "pontos percentuais", "EC 119/2022"), "Voltar para 2025" (20 px), e-SIC / CACS-Fundeb / Tribunal de Contas in the kit intro (20 px), and footer links. Inline text links are exempt from WCAG 2.5.8, but on a phone the 16 px glossary words are hard to hit. Add `py-1` / an `after:` hit-area expansion. |
| CIT-12 nav clipped | **FIXED** | Mobile nav reads "Painel · Explorar · Salvos · Dados · Método" and fits at 360 px. See CIT-19 for the naming inconsistency. |
| CIT-13 Esc / no close | **FIXED** | A "Fechar" button (69×36) closes the palette. |
| CIT-14 watchlist on mobile | **FIXED** | `r2/a360_acompanhar.png`. One card per city with a badge, "N anos abaixo de 25%", an 18-year grid of colored cells, and remove (×). |

**Totals:** 13 FIXED · 1 PARTIAL · 0 NOT FIXED · 0 REGRESSED among the round-1 findings. CIT-15 below is a new regression introduced in this round.

### New findings (round 2)

#### CIT-15: Chart y-axis labels clipped; "80%" reads as "30%"
- **Severity:** minor · **Type:** bug (regression) · **URL:** any city page, the Fundeb and MDE charts
- **Steps:** Open `/ba/conceicao-do-almeida` on a 390 or 360 px phone and look at "% do Fundeb pago aos profissionais".
- **Expected:** Full tick labels: 50%, 60%, 70%, 80%, 90%.
- **Actual:** The first digit is cut off. Tick text starts at x=31 while the SVG starts at x=33, so "80%" looks like "30%" and "65%" like "35%". The MDE chart has the same 2 px clip but it is less visible. Reproduced on 2 cities × 2 devices.
- **Evidence:** `r2/zoom_fundeb_conceicao-do-almeida.png`, `r2/a360_fundeb_chart.png`, `r2/zoom.mjs` output
- **Suspected cause:** `web/src/components/TrendChart.tsx:64`. `yWidth = max(36, chars*7.5+14)` underestimates the tabular-figure width plus tick margin (it changed with the ACA y-axis fix).
- **Fix:** Use about 8.5 px per character (+16), or measure with canvas `measureText`. Alternatively add `overflow: visible` on the SVG and `margin.left: 4`.

#### CIT-16: The WhatsApp link preview points to `localhost:3210` unless `NEXT_PUBLIC_SITE_URL` is set
- **Severity:** major (deploy risk) · **Type:** bug/config · **URL:** every page's `<head>`
- **Actual:** In the production build on :3299, the meta tags are `og:url = http://localhost:3210/ba/conceicao-do-almeida` and `og:image = http://localhost:3210/ba/conceicao-do-almeida/opengraph-image?…`. If the deploy forgets the env var, every WhatsApp share shows no image or preview, and that is this persona's main entry point. The OG image itself renders well: 1200×630, ~55 KB, with name, %, status pill and an 18-year bar strip (`r2/og__*.png`).
- **Root cause:** `web/src/lib/site.ts:2`, which falls back to a hard-coded `http://localhost:3210`.
- **Fix:** Fall back to `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` (or `VERCEL_URL`) before localhost. Optionally fail the build in production when no public origin is resolvable.

#### CIT-17: The "Subiu/caiu X pontos" trend line compares against a value the page flags as atypical
- **Severity:** minor · **Type:** content · **URL:** `/ba/conceicao-do-almeida` (2025 view); also `og:description` and the share text
- **Actual:** The hero, share text and OG description say "Subiu 14,5 pontos em relação a 2024 (10,47%)". The same page marks 2024 as "Valor atípico… pode ser erro de declaração". A parent forwarding this would report a 14.5-point jump that probably never happened.
- **Root cause:** The verdict builder in `web/src/app/[uf]/[slug]/` (`city-year.tsx` / `page.tsx`) does not check the `atipico` flag on the comparison year.
- **Fix:** When the previous year is atypical, compare with the last non-atypical year, or hedge. Proposed copy: **"O valor declarado em 2024 (10,47%) é atípico; em relação a 2023 (26,40%), ficou 1,4 ponto abaixo."**

#### CIT-18: The OG image draws very low years as an almost-empty stub
- **Severity:** polish · **Type:** UI · **URL:** `/ba/conceicao-do-almeida/opengraph-image`
- **Actual:** The bar strip has a non-zero baseline. The 2024 value (10,47%) is drawn as a thin red line at the bottom, which reads like "no data" (non-declared years look similar: pale stubs).
- **Evidence:** `r2/og__ba_conceicao-do-almeida_opengraph-image.png`, `r2/og__rn_porto-do-mangue_opengraph-image.png`
- **Fix:** Use a zero baseline, or give a below-floor value a visible minimum height with the value labelled, e.g. "10,5%". Distinguish "não declarou" with a hatched or outline bar.

#### CIT-19: Inconsistent names for the same feature
- **Severity:** polish · **Type:** content
- **Actual:** The nav says "Salvos". The page H1, the button state and the footer say "Acompanhando" / "Acompanhar". The nav says "Método" while the footer says "Metodologia". A low-literacy user may not connect "Salvos" with the "Acompanhar" button.
- **Root cause:** `web/src/components/kit/nav-items.ts`, the footer in `web/src/app/layout.tsx`, `web/src/app/acompanhar/page.tsx`.
- **Fix:** Pick one wording. Either use "Salvos" everywhere (button "Salvar" / "Salvo"), or keep "Acompanhar" and use the short nav label "Seguindo".

#### CIT-20: Data use on phones: route prefetch and uncached geometry
- **Severity:** polish · **Type:** perf · **URL:** `/`, city pages
- **Actual:**
  - The city page prefetches `/ba?_rsc` (76 KB), and home prefetches other routes' RSC (e.g. `/to?_rsc` 30 KB) just because links are in view.
  - `/geo/br.topo.json` (1 MB raw, 273 KB on the wire) is served with `Cache-Control: public, max-age=0`, so it is revalidated on every visit.
- **Fix:**
  - Set `prefetch={false}` (or prefetch on hover/tap only) for breadcrumb and map-list links. You can also respect `navigator.connection.saveData`.
  - Serve `/geo/*` with long immutable caching and versioned URLs, as already done for `indice.json?v=`.
  - Consider a lighter states-only topology for the home "Estados" map.

#### CIT-21: The kit's e-mail body is about 4,000 characters
- **Severity:** polish · **Type:** UX · **URL:** `#agir` → E-mail
- **Actual:** The `mailto:` href is about 4,000 characters. Some Android mail intents and webmail handlers truncate long `mailto` bodies (around 2,000 characters). The WhatsApp text is about 2,300 characters, which is fine.
- **Fix:** If `href.length > 1800`, fall back to copying the body to the clipboard and opening `mailto:?subject=` with a toast: **"Texto copiado — cole no corpo do e-mail."**

#### CIT-22: Watchlist grid does not mark atypical years
- **Severity:** polish · **Type:** UI · **URL:** `/acompanhar`
- **Actual:** Conceição do Almeida's 2024 shows as a solid red "10,5" cell, with none of the "atípico" marking the city page uses.
- **Fix:** Add a ⚠ corner or dashed border to the cell and an `aria-label` / `title` of "valor atípico".

### Top remaining items for this persona
1. **CIT-16:** set `NEXT_PUBLIC_SITE_URL` or a Vercel fallback, or WhatsApp previews break in production.
2. **CIT-15:** clipped y-axis digits ("80%" → "30%") on the city charts.
3. **CIT-17:** trend sentence built on an atypical year, which also propagates into the share text and OG description.
4. **CIT-11:** small glossary hit areas.
5. **CIT-19:** "Salvos" vs "Acompanhar" naming.
