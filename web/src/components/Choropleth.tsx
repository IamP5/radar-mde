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

type Shape = { id: number; d: string };

export default function Choropleth({
  src, layer, ufCodes, fill, hatched, tooltip, href, highlight, ufBorders, ariaLabel, height = 560,
}: Props) {
  const [topo, setTopo] = useState<Topology | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ id: number; x: number; y: number; w: number; h: number; touch?: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pointer = useRef<string>("mouse");
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
  const geom = useMemo(() => {
    if (!topo) return null;
    const codes = ufKey ? new Set(ufKey.split(",").map(Number)) : null;
    const ufOf = (id: number) => (id >= 100 ? Math.floor(id / 100000) : id);
    const obj = topo.objects[layer] as GeometryCollection<{ id: number }>;
    const fc = feature(topo, obj) as FeatureCollection<Geometry, { id: number }>;
    const feats = codes ? fc.features.filter((f) => codes.has(ufOf(f.properties.id))) : fc.features;
    const sel: FeatureCollection<Geometry, { id: number }> = { type: "FeatureCollection", features: feats };
    const proj = geoMercator().fitSize([W, height], sel);
    const path = geoPath(proj);
    const shapes: Shape[] = feats.map((f) => ({ id: f.properties.id, d: path(f as Feature) ?? "" }));
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
    return { shapes, borders, outline };
  }, [topo, layer, ufKey, height, ufBorders]);

  const hoverShape = hover && geom ? geom.shapes.find((s) => s.id === hover.id) : null;
  const hiShape = highlight != null && geom ? geom.shapes.find((s) => s.id === highlight) : null;
  const dense = (geom?.shapes.length ?? 0) > 1500;

  const idFrom = (t: EventTarget) => {
    const v = (t as Element).getAttribute?.("data-id");
    return v ? Number(v) : null;
  };

  return (
    <div ref={wrap} className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={ariaLabel}
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
        {geom && <Shapes shapes={geom.shapes} fill={fill} hatched={hatched} hatchId={hatchId} dense={dense} clickable={!!href} />}
        {geom?.borders && <path d={geom.borders} fill="none" stroke="var(--foreground)" strokeWidth={0.6} strokeOpacity={0.35} strokeLinejoin="round" pointerEvents="none" />}
        {geom?.outline && <path d={geom.outline} fill="none" stroke="var(--foreground)" strokeWidth={0.7} strokeOpacity={0.4} strokeLinejoin="round" pointerEvents="none" />}
        {hiShape && <path d={hiShape.d} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />}
        {hoverShape && <path d={hoverShape.d} fill="none" stroke="var(--foreground)" strokeWidth={1.5} strokeLinejoin="round" pointerEvents="none" />}
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
        </div>
      )}
    </div>
  );
}

/** Paths are memoised separately so hover state changes don't re-render thousands of shapes. */
const Shapes = memo(function Shapes({
  shapes, fill, hatched, hatchId, dense, clickable,
}: { shapes: Shape[]; fill: (id: number) => string; hatched?: (id: number) => boolean; hatchId: string; dense: boolean; clickable: boolean }) {
  return (
    <g className={clickable ? "cursor-pointer" : undefined}>
      {shapes.map((s) => (
        <path
          key={s.id}
          data-id={s.id}
          d={s.d}
          fill={hatched?.(s.id) ? `url(#${hatchId})` : fill(s.id)}
          stroke="var(--background)"
          strokeWidth={dense ? 0.12 : 0.6}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
});

const Swatch = ({ color, bordered }: { color: string; bordered?: boolean }) => (
  <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", bordered && "shadow-[inset_0_0_0_1px_var(--border)]")} style={{ background: color }} />
);

/** Horizontal swatch legend: muted title, small rounded swatches, 12px labels; hatched = did not declare. */
export function Legend({ title, bins, nd = true, extra }: { title: string; bins: Bin[]; nd?: boolean; extra?: ReactNode }) {
  return (
    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
      <div className="text-xs font-medium text-foreground">{title}</div>
      <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        {bins.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5 tnum">
            <Swatch color={b.color} />
            {b.label}
          </li>
        ))}
        {nd && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--border)]"
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
