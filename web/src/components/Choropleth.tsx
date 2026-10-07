"use client";

import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import { useRouter } from "next/navigation";
import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { NO_DATA_COLOR, type Bin } from "@/lib/bins";
import { cn } from "@/lib/utils";

type Props = {
  /** "br" = national file (objects mun + uf); a UF sigla = that state's finer municipal mesh */
  src: "br" | string;
  layer: "mun" | "uf";
  /** keep only these UF codes (IBGE, 2 digits); omit for all */
  ufCodes?: number[];
  fill: (id: number) => string;
  hatched?: (id: number) => boolean;
  /** shapes to outline in the foreground colour: "below the minimum" survives grayscale, CVD and print */
  outlined?: (id: number) => boolean;
  /** accessible name of a shape; when given (and the map has ≤ 40 shapes) shapes become keyboard links */
  label?: (id: number) => string;
  /** id of an element (table, list) holding the same data, announced with the map */
  describedBy?: string;
  tooltip: (id: number) => ReactNode;
  href?: (id: number) => string | null;
  highlight?: number | null;
  /** draw state borders over a municipal layer */
  ufBorders?: boolean;
  ariaLabel: string;
  height?: number;
};

const W = 800;
const topoCache = new Map<string, Promise<Topology>>();
function loadTopo(src: string) {
  const url = src === "br" ? "/geo/br.topo.json" : `/geo/uf/${src.toUpperCase()}.topo.json`;
  let p = topoCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    p.catch(() => topoCache.delete(url));
    topoCache.set(url, p);
  }
  return p;
}

/** A projected shape: path, centroid and on-screen size (max bbox side, viewBox units ≈ CSS px). */
type Shape = { id: number; d: string; cx: number; cy: number; size: number };
type Geom = { shapes: Shape[]; borders: string | null; outline: string | null; html: string };

/**
 * Projection is the expensive part of the first municipal render (5,570 shapes): results are cached per
 * topology/layer/scope/height, and `prewarmMap()` can compute them on user intent before the layer is shown.
 */
const geomCache = new Map<string, Geom>();
function project(topo: Topology, src: string, layer: "mun" | "uf", ufKey: string, height: number, ufBorders: boolean): Geom {
  const key = [src, layer, ufKey, height, ufBorders].join("|");
  const hit = geomCache.get(key);
  if (hit) return hit;
  const codes = ufKey ? new Set(ufKey.split(",").map(Number)) : null;
  const ufOf = (id: number) => (id >= 100 ? Math.floor(id / 100000) : id);
  const obj = topo.objects[layer] as GeometryCollection<{ id: number }>;
  const fc = feature(topo, obj) as FeatureCollection<Geometry, { id: number }>;
  const feats = codes ? fc.features.filter((f) => codes.has(ufOf(f.properties.id))) : fc.features;
  const sel: FeatureCollection<Geometry, { id: number }> = { type: "FeatureCollection", features: feats };
  const proj = geoMercator().fitSize([W, height], sel);
  const path = geoPath(proj);
  const shapes: Shape[] = feats.map((f) => {
    const [[x0, y0], [x1, y1]] = path.bounds(f as Feature);
    const [cx, cy] = path.centroid(f as Feature);
    return { id: f.properties.id, d: path(f as Feature) ?? "", cx, cy, size: Math.max(x1 - x0, y1 - y0) };
  });
  let borders: string | null = null;
  let outline: string | null = null;
  if (ufBorders && topo.objects.uf) {
    const ufObj = topo.objects.uf as GeometryCollection<{ id: number }>;
    const keep = (g: { properties?: object }) => !codes || codes.has((g.properties as { id: number }).id);
    borders = path(mesh(topo, ufObj, (a, b) => a !== b && keep(a) && keep(b)) as MultiLineString);
    outline = codes
      ? path(mesh(topo, ufObj, (a, b) => (a === b ? keep(a) : keep(a) !== keep(b))) as MultiLineString)
      : path(mesh(topo, ufObj, (a, b) => a === b) as MultiLineString);
  }
  // the shapes are injected as one markup string: building 5,570 React elements is most of the first-render cost
  const keyboard = shapes.length <= KEYBOARD_MAX;
  const html = shapes
    .map((sh) => `<path data-id="${sh.id}" d="${sh.d}" fill="var(--bin-nd)" stroke="var(--background)" stroke-linejoin="round"${keyboard ? ' tabindex="0" role="link"' : ""}></path>`)
    .join("");
  const g = { shapes, borders, outline, html };
  geomCache.set(key, g);
  return g;
}

/** Fetch and project a map ahead of time (on hover/focus of the control that will show it). */
export function prewarmMap(src: string, layer: "mun" | "uf", ufCodes: number[] | undefined, height: number, ufBorders: boolean) {
  const idle = (cb: () => void) => ("requestIdleCallback" in window ? window.requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 50));
  loadTopo(src)
    .then((t) => idle(() => project(t, src, layer, ufCodes?.join(",") ?? "", height, ufBorders)))
    .catch(() => {});
}

const KEYBOARD_MAX = 40;
/** Shapes smaller than this (≈ px) get a centroid dot when marked, and a larger invisible hit area on small maps. */
const TINY = 8;

