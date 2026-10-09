"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Bottom scrubber over the published years. Drag, click, arrow keys, or play to watch the map change year by year. */
export default function Timeline({
  years, yi, onPick, playing, onToggle, coverage, latest, className, style, band, beat,
}: {
  years: number[];
  yi: number;
  onPick: (i: number) => void;
  playing: boolean;
  /** ms per year while playing (drives the progress ring around the play button) */
  beat: number;
  onToggle: () => void;
  coverage: string;
  latest: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** shaded span on the track (2020–21, EC 119) */
  band?: { from: number; to: number; label: string };
}) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const n = years.length;
  const pct = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);
  const idx = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
  };
  return (
    <div data-ui className={cn("m-panel flex items-center gap-3 px-3.5 py-2 sm:gap-4 sm:px-4", className)} style={style}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pausar a animação dos anos" : "Reproduzir a evolução ano a ano"}
        className="relative grid size-11 shrink-0 place-items-center rounded-full bg-(--m-ink) text-(--m-bg) transition-transform hover:scale-105 active:scale-95 lg:size-9"
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
        {playing && yi < n - 1 && (
          <svg key={yi} className="m-beat" viewBox="0 0 44 44" aria-hidden style={{ "--beat": `${beat}ms` } as React.CSSProperties}>
            <circle className="is-track" cx="22" cy="22" r="21" />
            <circle className="is-run" cx="22" cy="22" r="21" pathLength={100} />
          </svg>
        )}
      </button>
      <div className="font-display h-[1.375rem] w-[3.6rem] shrink-0 overflow-hidden text-[1.375rem] leading-none tnum text-(--m-ink)">
        <span key={years[yi]} className="m-year">{years[yi]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={track}
          className="m-track"
          data-drag={drag ? "1" : "0"}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onPick(idx(e));
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            if (!drag) setDrag(true);
            onPick(idx(e));
          }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <div className="m-track-line" />
          {band && years.includes(band.from) && (
            <div
              className="absolute top-[9px] h-2.5 rounded-sm bg-(--m-amber-fill)/25"
              style={{ left: `${pct(years.indexOf(band.from)) - 50 / Math.max(1, n - 1)}%`, width: `${pct(years.indexOf(band.to)) - pct(years.indexOf(band.from)) + 100 / Math.max(1, n - 1)}%` }}
              title={band.label}
            />
          )}
          <div className="m-track-fill" style={{ width: `${pct(yi)}%` }} />
          {years.map((y, i) => (
            <i key={y} className="absolute top-[11px] h-1.5 w-px bg-(--m-ink)/25" style={{ left: `${pct(i)}%`, opacity: i <= yi ? 0 : 1 }} />
          ))}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Ano"
            aria-valuemin={years[0]}
            aria-valuemax={years[n - 1]}
            aria-valuenow={years[yi]}
            aria-valuetext={String(years[yi])}
            className="m-thumb outline-none focus-visible:ring-2 focus-visible:ring-(--m-blue)"
            style={{ left: `${pct(yi)}%` }}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
              if (d) onPick(Math.max(0, Math.min(n - 1, yi + d)));
              else if (e.key === "Home") onPick(0);
              else if (e.key === "End") onPick(n - 1);
              else return;
              e.preventDefault();
            }}
          />
        </div>
        <div className="relative -mt-0.5 h-3 text-[0.625rem] text-(--m-ink)/55 tnum" aria-hidden>
          {years.map((y, i) => {
            const show = i === n - 1 || (i % 3 === 0 && n - 1 - i >= 3);
            return show ? (
              <span key={y} className={cn("absolute -translate-x-1/2", i === yi && "text-(--m-ink)")} style={{ left: `${pct(i)}%` }}>
                {y}
              </span>
            ) : null;
          })}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-2 text-[0.75rem] text-(--m-ink)/60 md:flex">
        <button
          type="button"
          onClick={() => onPick(n - 1)}
          className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:text-(--m-ink)", latest && "text-(--m-ink)")}
          title="Ir ao ano mais recente"
        >
          <span className={cn("size-1.5 rounded-full", latest ? "bg-(--m-blue)" : "bg-(--m-ink)/35")} />
          Mais recente
        </button>
        <span className="hidden text-(--m-ink)/60 xl:inline tnum">{coverage}</span>
      </div>
    </div>
  );
}
