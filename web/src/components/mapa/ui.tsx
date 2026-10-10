"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/** Animated number: tweens to `value` (count-up when the year or place changes). */
export function useTween(value: number, ms = 600) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  const cur = useRef(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.current = value;
      const id = requestAnimationFrame(() => setV(value));
      return () => cancelAnimationFrame(id);
    }
    const a = cur.current, b = value;
    from.current = a;
    if (a === b) return;
    const t0 = performance.now();
    let id = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      cur.current = a + (b - a) * e;
      setV(cur.current);
      if (t < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value, ms]);
  return v;
}

export function Num({ value, fmt, className }: { value: number; fmt: (v: number) => string; className?: string }) {
  const v = useTween(value);
  return <span className={cn("tnum", className)}>{fmt(v)}</span>;
}

const mq = (q: string) => ({
  sub: (cb: () => void) => {
    const m = window.matchMedia(q);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  },
  get: () => window.matchMedia(q).matches,
});
const lg = mq("(min-width: 1024px)");
/** true from 1024px up; false during SSR (mobile layout first, desktop corrected on hydration) */
export const useIsDesktop = () => useSyncExternalStore(lg.sub, lg.get, () => true);

export type Series = { values: (number | null)[]; color: string; dashed?: boolean; label: string; fmt?: (v: number) => string; area?: boolean };

/**
 * Small interactive line chart over the published years: hover reads a year, click/drag picks it (the map follows).
 * `refLine` draws a dashed reference line (e.g. the 25% minimum); an array draws a per-year step (Fundeb 60% → 70%).
 * `band` shades a span of years (the 2020–21 pandemic exemption).
 */