export default function Choropleth({
  src, layer, ufCodes, fill, hatched, outlined, label, describedBy, tooltip, href, highlight, ufBorders, ariaLabel, height = 560,
}: Props) {
  const [topo, setTopo] = useState<Topology | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ id: number; x: number; y: number; w: number; h: number; touch?: boolean; kbd?: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pointer = useRef<string>("mouse");
  const g = useRef<SVGGElement>(null);
  const router = useRouter();
  const hatchId = `hatch-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    let live = true;
    loadTopo(src)
      .then((t) => live && setTopo(t))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [src]);

  const ufKey = ufCodes?.join(",") ?? "";
  const geom = useMemo(() => (topo ? project(topo, src, layer, ufKey, height, !!ufBorders) : null), [topo, src, layer, ufKey, height, ufBorders]);

  const hoverShape = hover && geom ? geom.shapes.find((s) => s.id === hover.id) : null;
  const hiShape = highlight != null && geom ? geom.shapes.find((s) => s.id === highlight) : null;
  const dense = (geom?.shapes.length ?? 0) > 1500;
  const keyboard = !!label && !!href && (geom?.shapes.length ?? 99) <= KEYBOARD_MAX;
  // A11Y-18: below-minimum shapes are redrawn on top with a background halo + critical stroke, and tiny ones get a
  // dot, so the mark survives grayscale/CVD and isn't lost among 3px municipalities.
  const marked = useMemo(() => (geom && outlined ? geom.shapes.filter((sh) => outlined(sh.id)) : []), [geom, outlined]);
  // built as one markup string: in 2020–21 hundreds of municipalities are marked and this redraws on every year step
  const markedHtml = useMemo(() => {
    if (!marked.length) return "";
    const halo = marked.map((sh) => `<path d="${sh.d}" fill="none" stroke="var(--background)" stroke-width="${dense ? 2 : 3}" stroke-linejoin="round"></path>`);
    const line = marked.map((sh) => `<path d="${sh.d}" fill="none" stroke="var(--critical-ink)" stroke-width="${dense ? 0.9 : 1.4}" stroke-linejoin="round"></path>`);
    const dots = marked
      .filter((sh) => sh.size < TINY)
      .map((sh) => `<circle cx="${sh.cx.toFixed(1)}" cy="${sh.cy.toFixed(1)}" r="${dense ? 2.6 : 3.5}" fill="var(--critical-ink)" stroke="var(--background)" stroke-width="1.2"></circle>`);
    return halo.join("") + line.join("") + dots.join("");
  }, [marked, dense]);
  // written after paint (like the fills) so the DOM swap doesn't land inside Recharts' commit-time measurements
  const markRef = useRef<SVGGElement>(null);
  useEffect(() => {
    if (markRef.current) markRef.current.innerHTML = markedHtml;
  }, [markedHtml, geom]);
  const tiny = useMemo(() => (geom && geom.shapes.length <= KEYBOARD_MAX && href ? geom.shapes.filter((sh) => sh.size < TINY) : []), [geom, href]);

  // Colours, outlines and labels are written straight onto the stable <path> nodes: a year or metric change
  // touches thousands of attributes instead of re-rendering thousands of React elements (PERF-03).
  // Passive effect (after paint), not layout effect: dirtying 5,570 nodes before Recharts' own commit-time
  // getTotalLength() calls forced a full style recalc per call (~400 ms per year step at 4× CPU).
  useEffect(() => {
    const el = g.current;
    if (!el || !geom) return;
    const base = dense ? 0.12 : 0.6;
    for (const node of Array.from(el.children)) {
      const id = Number(node.getAttribute("data-id"));
      node.setAttribute("fill", hatched?.(id) ? `url(#${hatchId})` : fill(id));
      node.setAttribute("stroke", layer === "uf" ? "color-mix(in oklab, var(--foreground) 28%, var(--background))" : "var(--background)");
      node.setAttribute("stroke-width", String(base));
      if (keyboard) node.setAttribute("aria-label", label!(id));
      else {
        node.removeAttribute("aria-label");
        node.removeAttribute("tabindex");
        node.removeAttribute("role");
      }
    }
  }, [geom, fill, hatched, label, keyboard, dense, layer, hatchId]);

  const showAt = (target: Element, id: number) => {
    const box = wrap.current!.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    setHover({ id, x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, w: box.width, h: box.height, kbd: true });
  };

  const idFrom = (t: EventTarget) => {
    const v = (t as Element).getAttribute?.("data-id");
    return v ? Number(v) : null;
  };

  return (
    <div ref={wrap} className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full select-none"
        role={keyboard ? "group" : "img"}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onFocus={(e) => {
          const id = idFrom(e.target);
          // keyboard focus only: a tap also focuses the shape and has its own two-step flow
          if (id != null && (e.target as Element).matches(":focus-visible")) showAt(e.target as Element, id);
        }}
        onBlur={() => setHover((h) => (h?.kbd ? null : h))}
        onKeyDown={(e) => {
          const id = idFrom(e.target);
          if (id == null) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const to = href?.(id);
            if (to) router.push(to);
          }
          if (e.key === "Escape") setHover(null);
        }}
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const id = idFrom(e.target);
          if (id == null) return setHover(null);
          const box = wrap.current!.getBoundingClientRect();
          setHover({ id, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height });
        }}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
        onClick={(e) => {
          const id = idFrom(e.target);
          // touch: the first tap shows the tooltip, tapping the same shape again opens it
          if (pointer.current !== "mouse" && id != null && hover?.id !== id) {
            const box = wrap.current!.getBoundingClientRect();
            return setHover({ id, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height, touch: true });
          }
          const to = id != null && href?.(id);
          if (to) router.push(to);
          else setHover(null);
        }}
      >
        <defs>
          <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill={NO_DATA_COLOR} />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--critical)" strokeWidth="1.2" strokeOpacity="0.8" />
          </pattern>
        </defs>
        {!geom && (
          <text x={W / 2} y={height / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize="13">
            {failed ? "Não foi possível carregar o mapa." : "Carregando mapa…"}
          </text>
        )}
        {geom && <Shapes ref={g} html={geom.html} clickable={!!href} keyboard={keyboard} />}
        {geom?.borders && <path d={geom.borders} fill="none" stroke="var(--foreground)" strokeWidth={0.6} strokeOpacity={0.35} strokeLinejoin="round" pointerEvents="none" />}
        {geom?.outline && <path d={geom.outline} fill="none" stroke="var(--foreground)" strokeWidth={0.7} strokeOpacity={0.4} strokeLinejoin="round" pointerEvents="none" />}
        {geom && <g ref={markRef} pointerEvents="none" data-marked="" />}
        {/* A11Y-20: tiny states (DF, SE, AL…) get a 16px tap target */}
        {tiny.map((sh) => (
          <circle key={`t${sh.id}`} data-id={sh.id} cx={sh.cx} cy={sh.cy} r={8} fill="transparent" className="cursor-pointer" />
        ))}
        {hiShape && <path d={hiShape.d} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />}
        {hoverShape && <path d={hoverShape.d} fill="none" stroke="var(--foreground)" strokeWidth={keyboard ? 2 : 1.5} strokeLinejoin="round" pointerEvents="none" />}
      </svg>
      {hover && (
        <div
          className="animate-fade-in pointer-events-none absolute z-10 w-max max-w-60 min-w-44 rounded-lg bg-popover px-3 py-2.5 text-[13px] leading-5 text-popover-foreground shadow-pop"
          style={{
            left: Math.max(0, Math.min(hover.x + 14, hover.w - 240)),
            top: hover.y > hover.h * 0.65 ? undefined : hover.y + 14,
            bottom: hover.y > hover.h * 0.65 ? hover.h - hover.y + 14 : undefined,
          }}
        >
          {tooltip(hover.id)}
          {hover.touch && href?.(hover.id) && <div className="mt-2 border-t pt-1.5 text-xs font-medium text-brand-ink">Toque de novo para abrir →</div>}
          {hover.kbd && <div className="mt-2 border-t pt-1.5 text-xs text-muted-foreground">Enter para abrir</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Paths come from one cached markup string (see `project`): fills/strokes/labels are set imperatively by the
 * parent, so neither hover state nor a year change re-renders thousands of shapes.
 */
const Shapes = memo(function Shapes({
  ref, html, clickable, keyboard,
}: { ref: React.Ref<SVGGElement>; html: string; clickable: boolean; keyboard: boolean }) {
  return <g ref={ref} className={cn(clickable && "cursor-pointer", keyboard && "[&>path]:outline-none")} dangerouslySetInnerHTML={{ __html: html }} />;
});

const Swatch = ({ color, bordered, outlined }: { color: string; bordered?: boolean; outlined?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "inline-block size-2.5 shrink-0 rounded-[3px] forced-color-adjust-none",
      bordered && "shadow-[inset_0_0_0_1px_var(--axis)]",
      outlined && "shadow-[inset_0_0_0_1.5px_var(--critical-ink),inset_0_0_0_2.5px_var(--background)]",
    )}
    style={{ background: color }}
  />
);

/** Horizontal swatch legend: muted title, small rounded swatches, 12px labels; hatched = did not declare. */
export function Legend({ title, bins, nd = true, extra, outlined }: { title: string; bins: Bin[]; nd?: boolean; extra?: ReactNode; outlined?: (b: Bin) => boolean }) {
  return (
    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
      <div className="text-xs font-medium text-foreground">{title}</div>
      <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        {bins.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5 tnum">
            <Swatch color={b.color} outlined={outlined?.(b)} bordered={b.color === "var(--bin-zero)"} />
            {b.label}
          </li>
        ))}
        {nd && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--border)] forced-color-adjust-none"
              style={{ background: `repeating-linear-gradient(-45deg, var(--critical) 0 1px, var(--bin-nd) 1px 3px)` }}
            />
            Não declarou
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <Swatch color={NO_DATA_COLOR} bordered />
          Sem dados
        </li>
        {extra && <li className="flex items-center gap-1.5">{extra}</li>}
      </ul>
    </div>
  );
}
