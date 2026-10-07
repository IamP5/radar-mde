# Radar MDE design system (Vercel / Geist look, shadcn/ui on Base UI)

Read this before touching UI. Tokens live in `src/app/globals.css`.

## Principles
- Flat, quiet, precise. Hairline borders (`border`), no gradients, no glows, no grid backgrounds, no pulsing.
- Page = white `PageHeader` band (title + one-line muted description + actions) on top of the gray canvas (`bg-canvas`, #fafafa / #000); content in `PageBody` (max-w-7xl, px-4 sm:px-6, space-y-6).
- Cards = `Panel` (rounded-xl border bg-card, 15px semibold title, 13px muted description). Never nest panels. Use `divided` when the body is a table/chart that runs edge to edge.
- Text: `text-foreground` (primary), `text-muted-foreground` (secondary). Sentence case, never all-caps eyebrows. Numbers `tnum`. Geist Mono (`font-mono`) only for identifiers: IBGE codes, UF siglas in chips, ⌘K, years in compact chips, source metadata.
- Type: page title 24→32px semibold tracking-[-0.04em]; section 20px semibold -0.02em; card title 15px semibold; KPI value 26–28px semibold tracking-[-0.04em] tnum; label 13px muted; body 14–15px.
- Colors: brand blue `text-brand` / `bg-brand` / `text-brand-ink` (links); status `good`, `warning`, `critical` (+ `-soft` tints, `-ink` text). `bg-accent` = hover gray. `bg-muted` = gray track. Data: `--bin-1..5` diverging MDE, `--series-1..5` categorical (fixed order), `--seq-1..5`, `--red-1..5`, `--grid` gridlines, `--axis` baselines, `--ink` emphasis line.
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
- Tooltip: shadcn content with `indicator="line"`, values formatted pt-BR.
