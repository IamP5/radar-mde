"use client";

/**
 * The map: a full-bleed SVG of the 5,570 municipalities and 27 states in a fixed base space, moved by a camera
 * (translate + scale on one <g>). Navigation lives inside the map: click a state to fly in, click a city to land on it,
 * wheel / drag / pinch / keys to move freely. Labels, callouts and pulse markers are HTML overlays placed in screen
 * space every frame so they keep their size while the map zooms.
 */
import { LocateFixed, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ufOfMun, type Bbox, type BrGeo, type Shape } from "./geo";
import { ufCode, ufName, ufSigla, type Layer, type Level, type Scope } from "./model";

type Cam = { k: number; x: number; y: number };
export type Insets = { left: number; right: number; top: number; bottom: number };
export type Ping = { id: number; cx: number; cy: number; /** static dot, no pulse (crowded years, or while the years play) */ still?: boolean; /** restarts the pulse ring when it changes (the year); the dot itself persists */ epoch?: number; i?: number };
export type CityLabel = { id: number; name: string; cx: number; cy: number; pop: number };
export type UfTag = { text: string; color: string | null; /** fill is at the strong end of its scale: label uses --m-on-strong */ strong?: boolean };

export type StageProps = {
  geo: BrGeo | null;
  layer: Layer;
  /** level actually drawn (inside a state the municipalities are always drawn) */
  level: Level;
  scope: Scope;
  insets: Insets;
  hotBin: string | null;
  pings: Ping[];
  cityLabels: CityLabel[];
  ufTag: (code: number) => UfTag;
  loading: boolean;
  onPickUf: (uf: string | null) => void;
  onPickCity: (id: number | null) => void;
  tooltip: (h: { id: number; uf: number; level: Level }) => ReactNode;
  className?: string;
};

const CALLOUTS = ["RN", "PB", "PE", "AL", "SE", "ES", "RJ"];
const K_MAX = 900;

/** d3-interpolate's smooth zoom (van Wijk & Nuij): zooms out and back in on long trips. */
function smoothZoom(p0: [number, number, number], p1: [number, number, number], rho = 1.35) {
  const [ux0, uy0, w0] = p0;
  const [ux1, uy1, w1] = p1;
  const rho2 = rho * rho, rho4 = rho2 * rho2;
  const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
  const cosh = (x: number) => (Math.exp(x) + Math.exp(-x)) / 2;
  const sinh = (x: number) => (Math.exp(x) - Math.exp(-x)) / 2;
  const tanh = (x: number) => sinh(x) / cosh(x);
  if (d2 < 1e-12) {
    const S = Math.log(w1 / w0) / rho;
    return { duration: Math.abs(S) * 1000 * rho / Math.SQRT2, at: (t: number): [number, number, number] => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)] };
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return {
    duration: S * 1000 * rho / Math.SQRT2,
    at: (t: number): [number, number, number] => {
      const s = t * S;
      const u = (w0 / (rho2 * d1)) * (cosh(r0) * tanh(rho * s + r0) - sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * cosh(r0)) / cosh(rho * s + r0)];
    },
  };
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const PING_OUT_MS = 320;
/**
 * Markers that leave the list (a municipality climbed back above the minimum) stay mounted for a short fade-out instead
 * of vanishing, so playing the years reads as a continuous change rather than a flicker.
 */