export function LineChart({
  years, series, yi, onPick, height = 104, domain, refLine, refLabel, marks, band,
}: {
  years: number[];
  series: Series[];
  yi: number;
  onPick?: (i: number) => void;
  height?: number;
  domain?: [number, number];
  refLine?: number | number[];
  refLabel?: string;
  band?: { from: number; to: number; label: string };
  /** indices drawn as red dots on the first series (years below the minimum) */
  marks?: number[];
}) {
  const W = 320, padL = 4, padR = 4, padT = 8, padB = 16;
  const H = height;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const refs = refLine == null ? [] : Array.isArray(refLine) ? refLine : [refLine];
  const lo0 = domain?.[0] ?? Math.min(...all, ...refs);
  const hi0 = domain?.[1] ?? Math.max(...all, ...refs);
  const span = hi0 - lo0 || 1;
  const lo = domain ? lo0 : lo0 - span * 0.08, hi = domain ? hi0 : hi0 + span * 0.12;
  const x = (i: number) => padL + (i / Math.max(1, years.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const [hov, setHov] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width * W - padL) / (W - padL - padR) * (years.length - 1));
    return Math.max(0, Math.min(years.length - 1, i));
  };
  const path = (vals: (number | null)[]) => {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v == null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const shown = hov ?? yi;
  const glide = hov == null ? "transform var(--m-step) var(--m-ease)" : "none";
  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none overflow-visible"
        role="img"
        aria-label={`Série de ${years[0]} a ${years[years.length - 1]}: ${series.map((s) => s.label).join(", ")}`}
        onPointerMove={(e) => {
          const i = pick(e);
          setHov(i);
          if (e.buttons === 1) onPick?.(i);
        }}
        onPointerLeave={() => setHov(null)}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          onPick?.(pick(e));
        }}
        style={{ cursor: onPick ? "pointer" : undefined }}
      >
        <defs>
          {series.map((s, i) =>
            s.area ? (
              <linearGradient key={i} id={`lc-${i}-${s.color.replace(/\W/g, "")}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ) : null,
          )}
        </defs>
        {band && years.indexOf(band.from) >= 0 && (() => {
          const step = (W - padL - padR) / Math.max(1, years.length - 1);
          const x0 = x(years.indexOf(band.from)) - step / 2, x1 = x(years.indexOf(band.to)) + step / 2;
          return (
            <g>
              <title>{band.label}</title>
              <rect x={x0} y={padT} width={x1 - x0} height={H - padT - padB} fill="color-mix(in srgb, var(--m-amber-fill) 14%, transparent)" />
              <text x={(x0 + x1) / 2} y={padT + 8} textAnchor="middle" fontSize="8" fill="var(--m-amber)">EC 119</text>
            </g>
          );
        })()}
        {refs.length > 0 && (() => {
          const step = refs.length > 1;
          const d = step
            ? refs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}${i < refs.length - 1 && refs[i + 1] !== v ? `L${((x(i) + x(i + 1)) / 2).toFixed(1)} ${y(v).toFixed(1)}L${((x(i) + x(i + 1)) / 2).toFixed(1)} ${y(refs[i + 1]).toFixed(1)}` : ""}`).join("")
            : `M${padL} ${y(refs[0])}L${W - padR} ${y(refs[0])}`;
          const last = refs[refs.length - 1];
          return (
            <g>
              <path d={d} fill="none" stroke="color-mix(in srgb, var(--m-ink) 35%, transparent)" strokeDasharray="3 3" />
              {refLabel && (
                <text x={W - padR} y={y(last) + 11} textAnchor="end" fontSize="9" fill="color-mix(in srgb, var(--m-ink) 60%, transparent)">
                  {refLabel}
                </text>
              )}
            </g>
          );
        })()}
        {series.map((s, i) => {
          const d = path(s.values);
          return (
            <g key={i}>
              {s.area && d && (
                <path d={`${d}L${x(s.values.length - 1)} ${H - padB}L${x(0)} ${H - padB}Z`} fill={`url(#lc-${i}-${s.color.replace(/\W/g, "")})`} />
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.25 : 2} strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {marks?.map((i) => {
          const v = series[0].values[i];
          return v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill="var(--m-red)" stroke="var(--m-panel-solid)" strokeWidth={1} />;
        })}
        {/* playhead: glides with the year (same clock as the map); follows the pointer instantly while hovering */}
        <line className="m-lc-head" x1={0} x2={0} y1={padT} y2={H - padB} stroke="color-mix(in srgb, var(--m-ink) 50%, transparent)" strokeWidth={1} style={{ transform: `translateX(${x(shown)}px)`, transition: glide }} />
        {series.map((s, i) => {
          const v = s.values[shown];
          return v == null ? null : <circle key={i} className="m-lc-head" cx={0} cy={0} r={3.6} fill={s.color} stroke="var(--m-panel-solid)" strokeWidth={1.5} style={{ transform: `translate(${x(shown)}px,${y(v)}px)`, transition: glide }} />;
        })}
        {[0, Math.floor((years.length - 1) / 2), years.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 3} textAnchor={i === 0 ? "start" : i === years.length - 1 ? "end" : "middle"} fontSize="9.5" fill="color-mix(in srgb, var(--m-ink) 50%, transparent)">
            {years[i]}
          </text>
        ))}
      </svg>
      <div className="pointer-events-none mt-1 flex items-center justify-between gap-3 text-[0.6875rem] text-(--m-ink)/60 tnum">
        <span className="font-medium text-(--m-ink)/85">{years[shown]}</span>
        <span className="flex items-center gap-3">
          {series.map((s, i) => {
            const v = s.values[shown];
            return (
              <span key={i} className="inline-flex items-center gap-1.5">
                <i className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                {s.label}: <b className="font-medium text-(--m-ink)/90">{v == null ? "—" : (s.fmt ?? String)(v)}</b>
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[0.6875rem] text-(--m-ink)/50">{label}</div>
      <div className="mt-0.5 text-[1.0625rem] leading-tight font-medium tnum text-(--m-ink)">{value}</div>
      {sub && <div className="mt-0.5 text-[0.6875rem] text-(--m-ink)/45 tnum">{sub}</div>}
    </div>
  );
}

export const Row = ({ k, v, tone }: { k: React.ReactNode; v: React.ReactNode; tone?: "red" | "blue" }) => (
  <div className="flex items-baseline justify-between gap-3 py-1 text-[0.75rem]">
    <span className="text-(--m-ink)/55">{k}</span>
    <span className={cn("text-right font-medium tnum text-(--m-ink)/90", tone === "red" && "text-(--m-red)", tone === "blue" && "text-(--m-blue)")}>{v}</span>
  </div>
);