function useLeaving(list: Ping[]) {
  const [prev, setPrev] = useState(list);
  const [leaving, setLeaving] = useState<Ping[]>([]);
  if (prev !== list) {
    const now = new Set(list.map((g) => g.id));
    const seen = new Set<number>();
    const out: Ping[] = [];
    for (const g of [...prev, ...leaving]) {
      if (now.has(g.id) || seen.has(g.id)) continue;
      seen.add(g.id);
      out.push(g);
    }
    setPrev(list);
    setLeaving(out);
  }
  useEffect(() => {
    if (!leaving.length) return;
    const t = setTimeout(() => setLeaving([]), PING_OUT_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  return leaving;
}

export default function Stage(p: StageProps) {
  const { geo, layer, level, scope, insets, hotBin } = p;
  const root = useRef<HTMLDivElement>(null);
  const camG = useRef<SVGGElement>(null);
  const munG = useRef<SVGGElement>(null);
  const ufG = useRef<SVGGElement>(null);
  const hovPath = useRef<SVGPathElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const cam = useRef<Cam>({ k: 1, x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });
  const insetsRef = useRef(insets);
  const raf = useRef(0);
  const fitted = useRef<string>("");
  const items = useRef<HTMLElement[]>([]);
  const munEls = useRef<SVGPathElement[]>([]);
  const ufEls = useRef<SVGPathElement[]>([]);
  const [hover, setHover] = useState<{ id: number; uf: number } | null>(null);
  const [flying, setFlying] = useState(false);
  const [moved, setMoved] = useState(false);
  const propsRef = useRef(p);
  const leaving = useLeaving(p.pings);

  const ufShape = useMemo(() => new Map(geo?.uf.map((s) => [s.id, s]) ?? []), [geo]);
  const munShape = useMemo(() => new Map(geo?.mun.map((s) => [s.id, s]) ?? []), [geo]);

  // latest props/insets for the imperative camera code (updated before any other layout effect runs)
  useLayoutEffect(() => {
    propsRef.current = p;
    insetsRef.current = insets;
  });

  // ---------- camera maths
  const free = useCallback(() => {
    const { w, h } = size.current;
    const i = insetsRef.current;
    return { x0: i.left, y0: i.top, x1: Math.max(i.left + 80, w - i.right), y1: Math.max(i.top + 80, h - i.bottom) };
  }, []);

  const camFor = useCallback(
    (bbox: Bbox, pad: number, maxK = K_MAX): Cam => {
      const f = free();
      const bw = Math.max(bbox[2] - bbox[0], 1e-3), bh = Math.max(bbox[3] - bbox[1], 1e-3);
      const k = Math.min((f.x1 - f.x0) / bw, (f.y1 - f.y0) / bh, maxK) * (1 - pad);
      const cx = (bbox[0] + bbox[2]) / 2, cy = (bbox[1] + bbox[3]) / 2;
      return { k, x: (f.x0 + f.x1) / 2 - cx * k, y: (f.y0 + f.y1) / 2 - cy * k };
    },
    [free],
  );

  const brFit = useCallback(() => (geo ? camFor(geo.bbox, 0.04) : cam.current), [geo, camFor]);

  const targetFor = useCallback(
    (s: Scope): Cam => {
      if (!geo) return cam.current;
      if (s.uf) {
        const us = ufShape.get(ufCode(s.uf));
        if (us) {
          if (s.city) {
            const ms = munShape.get(s.city);
            if (ms) {
              // tiny cities: never zoom closer than a fraction of the state, so the surroundings stay visible
              const span = Math.max(us.bbox[2] - us.bbox[0], us.bbox[3] - us.bbox[1]);
              const cx = (ms.bbox[0] + ms.bbox[2]) / 2, cy = (ms.bbox[1] + ms.bbox[3]) / 2;
              // keep the city small in its context (neighbours dimmed around it), like the reference's municipality view
              const half = Math.max(((ms.bbox[2] - ms.bbox[0]) / 2) * 2.5, ((ms.bbox[3] - ms.bbox[1]) / 2) * 2.5, span * 0.16);
              return camFor([cx - half, cy - half, cx + half, cy + half], 0.12);
            }
          }
          return camFor(us.bbox, 0.1);
        }
      }
      return brFit();
    },
    [geo, ufShape, munShape, camFor, brFit],
  );

  // ---------- placing: camera transform + screen-space overlays
  const place = useCallback(() => {
    const { k, x, y } = cam.current;
    const g = camG.current;
    if (g) g.style.transform = `translate(${x}px,${y}px) scale(${k})`;
    const ov = overlay.current;
    if (!ov) return;
    const sc = propsRef.current.scope;
    const atBr = !sc.uf;
    const fitK = geo ? camFor(geo.bbox, 0.04).k : 1;
    const nearBr = atBr && k < fitK * 1.6;
    ov.dataset.near = nearBr && size.current.w >= 900 ? "1" : "0";
    const taken: number[][] = [];
    const callouts: { code: string; sy: number; el: HTMLElement; sx: number; line: SVGLineElement | null }[] = [];
    for (const el of items.current) {
      const cx = Number(el.dataset.cx), cy = Number(el.dataset.cy);
      const sx = cx * k + x, sy = cy * k + y;
      const kind = el.dataset.kind;
      if (kind === "uflabel") {
        const w = Number(el.dataset.w) * k;
        const on = nearBr && w > 34;
        el.style.opacity = on ? "1" : "0";
        const b = el.firstElementChild as HTMLElement | null;
        if (b && b.tabIndex !== (on ? 0 : -1)) b.tabIndex = on ? 0 : -1;
      } else if (kind === "sel") {
        taken.push([sx - 10, sy - 12, sx + 24 + Number(el.dataset.len ?? 10) * 7.5, sy + 12]);
      } else if (kind === "city") {
        const w = Number(el.dataset.len) * 6.4 + 14;
        const box = [sx - 6, sy - 8, sx + w, sy + 8];
        const hit = taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
        const vis = !hit && sx > 0 && sy > 0 && sx < size.current.w && sy < size.current.h;
        if (vis) taken.push(box);
        el.style.opacity = vis ? "1" : "0";
      } else if (kind === "callout") {
        callouts.push({ code: el.dataset.code!, sy, sx, el, line: ov.querySelector<SVGLineElement>(`line[data-line="${el.dataset.code}"]`) });
        continue;
      }
      el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    }
    // east-coast callouts: chips stacked on the right with leader lines
    if (callouts.length && geo) {
      const rightEdge = geo.bbox[2] * k + x;
      const chipX = Math.min(rightEdge + 34, size.current.w - insetsRef.current.right - 96);
      callouts.sort((a, b) => a.sy - b.sy);
      const GAP = 26;
      let prev = -Infinity;
      const ys = callouts.map((c) => (prev = Math.max(c.sy - 4, prev + GAP)));
      for (let i = 0; i < callouts.length; i++) {
        const c = callouts[i];
        c.el.style.transform = `translate(${chipX.toFixed(1)}px,${ys[i].toFixed(1)}px)`;
        const on = nearBr && size.current.w >= 900;
        c.el.style.opacity = on ? "1" : "0";
        c.el.style.pointerEvents = on ? "auto" : "none";
        const b = c.el.firstElementChild as HTMLElement | null;
        if (b && b.tabIndex !== (on ? 0 : -1)) b.tabIndex = on ? 0 : -1;
        if (c.line) {
          c.line.setAttribute("x1", c.sx.toFixed(1));
          c.line.setAttribute("y1", c.sy.toFixed(1));
          c.line.setAttribute("x2", (chipX - 2).toFixed(1));
          c.line.setAttribute("y2", (ys[i] + 11).toFixed(1));
        }
      }
    }
  }, [geo, camFor]);

  const collect = useCallback(() => {
    items.current = overlay.current ? Array.from(overlay.current.querySelectorAll<HTMLElement>("[data-cx]")) : [];
  }, []);

  useLayoutEffect(() => {
    collect();
    place();
  });

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setFlying(false);
  }, []);

  const flyTo = useCallback(
    (to: Cam, animate = true) => {
      cancelAnimationFrame(raf.current);
      const f = free();
      const fw = f.x1 - f.x0, fcx = (f.x0 + f.x1) / 2, fcy = (f.y0 + f.y1) / 2;
      const from = cam.current;
      const toRect = (c: Cam): [number, number, number] => [(fcx - c.x) / c.k, (fcy - c.y) / c.k, fw / c.k];
      const a = toRect(from), b = toRect(to);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const path = smoothZoom(a, b);
      const dur = Math.min(1000, Math.max(600, path.duration));
      if (!animate || reduce || !isFinite(dur)) {
        cam.current = to;
        place();
        return;
      }
      setFlying(true);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const [ux, uy, w] = path.at(ease(t));
        const k = fw / w;
        cam.current = { k, x: fcx - ux * k, y: fcy - uy * k };
        place();
        if (t < 1) raf.current = requestAnimationFrame(step);
        else {
          cam.current = to;
          place();
          setFlying(false);
        }
      };
      raf.current = requestAnimationFrame(step);
    },
    [free, place],
  );

  // ---------- size
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      size.current = { w: r.width, h: r.height };
      // refit without animation when the viewport changes
      if (geo) {
        const prevFit = fitted.current;
        fitted.current = "";
        cam.current = targetFor(propsRef.current.scope);
        fitted.current = prevFit;
        place();
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [geo, targetFor, place]);

  // ---------- fit to scope (animated), or to the new insets
  const scopeKey = `${scope.uf ?? ""}/${scope.city ?? ""}`;
  const insetKey = `${insets.left}/${insets.right}/${insets.top}/${insets.bottom}`;
  useEffect(() => {
    if (!geo || !size.current.w) return;
    insetsRef.current = insets;
    const key = `${scopeKey}|${insetKey}`;
    if (fitted.current === key) return;
    const first = fitted.current === "";
    fitted.current = key;
    flyTo(targetFor(scope), !first);
    setMoved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, scopeKey, insetKey]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // ---------- fills (imperative: 5,570 paths). Only the paths whose class changed are touched, so a year step restyles
  // (and crossfades) the few hundred municipalities that moved instead of invalidating all of them.
  // A year step changes ~3,000 of them: starting all those transitions at once costs one ~35 ms style pass (a hitch at
  // every beat), so big batches are written interleaved over a few frames — the offset (≤ 4 frames) is invisible under
  // the 0.6 s crossfade.
  const painted = useRef(new WeakMap<SVGPathElement, string>());
  const paintRaf = useRef(0);
  useLayoutEffect(() => {
    if (!geo) return;
    cancelAnimationFrame(paintRaf.current);
    const mg = munG.current, ug = ufG.current;
    if (mg && munEls.current.length !== geo.mun.length) munEls.current = Array.from(mg.children) as SVGPathElement[];
    if (ug && ufEls.current.length !== geo.uf.length) ufEls.current = Array.from(ug.children) as SVGPathElement[];
    const memo = painted.current;
    const jobs: [SVGPathElement, string, string][] = [];
    const paint = (el: SVGPathElement, fill: string, b: string) => {
      if (memo.get(el) !== b + fill) jobs.push([el, fill, b]);
    };
    const write = ([el, fill, b]: [SVGPathElement, string, string]) => {
      memo.set(el, b + fill);
      el.style.fill = fill;
      el.dataset.b = b;
    };
    if (layer.level === "mun") {
      for (let i = 0; i < geo.mun.length; i++) {
        const el = munEls.current[i];
        if (!el) continue;
        const id = geo.mun[i].id;
        const b = layer.binOf(id);
        const nd = !b && layer.notDeclared(id);
        paint(el, b ? b.color : nd ? "var(--m-undeclared)" : "var(--bin-nd)", b ? b.key : nd ? "nd" : "x");
      }
      for (const el of ufEls.current) paint(el, "transparent", "");
    } else {
      for (let i = 0; i < geo.uf.length; i++) {
        const el = ufEls.current[i];
        if (!el) continue;
        const b = layer.binOf(geo.uf[i].id);
        paint(el, b ? b.color : "var(--bin-nd)", b ? b.key : "x");
      }
    }
    const SLICE = 800;
    const parts = jobs.length > SLICE && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? Math.min(4, Math.ceil(jobs.length / SLICE)) : 1;
    let k = 0;
    const run = () => {
      for (let i = k; i < jobs.length; i += parts) write(jobs[i]);
      if (++k < parts) paintRaf.current = requestAnimationFrame(run);
    };
    run();
  }, [geo, layer]);
  useEffect(() => () => cancelAnimationFrame(paintRaf.current), []);

  // ---------- pointer: hover, click, drag, pinch, wheel
  const gesture = useRef<{ pts: Map<number, { x: number; y: number }>; start: { x: number; y: number; target: EventTarget | null } | null; dragging: boolean; pinch0: { d: number; k: number } | null }>({
    pts: new Map(), start: null, dragging: false, pinch0: null,
  });

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const c = cam.current;
      const fit = brFit();
      const k = Math.min(K_MAX, Math.max(fit.k * 0.8, c.k * factor));
      const f = k / c.k;
      cam.current = { k, x: px - (px - c.x) * f, y: py - (py - c.y) * f };
      place();
      setMoved(true);
    },
    [brFit, place],
  );

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const targetPath = (t: EventTarget | null): SVGPathElement | null => {
    const el = t as Element | null;
    return el && el.tagName === "path" && (el as SVGPathElement).dataset.id ? (el as SVGPathElement) : null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    const g = gesture.current;
    const pt = toLocal(e);
    g.pts.set(e.pointerId, pt);
    if (g.pts.size === 1) g.start = { ...pt, target: e.target };
    if (g.pts.size === 2) {
      const [a, b] = [...g.pts.values()];
      g.pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.current.k };
      g.dragging = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const pt = toLocal(e);
    if (g.pts.has(e.pointerId)) {
      const prev = g.pts.get(e.pointerId)!;
      g.pts.set(e.pointerId, pt);
      if (g.pts.size === 2 && g.pinch0) {
        stop();
        const [a, b] = [...g.pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const target = (g.pinch0.k * d) / g.pinch0.d;
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / cam.current.k);
        return;
      }
      if (g.start && !g.dragging && Math.hypot(pt.x - g.start.x, pt.y - g.start.y) > 5) {
        g.dragging = true;
        stop();
        root.current?.setPointerCapture(e.pointerId);
        setHover(null);
      }
      if (g.dragging && g.pts.size === 1) {
        cam.current = { ...cam.current, x: cam.current.x + pt.x - prev.x, y: cam.current.y + pt.y - prev.y };
        place();
        setMoved(true);
        return;
      }
    }
    if (g.dragging || e.pointerType === "touch") return;
    // hover
    const path = targetPath(e.target);
    const tip = tipRef.current;
    if (tip) {
      const w = tip.offsetWidth || 240, h = tip.offsetHeight || 120;
      const { w: W, h: H } = size.current;
      const x = pt.x + 18 + w > W - 8 ? pt.x - 18 - w : pt.x + 18;
      const y = Math.min(Math.max(8, pt.y - 12), H - h - 8);
      tip.style.transform = `translate(${x}px,${y}px)`;
    }
    if (!path) return void setHover((h) => (h ? null : h));
    const id = Number(path.dataset.id), uf = Number(path.dataset.uf);
    setHover((h) => (h && h.id === id ? h : { id, uf }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const wasDrag = g.dragging;
    const start = g.start;
    g.pts.delete(e.pointerId);
    if (g.pts.size < 2) g.pinch0 = null;
    if (g.pts.size === 0) {
      g.start = null;
      g.dragging = false;
      if (root.current?.hasPointerCapture(e.pointerId)) root.current.releasePointerCapture(e.pointerId);
      if (!wasDrag && start) {
        if ((start.target as HTMLElement | null)?.closest?.("[data-ui]")) return;
        const path = targetPath(start.target);
        const sc = propsRef.current.scope;
        if (!path) {
          if (sc.city) propsRef.current.onPickCity(null);
          else if (sc.uf) propsRef.current.onPickUf(null);
          return;
        }
        const id = Number(path.dataset.id), uf = Number(path.dataset.uf);
        const isUfLayer = path.parentElement === ufG.current;
        if (!sc.uf || ufSigla(uf) !== sc.uf) propsRef.current.onPickUf(ufSigla(uf));
        else if (!isUfLayer) propsRef.current.onPickCity(id === sc.city ? null : id);
      }
    }
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-ui]")) return;
      e.preventDefault();
      stop();
      const pt = toLocal(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(pt.x, pt.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, stop]);

  const zoomCenter = (f: number) => {
    const fr = free();
    stop();
    // eased zoom around the visible centre
    const c = cam.current;
    const px = (fr.x0 + fr.x1) / 2, py = (fr.y0 + fr.y1) / 2;
    const k = Math.min(K_MAX, Math.max(brFit().k * 0.8, c.k * f));
    const r = k / c.k;
    flyTo({ k, x: px - (px - c.x) * r, y: py - (py - c.y) * r });
    setMoved(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    const c = cam.current;
    if (e.key === "+" || e.key === "=") zoomCenter(1.6);
    else if (e.key === "-" || e.key === "_") zoomCenter(1 / 1.6);
    else if (e.key.startsWith("Arrow")) {
      stop();
      cam.current = { ...c, x: c.x + (e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0), y: c.y + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0) };
      place();
      setMoved(true);
    } else if (e.key === "0") flyTo(targetFor(scope));
    else return;
    e.preventDefault();
  };

  // ---------- derived overlay data
  const ufLabels = useMemo(
    () =>
      geo
        ? geo.uf.map((s) => ({ code: s.id, sigla: ufSigla(s.id), cx: s.cx, cy: s.cy, w: s.bbox[2] - s.bbox[0] }))
        : [],
    [geo],
  );
  const hovShape: Shape | undefined = hover ? (!scope.uf || ufSigla(hover.uf) !== scope.uf || layer.level === "uf" ? ufShape.get(hover.uf) : munShape.get(hover.id)) : undefined;
  useLayoutEffect(() => {
    const el = hovPath.current;
    if (el) el.setAttribute("d", hovShape?.d ?? "");
  }, [hovShape]);

  const focusCode = scope.uf ? ufCode(scope.uf) : null;
  const selShape = scope.city ? munShape.get(scope.city) : undefined;
  const dim = [
    focusCode != null ? `.mapa-stage .m-mun path:not([data-uf="${focusCode}"]){fill-opacity:.14}.mapa-stage .m-uf path:not([data-uf="${focusCode}"]){fill-opacity:.14}` : "",
    focusCode != null && scope.city ? `.mapa-stage .m-mun path[data-uf="${focusCode}"]:not([data-id="${scope.city}"]){fill-opacity:.4}` : "",
    hotBin ? `.mapa-stage .m-mun path:not([data-b="${hotBin}"]){fill-opacity:.12}.mapa-stage .m-uf path:not([data-b="${hotBin}"]){fill-opacity:.12}` : "",
  ].join("");

  const selName = scope.city ? p.cityLabels.find((c) => c.id === scope.city) : undefined;

  return (
    <div
      ref={root}
      tabIndex={0}
      role="application"
      aria-label="Mapa do Brasil. Clique em um estado para aproximar, depois em um município. Setas movem, + e - aproximam, 0 volta ao enquadramento."
      data-level={level}
      data-flying={flying ? "1" : "0"}
      data-sw={scope.city ? "city" : scope.uf ? "uf" : "br"}
      className={cn("mapa-stage relative size-full touch-none overflow-hidden select-none outline-none", flying ? "cursor-grabbing" : "cursor-grab", p.className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => !gesture.current.dragging && setHover(null)}
      onKeyDown={onKeyDown}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-ui]")) return;
        const pt = toLocal(e);
        stop();
        const c = cam.current;
        const k = Math.min(K_MAX, c.k * 2);
        const r = k / c.k;
        flyTo({ k, x: pt.x - (pt.x - c.x) * r, y: pt.y - (pt.y - c.y) * r });
        setMoved(true);
      }}
    >
      <style>{dim}</style>
      <svg className="absolute inset-0 size-full" aria-hidden>
        <g ref={camG} className="origin-top-left" style={{ willChange: flying ? "transform" : undefined, transformOrigin: "0 0" }}>
          {geo && (
            <>
              <g ref={munG} className="m-mun" dangerouslySetInnerHTML={{ __html: geo.munHtml }} />
              <g ref={ufG} className="m-uf" dangerouslySetInnerHTML={{ __html: geo.ufHtml }} />
              <path d={geo.ufBorders} className="m-borders" />
              <path d={geo.outline} className="m-outline" />
              <path ref={hovPath} className="m-hover" />
              {selShape && <path d={selShape.d} className="m-sel" />}
              {focusCode != null && !scope.city && ufShape.get(focusCode) && <path d={ufShape.get(focusCode)!.d} className="m-sel m-sel-uf" />}
            </>
          )}
        </g>
      </svg>

      {/* screen-space overlays */}
      <div ref={overlay} className="pointer-events-none absolute inset-0" data-near="1">
        <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {CALLOUTS.map((c) => (
            <line key={c} data-line={c} className="m-leader" />
          ))}
        </svg>
        {ufLabels.map((u) => {
          const tag = p.ufTag(u.code);
          if (CALLOUTS.includes(u.sigla)) {
            return (
              <div key={u.code} data-kind="callout" data-code={u.sigla} data-cx={u.cx} data-cy={u.cy} className="m-callout absolute top-0 left-0 opacity-0 transition-opacity duration-300">
                <button
                  type="button"
                  data-ui
                  tabIndex={-1}
                  className={cn("m-chip", tag.strong && "is-strong")}
                  style={tag.color ? ({ "--chip": tag.color } as React.CSSProperties) : undefined}
                  aria-label={`${ufName(u.sigla)}${tag.text ? `: ${tag.text}` : ""}. Aproximar`}
                  onClick={() => p.onPickUf(u.sigla)}
                  onPointerEnter={() => overlay.current?.querySelector(`[data-line="${u.sigla}"]`)?.classList.add("is-hot")}
                  onPointerLeave={() => overlay.current?.querySelector(`[data-line="${u.sigla}"]`)?.classList.remove("is-hot")}
                >
                  <b>{u.sigla}</b>
                  {tag.text && <span>{tag.text}</span>}
                </button>
              </div>
            );
          }
          return (
            <div key={u.code} data-kind="uflabel" data-cx={u.cx} data-cy={u.cy} data-w={u.w} className="absolute top-0 left-0 opacity-0 transition-opacity duration-300">
              {/* a button for the keyboard (Tab + Enter flies there); the pointer passes through to the map below */}
              <button type="button" data-ui tabIndex={-1} className={cn("m-uflabel", tag.strong && "is-strong")} aria-label={`${ufName(u.sigla)}${tag.text ? `: ${tag.text}` : ""}. Aproximar`} onClick={() => p.onPickUf(u.sigla)}>
                <b>{u.sigla}</b>
                {tag.text && <span>{tag.text}</span>}
              </button>
            </div>
          );
        })}
        {p.pings.map((g) => (
          <div key={g.id} data-kind="ping" data-cx={g.cx} data-cy={g.cy} className="absolute top-0 left-0">
            <span className={cn("m-ping", g.still && "is-still")}>
              {!g.still && <i key={g.epoch ?? 0} style={{ "--i": g.i ?? 0 } as React.CSSProperties} />}
            </span>
          </div>
        ))}
        {leaving.map((g) => (
          <div key={g.id} data-kind="ping" data-cx={g.cx} data-cy={g.cy} className="absolute top-0 left-0">
            <span className={cn("m-ping is-out", g.still && "is-still")} />
          </div>
        ))}
        {scope.city && selShape && (
          <div data-kind="sel" data-len={selName?.name.length ?? 10} data-cx={selShape.cx} data-cy={selShape.cy} className="absolute top-0 left-0">
            <span className="m-pin" />
            {selName && <span className="m-townpill">{selName.name}</span>}
          </div>
        )}
        {scope.uf && !flying &&
          p.cityLabels
            .filter((c) => c.id !== scope.city)
            .map((c) => (
              <div key={c.id} data-kind="city" data-len={c.name.length} data-cx={c.cx} data-cy={c.cy} className="absolute top-0 left-0 transition-opacity duration-200">
                <span className="m-city">
                  <i />
                  {c.name}
                </span>
              </div>
            ))}
      </div>

      {/* hover card */}
      <div ref={tipRef} className="pointer-events-none absolute top-0 left-0 z-20" style={{ transform: "translate(-999px,-999px)" }}>
        {hover && !flying && <div key={`${hover.uf}-${layer.level === "uf" || !scope.uf ? 0 : hover.id}`} className="m-card m-tip w-[268px] p-3 text-[0.8125rem]">{p.tooltip({ id: hover.id, uf: hover.uf, level: layer.level })}</div>}
      </div>

      {p.loading && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center" style={{ marginLeft: insets.left / 2 }} role="status">
          <div className="m-spinner mx-auto" />
          <p className="mt-3 text-[0.8125rem] text-(--m-ink)/60">Carregando 5.570 municípios…</p>
        </div>
      )}

      {/* zoom controls */}
      <div data-ui className="m-panel absolute bottom-24 z-10 flex flex-col gap-0.5 rounded-full p-[3px] max-lg:hidden" style={{ left: insets.left + 20 }}>
        <button type="button" className="m-ctl m-ctl-flat" aria-label="Aproximar" title="Aproximar (+)" onClick={() => zoomCenter(1.7)}>
          <Plus className="size-4" />
        </button>
        <button type="button" className="m-ctl m-ctl-flat" aria-label="Afastar" title="Afastar (−)" onClick={() => zoomCenter(1 / 1.7)}>
          <Minus className="size-4" />
        </button>
        {(moved || scope.uf) && (
          <button type="button" className="m-ctl m-ctl-flat" aria-label="Voltar ao enquadramento" title="Voltar ao enquadramento (0)" onClick={() => { flyTo(targetFor(scope)); setMoved(false); }}>
            <LocateFixed className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export { ufOfMun };
