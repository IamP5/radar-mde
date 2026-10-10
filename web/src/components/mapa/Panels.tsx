"use client";

import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Link2, Maximize2, Minimize2, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import SearchPalette from "@/components/SearchPalette";
import { Logo } from "@/components/kit/logo";
import WatchButton from "@/components/WatchButton";
import { MDE_MIN, brlShort, funMin, int, pct } from "@/lib/format";
import { binColor, colorOf, funBins } from "@/lib/bins";
import { cityPath } from "@/lib/geo";
import { IPCA_BASE, belowShare, isAtip, isImplausible, shortfallLabel, toReal, type Row, type Stats, type UfSummary } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { ALUNO_UNIT, INDS, PANDEMIC, UF_VARS, alunoReal, pandemicIdx, timesBelowUntil, ufName, type Ind, type Layer, type Level, type Scope, type UfVar } from "./model";
import { LineChart, Num, Row as FactRow } from "./ui";

/** Arrow-key navigation for tablists and radiogroups (one tab stop per group, ARIA APG). Selects as it moves. */
export function roving(e: React.KeyboardEvent<HTMLElement>, n: number, cur: number, pick: (i: number) => void) {
  const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  const to = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : d ? (Math.max(0, cur) + d + n) % n : -1;
  if (to < 0) return;
  e.preventDefault();
  pick(to);
  const items = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"],[role="radio"]');
  requestAnimationFrame(() => items[to]?.focus());
}

/* ====================================================================================== top bar */

export function TopBar({
  ind, onInd, fullscreen, onFullscreen, onShare, copied,
}: {
  ind: Ind;
  onInd: (i: Ind) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 px-4 pt-3 max-lg:flex max-lg:flex-wrap max-lg:items-start max-lg:gap-3 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-start lg:gap-4" data-ui>
      <Link href="/" className="flex h-10 shrink-0 items-center gap-2.5 rounded-lg pr-2" title="Voltar ao painel completo">
        <Logo className="size-7 text-(--m-ink)" />
        <span className="font-display text-[1.4rem] leading-none text-(--m-ink)">Radar MDE</span>
        <span className="hidden text-[0.75rem] text-(--m-ink)/40 2xl:inline">Educação · 5.570 municípios</span>
      </Link>

      <div className="hidden justify-center lg:flex">
        <div role="tablist" aria-label="Indicador do mapa" className="m-panel flex items-center gap-0.5 rounded-full p-1" onKeyDown={(e) => roving(e, INDS.length, INDS.findIndex((i) => i.key === ind), (k) => onInd(INDS[k].key))}>
          {INDS.map((i) => (
            <button key={i.key} role="tab" type="button" aria-selected={ind === i.key} tabIndex={ind === i.key ? 0 : -1} className="m-pill h-8 px-4" title={i.long} onClick={() => onInd(i.key)}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SearchPalette compact />
        <button type="button" className="m-ctl h-10! w-10!" onClick={onShare} aria-label="Copiar o link desta visão" title="Copiar o link desta visão">
          {copied ? <span className="text-[0.6875rem] font-medium text-(--m-blue)">Copiado</span> : <Link2 className="size-4" />}
        </button>
        <ThemeButton />
        <button type="button" className="m-ctl h-10! w-10! max-sm:hidden" onClick={onFullscreen} aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}>
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <Link href="/" className="m-ctl hidden h-10! w-auto! gap-1.5 px-3 text-[0.8125rem] xl:inline-flex xl:items-center" title="Painel completo">
          Painel completo
          <ArrowUpRight className="size-3.5" />
        </Link>
        <Link href="/" className="m-ctl h-10! w-10! max-xl:grid xl:hidden" aria-label="Painel completo" title="Painel completo">
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {/* indicator tabs on small screens: a row below the bar */}
      <div className="m-panel flex w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 lg:hidden" role="tablist" aria-label="Indicador do mapa" onKeyDown={(e) => roving(e, INDS.length, INDS.findIndex((i) => i.key === ind), (k) => onInd(INDS[k].key))}>
        {INDS.map((i) => (
          <button key={i.key} role="tab" type="button" aria-selected={ind === i.key} tabIndex={ind === i.key ? 0 : -1} className="m-pill h-10 flex-1 justify-center px-2 text-[0.75rem] sm:px-3 sm:text-[0.8125rem]" onClick={() => onInd(i.key)}>
            {i.label}
          </button>
        ))}
      </div>
    </header>
  );
}

const noop = () => () => {};

/** Light ↔ dark, same preference as the site header (next-themes); the map palette follows via .dark on <html>. */
function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button type="button" className="m-ctl h-10! w-10!" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={label} title={label}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/* ====================================================================================== sub bar */

export function SubBar({
  scope, cityName, onScope, level, onLevel, ufVar, onUfVar, ind, left, skipPand, onSkipPand,
}: {
  scope: Scope;
  cityName: string | null;
  onScope: (s: Scope) => void;
  level: Level;
  onLevel: (l: Level) => void;
  ufVar: UfVar;
  onUfVar: (v: UfVar) => void;
  ind: Ind;
  left: number;
  skipPand: boolean;
  onSkipPand: (v: boolean) => void;
}) {
  const crumb = "rounded-md px-1.5 py-0.5 text-[0.8125rem] transition-colors max-lg:py-2.5";
  return (
    <div data-ui className="absolute z-20 flex flex-wrap items-center gap-2 max-lg:top-[7.5rem]! max-lg:left-4!" style={{ left, top: 64 }}>
      <nav aria-label="Navegação no mapa" className="m-panel flex h-9 items-center gap-0.5 rounded-full px-2 max-lg:h-11">
        <button type="button" className={cn(crumb, !scope.uf ? "font-medium text-(--m-ink)" : "text-(--m-ink)/55 hover:text-(--m-ink)")} onClick={() => onScope({ uf: null, city: null })} aria-current={!scope.uf ? "page" : undefined}>
          Brasil
        </button>
        {scope.uf && (
          <>
            <ChevronRight className="size-3.5 text-(--m-ink)/30" />
            <button type="button" className={cn(crumb, !scope.city ? "font-medium text-(--m-ink)" : "text-(--m-ink)/55 hover:text-(--m-ink)")} onClick={() => onScope({ uf: scope.uf, city: null })} aria-current={!scope.city ? "page" : undefined}>
              {ufName(scope.uf)}
            </button>
          </>
        )}
        {scope.city && cityName && (
          <>
            <ChevronRight className="size-3.5 text-(--m-ink)/30" />
            <span className={cn(crumb, "max-w-[11rem] truncate font-medium text-(--m-ink)")} aria-current="page">
              {cityName}
            </span>
          </>
        )}
      </nav>
      {!scope.uf && (
        <div role="radiogroup" aria-label="Ver o mapa por" className="m-panel flex h-9 items-center gap-0.5 rounded-full p-1 max-lg:h-11" onKeyDown={(e) => roving(e, 2, level === "mun" ? 0 : 1, (k) => onLevel(k ? "uf" : "mun"))}>
          <span className="pr-1 pl-2 text-[0.6875rem] text-(--m-ink)/60" aria-hidden>Ver por</span>
          {(["mun", "uf"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={level === l} tabIndex={level === l ? 0 : -1} className="m-pill h-7 max-lg:h-9" onClick={() => onLevel(l)}>
              {l === "mun" ? "Municípios" : "Estados"}
            </button>
          ))}
        </div>
      )}
      {level === "uf" && !scope.uf && ind === "mde" && (
        <div key="medida" role="radiogroup" aria-label="Medida por estado" className="m-panel flex h-9 items-center gap-0.5 rounded-full p-1 m-rise max-lg:h-11" onKeyDown={(e) => roving(e, UF_VARS.length, UF_VARS.findIndex((v) => v.key === ufVar), (k) => onUfVar(UF_VARS[k].key))}>
          <span className="pr-1 pl-2 text-[0.6875rem] text-(--m-ink)/60" aria-hidden>Medida</span>
          {UF_VARS.map((v) => (
            <button key={v.key} type="button" role="radio" aria-checked={ufVar === v.key} tabIndex={ufVar === v.key ? 0 : -1} className="m-pill h-7 max-lg:h-9" title={v.long} onClick={() => onUfVar(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      {ind === "rec" && (
        <button
          type="button"
          aria-pressed={!skipPand}
          onClick={() => onSkipPand(!skipPand)}
          className="m-panel m-rise flex h-9 items-center gap-2 rounded-full pr-3 pl-2 text-[0.75rem] text-(--m-ink)/80 transition-colors hover:text-(--m-ink) max-lg:h-11"
          title="Pela EC 119/2022, quem ficou abaixo de 25% em 2020–21 e compensou até 2023 não é punido"
        >
          <span className={cn("grid size-4 place-items-center rounded-[4px] border text-[0.625rem]", !skipPand ? "border-(--m-ink) bg-(--m-ink) text-(--m-bg)" : "border-(--m-ink)/40")}>{!skipPand ? "✓" : ""}</span>
          Contar 2020–21 (pandemia)
        </button>
      )}
    </div>
  );
}

/* ====================================================================================== legend */

export function Legend({
  layer, counts, nd, undeclared, total, hot, onHot, pinned, onPin, scopeLabel, compact, mobile, left, note, hist,
}: {
  compact?: boolean;
  mobile?: boolean;
  left?: number;
  layer: Layer;
  counts: number[];
  nd: number;
  undeclared: number;
  total: number;
  hot: string | null;
  onHot: (k: string | null) => void;
  pinned: string | null;
  onPin: (k: string | null) => void;
  scopeLabel: string;
  note?: string;
  /** distribution strip around the 25% line (where municipalities bunch up) */
  hist?: { counts: number[]; lo: number; step: number; ref: number; caption: React.ReactNode };
}) {
  const max = Math.max(1, ...counts);
  const noun = layer.level === "mun" ? "municípios" : "estados";
  // hover previews a class; click/tap pins it (the only way on touch), click again to release
  const bind = (key: string) => ({
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && onHot(key),
    onFocus: () => onHot(key),
    onBlur: () => onHot(null),
    onClick: () => onPin(pinned === key ? null : key),
    "aria-pressed": pinned === key,
  });
  if (compact || mobile)
    return (
      <div
        data-ui
        className={cn("m-panel absolute z-20 flex items-center gap-x-3 gap-y-1 rounded-full px-3 py-1.5", mobile ? "m-scroll inset-x-3 flex-nowrap overflow-x-auto" : "max-w-[calc(100%-32rem)] flex-wrap px-4 py-2")}
        style={mobile ? { bottom: 84 } : { left: (left ?? 0) + 76, bottom: 104 }}
        onPointerLeave={() => onHot(null)}
        role="group"
        aria-label={`Legenda: ${layer.title}`}
      >
        {layer.bins.map((b) => (
          <button key={b.key} type="button" className={cn("flex shrink-0 items-center gap-1.5 rounded-full text-[0.6875rem] whitespace-nowrap text-(--m-ink)/80 transition-opacity hover:text-(--m-ink)", mobile && "h-8 px-1", pinned === b.key && "font-medium text-(--m-ink)", hot && hot !== b.key && "opacity-40")} {...bind(b.key)}>
            <span className="size-2.5 rounded-[3px]" style={{ background: b.color }} />
            {b.label}
          </button>
        ))}
      </div>
    );
  return (
    <div data-ui className="m-panel absolute z-20 w-[13.75rem] p-3" style={{ left: (left ?? 0) + 76, bottom: 96 }} onPointerLeave={() => onHot(null)}>
      <div className="mb-2 text-[0.6875rem] leading-snug text-(--m-ink)/60">{layer.title}</div>
      <ul className="space-y-0.5">
        {layer.bins.map((b, i) => (
          <li key={b.key}>
            <button
              type="button"
              className={cn("group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-[0.75rem] transition-colors hover:bg-(--m-ink)/8", pinned === b.key && "bg-(--m-ink)/10", hot && hot !== b.key && "opacity-40")}
              {...bind(b.key)}
              aria-label={`${b.label}: ${counts[i]} ${noun}. Destacar no mapa`}
            >
              <span className="size-3 shrink-0 rounded-[3px]" style={{ background: b.color }} />
              <span className="flex-1 text-(--m-ink)/85">{b.label}</span>
              <Num value={counts[i]} fmt={(v) => int(Math.round(v))} className="text-(--m-ink)/65" />
            </button>
            <div className="mx-1 h-0.5 overflow-hidden rounded bg-(--m-ink)/6">
              <div className="m-bar-in h-full rounded transition-[width] duration-(--m-step) ease-(--m-ease)" style={{ width: `${(counts[i] / max) * 100}%`, background: b.color }} />
            </div>
          </li>
        ))}
        {nd > 0 && (
          <li className="flex items-center gap-2 px-1 pt-1 text-[0.75rem] text-(--m-ink)/60">
            <span className="size-3 shrink-0 rounded-[3px] border border-(--m-ink)/15 bg-(--bin-nd)" />
            <span className="flex-1">Sem dados</span>
            <span className="tnum">{int(nd)}</span>
          </li>
        )}
        {undeclared > 0 && (
          <li className="flex items-center gap-2 px-1 text-[0.75rem] text-(--m-ink)/60">
            <span className="size-3 shrink-0 rounded-[3px] border border-(--m-ink)/15 bg-(--m-undeclared)" />
            <span className="flex-1">Não declararam</span>
            <span className="tnum">{int(undeclared)}</span>
          </li>
        )}
      </ul>
      {hist && <Hist {...hist} />}
      <div className="mt-2 border-t border-(--m-ink)/8 pt-2 text-[0.6875rem] leading-snug text-(--m-ink)/60">
        {scopeLabel} · {int(total)} {noun}
        {note && <span className="mt-0.5 block">{note}</span>}
        <span className="m-tall-only mt-0.5 block text-(--m-ink)/50">{pinned ? "Clique de novo na classe para soltar" : "Passe o mouse ou clique numa classe para destacá-la"}</span>
      </div>
    </div>
  );
}

function Hist({ counts, lo, step, ref, caption }: { counts: number[]; lo: number; step: number; ref: number; caption: React.ReactNode }) {
  const max = Math.max(1, ...counts);
  const n = counts.length;
  const W = 200, H = 34;
  const bw = W / n;
  const xr = ((ref - lo) / step) * bw;
  return (
    <div className="m-tall-only m-hist mt-2.5 border-t border-(--m-ink)/8 pt-2">
      <svg viewBox={`0 0 ${W} ${H + 10}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`Distribuição dos municípios entre ${lo}% e ${lo + n * step}%`}>
        {counts.map((c, i) => {
          const v = lo + i * step;
          const h = c ? Math.max(1, (c / max) * H) : 0;
          return <rect key={i} x={i * bw + 0.5} y={0} width={bw - 1} height={H} fill={binColor(v)} style={{ transform: `scaleY(${h / H})`, transformBox: "fill-box", transformOrigin: "bottom", transition: "transform var(--m-step) var(--m-ease)" }} />;
        })}
        <line x1={xr} x2={xr} y1={-2} y2={H} stroke="var(--m-ink)" strokeWidth={1} strokeDasharray="2 2" />
        <text x={0} y={H + 9} fontSize="8" fill="color-mix(in srgb, var(--m-ink) 55%, transparent)">{lo}%</text>
        <text x={xr} y={H + 9} fontSize="8" textAnchor="middle" fill="var(--m-ink)">25%</text>
        <text x={W} y={H + 9} fontSize="8" textAnchor="end" fill="color-mix(in srgb, var(--m-ink) 55%, transparent)">{lo + n * step}%</text>
      </svg>
      <p className="mt-1 text-[0.6875rem] leading-snug text-(--m-ink)/70">{caption}</p>
    </div>
  );
}

/* ====================================================================================== left panel */

/** Collapses to zero height (and out of the accessibility tree) without unmounting, so opening and closing glide. */
const Reveal = ({ show, children }: { show: boolean; children: React.ReactNode }) => (
  <div className="grid transition-[grid-template-rows,opacity] duration-(--m-step) ease-(--m-ease)" style={{ gridTemplateRows: show ? "1fr" : "0fr", opacity: show ? 1 : 0 }} aria-hidden={!show} inert={!show}>
    <div className="min-h-0 overflow-hidden">{children}</div>
  </div>
);

const R = ({ children }: { children: React.ReactNode }) => <span className="text-(--m-red)">{children}</span>;
const B = ({ children }: { children: React.ReactNode }) => <span className="text-(--m-blue)">{children}</span>;

type ListItem = { id: number; name: string; uf: string; value: string; frac: number; flag?: boolean; color?: string; atMin?: boolean };
type Rank = { key: string; label: string; note?: string; items: ListItem[]; toggle?: { on: boolean; label: string; flip: () => void } };

const EC119 = { from: PANDEMIC[0], to: PANDEMIC[1], label: "2020–21: EC 119/2022 isenta quem ficou abaixo de 25% na pandemia e compensou até 2023" };

export function LeftPanel({
  ind, scope, year, yi, years, brStats, ufs, rows, rowsLoading, onCity, onYear, skipPand, insight,
}: {
  ind: Ind;
  scope: Scope;
  year: number;
  yi: number;
  years: number[];
  brStats: Stats[];
  ufs: UfSummary[];
  rows: Row[] | null;
  rowsLoading: boolean;
  onCity: (uf: string, id: number) => void;
  onYear: (i: number) => void;
  skipPand?: boolean;
  insight?: { text: React.ReactNode; go: () => void } | null;
}) {
  const skip = useMemo(() => (skipPand ? pandemicIdx(years) : undefined), [skipPand, years]);
  const [showAtip, setShowAtip] = useState(false);
  const [facts, setFacts] = useState(false);
  const ufSum = scope.uf ? ufs.find((u) => u.uf === scope.uf) : null;
  const stats = ufSum ? ufSum.stats : brStats;
  const s = stats[yi];
  const sp = yi > 0 ? stats[yi - 1] : null;
  const place = scope.uf ? ufName(scope.uf) : "Brasil";
  const inScope = useMemo(() => (rows ? (scope.uf ? rows.filter((r) => r.uf === scope.uf) : rows) : null), [rows, scope.uf]);

  const rec = useMemo(() => {
    if (!inScope) return null;
    let never = 0, some = 0, three = 0, five = 0;
    for (const r of inScope) {
      const t = timesBelowUntil(r, yi, skip);
      if (t === 0) never++;
      else some++;
      if (t >= 3) three++;
      if (t >= 5) five++;
    }
    return { never, some, three, five, n: inScope.length };
  }, [inScope, yi, skip]);

  const ranks = useMemo<Rank[]>(() => {
    if (!inScope) return [];
    const mk = (r: Row, value: string, frac: number, flag?: boolean): ListItem => ({ id: r.id, name: r.name, uf: r.uf, value, frac, flag });
    if (ind === "mde" || ind === "fun") {
      const arr = (ind === "mde" ? "mde" : "fun") as "mde" | "fun";
      const atip = (r: Row) => isAtip(r, yi, arr === "mde" ? "mde" : undefined);
      const vals = inScope.filter((r) => r[arr][yi] != null && !(r.since != null && year < r.since));
      const hidden = vals.filter(atip).length;
      const sorted = [...vals].filter((r) => showAtip || !atip(r)).sort((a, b) => a[arr][yi]! - b[arr][yi]!).slice(0, 15);
      const ref = ind === "mde" ? MDE_MIN : funMin(year);
      const bins = ind === "mde" ? null : funBins(year);
      // bar = how far below the minimum (p.p.), coloured by the map class; rows at/above the minimum get no bar
      const gap = Math.max(0.5, ...sorted.map((r) => ref - r[arr][yi]!));
      const low: Rank = {
        key: "low",
        label: `Menor % em ${year}`,
        note: hidden
          ? showAtip
            ? "Valores muito fora do padrão podem ser erro de declaração (⚠): confirme na fonte."
            : `${hidden} ${hidden === 1 ? "valor atípico oculto" : "valores atípicos ocultos"} (possível erro de declaração).`
          : undefined,
        items: sorted.map((r) => {
          const v = r[arr][yi]!;
          return { ...mk(r, pct(v), v >= ref ? 0 : (ref - v) / gap, atip(r)), color: bins ? colorOf(bins, v) : binColor(v), atMin: v >= ref };
        }),
        toggle: hidden ? { on: showAtip, label: showAtip ? "Ocultar atípicos" : `Mostrar ${hidden} atípicos`, flip: () => setShowAtip((x) => !x) } : undefined,
      };
      if (ind !== "mde") return [low];
      const def = inScope
        .map((r) => ({ r, v: r.short.reduce<number>((a, v, i) => a + (toReal(v ?? 0, years[i]) ?? 0), 0) }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 15);
      const top = def[0]?.v ?? 1;
      return [
        low,
        {
          key: "def",
          label: "Soma do que faltou",
          note: `Soma do que faltou para chegar a 25% em cada ano abaixo, de ${years[0]} a ${years[years.length - 1]}, em R$ de ${IPCA_BASE} (IPCA). Não desconta os anos em que o município aplicou acima de 25% (o déficit não compensado está no painel completo).`,
          items: def.map(({ r, v }) => mk(r, brlShort(v), v / top)),
        },
      ];
    }
    if (ind === "aluno") {
      const vals = inScope.filter((r) => r.aluno[yi] != null && !isAtip(r, yi, "aluno"));
      const hi = [...vals].sort((a, b) => b.aluno[yi]! - a.aluno[yi]!).slice(0, 15);
      const lo = [...vals].sort((a, b) => a.aluno[yi]! - b.aluno[yi]!).slice(0, 15);
      const top = hi[0]?.aluno[yi] ?? 1;
      const money = (r: Row) => `R$ ${int(Math.round(alunoReal(r.aluno[yi], year) ?? r.aluno[yi]!))}`;
      const note = `Sem os valores fora do padrão. Em ${ALUNO_UNIT}.`;
      return [
        { key: "hi", label: "Maior valor por aluno", note, items: hi.map((r) => mk(r, money(r), r.aluno[yi]! / top)) },
        { key: "lo", label: "Menor valor por aluno", note, items: lo.map((r) => mk(r, money(r), Math.max(0.05, r.aluno[yi]! / top))) },
      ];
    }
    const t = new Map(inScope.map((r) => [r.id, timesBelowUntil(r, yi, skip)]));
    const worst = [...inScope].filter((r) => t.get(r.id)! > 0).sort((a, b) => t.get(b.id)! - t.get(a.id)! || b.pop - a.pop).slice(0, 15);
    return [
      {
        key: "rec",
        label: "Mais anos abaixo de 25%",
        note: `Anos com percentual declarado abaixo do mínimo, de ${years[0]} a ${year}${skip ? ", sem contar 2020–21" : ""}. Empates: maior população primeiro.`,
        items: worst.map((r) => mk(r, `${t.get(r.id)} ${t.get(r.id) === 1 ? "ano" : "anos"}`, t.get(r.id)! / (yi + 1))),
      },
    ];
  }, [inScope, ind, yi, year, years, skip, showAtip]);

  const [tab, setTab] = useState(0);
  const [more, setMore] = useState(false);
  const rank = ranks[Math.min(tab, ranks.length - 1)];
  const shown = rank ? rank.items.slice(0, more ? 15 : 5) : [];

  const below = ind === "fun" ? s.funBelow : s.below;
  const reported = ind === "fun" ? s.funReported : s.reported;
  const ok = reported - below;
  const share = reported ? (below / reported) * 100 : 0;
  const prevBelow = sp ? (ind === "fun" ? sp.funBelow : sp.below) : null;
  const delta = prevBelow == null ? null : below - prevBelow;

  // tweened counts are leaf components (<Num>), so a count-up re-renders a span per frame, not the whole panel
  const nBelow = <Num value={below} fmt={(v) => int(Math.round(v))} />;

  const chart = useMemo(() => {
    const of = (x: Stats, i: number) => (ind === "fun" ? (x.funReported ? (x.funBelow / x.funReported) * 100 : null) : ind === "aluno" ? alunoReal(x.alunoMedian, years[i]) : belowShare(x));
    const own = stats.map(of);
    const base = brStats.map(of);
    const color = ind === "aluno" ? "var(--m-blue)" : "var(--m-red)";
    const fmt = ind === "aluno" ? (v: number) => `R$ ${int(Math.round(v))}` : (v: number) => pct(v, 1);
    return {
      series: [
        { values: own, color, label: place, fmt, area: true },
        ...(scope.uf ? [{ values: base, color: "color-mix(in srgb, var(--m-ink) 55%, transparent)", label: "Brasil", fmt, dashed: true }] : []),
      ],
      title: ind === "aluno" ? `Mediana por aluno, ${ALUNO_UNIT}` : ind === "fun" ? "% abaixo do mínimo do Fundeb (60%; 70% desde 2021)" : "% dos municípios abaixo de 25%",
    };
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [stats, brStats, ind, scope.uf, place, years]);

  const headline = (() => {
    if (ind === "mde") {
      if (!below) return <>Nenhum município {scope.uf ? `de ${place} ` : ""}ficou abaixo de <B>25%</B> em {year}</>;
      return scope.uf ? (
        <>
          Em {place}, <R>{nBelow} de {int(reported)}</R> municípios aplicaram menos de 25% em educação
        </>
      ) : (
        <>
          <R>{nBelow} {below === 1 ? "município aplicou" : "municípios aplicaram"}</R> menos de 25% da receita em educação
        </>
      );
    }
    if (ind === "fun")
      return below ? (
        <>
          <R>{nBelow} {below === 1 ? "município pagou" : "municípios pagaram"}</R> menos de {funMin(year)}% do Fundeb aos profissionais{scope.uf ? ` em ${place}` : ""}
        </>
      ) : (
        <>Todos os municípios {scope.uf ? `de ${place} ` : ""}cumpriram o mínimo de <B>{funMin(year)}%</B> do Fundeb em pessoal</>
      );
    if (ind === "aluno")
      return (
        <>
          {scope.uf ? `Em ${place}, o` : "O"} município mediano investiu <B>R$ {int(Math.round(alunoReal(s.alunoMedian, year) ?? 0))}</B> por aluno em {year}
        </>
      );
    return rec ? (
      rec.three ? (
        <>
          <R>{int(rec.three)} {rec.three === 1 ? "município" : "municípios"}</R> {scope.uf ? `de ${place} ` : ""}{rec.three === 1 ? "ficou" : "ficaram"} abaixo de 25% em <b className="font-normal">3 anos ou mais</b> de {years[0]} a {year}
        </>
      ) : (
        <>Nenhum município {scope.uf ? `de ${place} ` : ""}ficou abaixo de 25% em 3 anos ou mais de {years[0]} a {year}</>
      )
    ) : (
      <>Quantos anos cada município ficou abaixo de 25%</>
    );
  })();

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-1 m-scroll" data-ui>
      <section className="m-panel m-rise p-4">
        <div className="flex items-center justify-between gap-2 text-[0.75rem] text-(--m-ink)/55">
          <span>{place} · {ind === "rec" ? `${years[0]}–${year}` : year}</span>
          <span className="tnum">{int(s.reported)} de {int(s.n)} declararam</span>
        </div>
        <h2 key={`${ind}-${scope.uf}`} className="font-display m-rise mt-2.5 min-h-[2.24em] text-[1.625rem] leading-[1.12] text-balance text-(--m-ink)">{headline}</h2>
        {insight && (
          <button type="button" onClick={insight.go} className="group mt-2.5 flex w-full items-start gap-2 rounded-lg text-left text-[0.75rem] leading-snug text-(--m-ink)/75 transition-colors hover:text-(--m-ink)">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-(--m-red)" />
            <span className="min-h-[4.125em] flex-1">{insight.text}</span>
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-(--m-ink)/50 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
        {(ind === "mde" || ind === "rec") && (
          // the note opens and closes in place (height glides) so the cards below don't jump while the years play
          <Reveal show={PANDEMIC.includes(year) || (ind === "rec" && year >= PANDEMIC[0])}>
            <p className="mt-2 rounded-lg border border-(--m-amber-fill)/30 bg-(--m-amber-fill)/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-(--m-amber)">
              {ind === "rec"
                ? skipPand
                  ? "Sem contar 2020–21: pela EC 119/2022, quem ficou abaixo na pandemia e compensou até 2023 não é punido."
                  : "Inclui 2020–21, anos da pandemia: pela EC 119/2022, quem compensou até 2023 não é punido."
                : `${Math.min(PANDEMIC[1], Math.max(PANDEMIC[0], year))} foi ano de pandemia: pela EC 119/2022, quem ficou abaixo de 25% e compensou a diferença até 2023 não é punido.`}
            </p>
          </Reveal>
        )}

        {(ind === "mde" || ind === "fun") && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[0.6875rem] text-(--m-red)">Abaixo do mínimo</div>
                <div className="font-display text-[2.375rem] leading-none text-(--m-ink) tnum">
                  {nBelow}
                </div>
                <div className="mt-1 text-[0.75rem] text-(--m-ink)/50 tnum">{reported ? pct(share, share < 10 ? 1 : 0) : "—"} dos que declararam</div>
              </div>
              <div className="text-right">
                <div className="text-[0.6875rem] text-(--m-blue)">No mínimo ou mais</div>
                <div className="font-display text-[2.375rem] leading-none text-(--m-ink) tnum"><Num value={ok} fmt={(v) => int(Math.round(v))} /></div>
                <div className="mt-1 text-[0.75rem] text-(--m-ink)/50 tnum">{reported ? pct(100 - share, share < 10 ? 1 : 0) : "—"}</div>
              </div>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-(--m-ink)/10" role="img" aria-label={`${below} abaixo e ${ok} no mínimo ou mais`}>
              <div className="h-full bg-(--m-red) transition-[width] duration-(--m-step) ease-(--m-ease)" style={{ width: `${Math.max(below ? 1.2 : 0, share)}%` }} />
              <div className="h-full flex-1 bg-(--m-blue)/80" />
            </div>
          </>
        )}
        {ind === "aluno" && (
          <div className="mt-4">
            <div className="font-display text-[2.375rem] leading-none text-(--m-ink)">
              <Num value={alunoReal(s.alunoMedian, year) ?? 0} fmt={(v) => `R$ ${int(Math.round(v))}`} />
            </div>
            <div className="mt-1 text-[0.75rem] text-(--m-ink)/60">mediana por aluno, em {ALUNO_UNIT}</div>
          </div>
        )}
        {ind === "rec" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[0.6875rem] text-(--m-red)">Já ficaram abaixo</div>
              <div className="font-display text-[2.375rem] leading-none tnum text-(--m-ink)">{rec ? int(rec.some) : "…"}</div>
              <div className="mt-1 text-[0.75rem] text-(--m-ink)/50 tnum">{rec ? pct((rec.some / rec.n) * 100, 0) : ""} em algum ano</div>
            </div>
            <div className="text-right">
              <div className="text-[0.6875rem] text-(--m-blue)">Nunca ficaram</div>
              <div className="font-display text-[2.375rem] leading-none tnum text-(--m-ink)">{rec ? int(rec.never) : "…"}</div>
              <div className="mt-1 text-[0.75rem] text-(--m-ink)/50 tnum">{rec ? pct((rec.never / rec.n) * 100, 0) : ""}</div>
            </div>
          </div>
        )}

        {/* on short screens (1280×720) the fact rows fold so the rankings stay within reach */}
        <button type="button" className="m-facts-btn mt-3 text-[0.75rem] text-(--m-ink)/65 underline-offset-2 hover:text-(--m-ink) hover:underline" aria-expanded={facts} onClick={() => setFacts((f) => !f)}>
          {facts ? "Menos números" : "Mais números"}
        </button>
        <div className="m-facts mt-4 divide-y divide-(--m-ink)/6 border-t border-(--m-ink)/8 pt-1" data-open={facts ? "1" : "0"}>
          {ind === "mde" && (
            <>
              <FactRow k={`Faltou aplicar (R$ de ${year})`} v={shortfallLabel(s).value} tone={s.below ? "red" : undefined} />
              <FactRow k="Moram nesses municípios" v={s.below ? `${int(s.popBelow)} hab. (${pct((s.popBelow / (s.pop || 1)) * 100, 1)})` : "—"} />
              <FactRow k="Mediana aplicada em MDE" v={pct(s.median)} />
              <FactRow k="Não declararam" v={int(s.nd)} />
              <FactRow k={delta == null ? "Variação vs ano anterior" : `Variação vs ${years[yi - 1]}`} v={delta == null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${int(Math.abs(delta))} municípios`} tone={delta == null ? undefined : delta > 0 ? "red" : delta < 0 ? "blue" : undefined} />
              {ufSum && <FactRow k="Governo estadual" v={pct(ufSum.gov[yi])} tone={ufSum.gov[yi] != null && ufSum.gov[yi]! < MDE_MIN ? "red" : undefined} />}
            </>
          )}
          {ind === "fun" && (
            <>
              <FactRow k={`Mínimo legal em ${year}`} v={`${funMin(year)}%`} />
              <FactRow k="Mediana paga em pessoal" v={pct(s.funMedian)} />
              <FactRow k={delta == null ? "Variação vs ano anterior" : `Variação vs ${years[yi - 1]}`} v={delta == null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${int(Math.abs(delta))} municípios`} tone={delta == null ? undefined : delta > 0 ? "red" : delta < 0 ? "blue" : undefined} />
            </>
          )}
          {ind === "aluno" && (
            <>
              <FactRow k="Municípios com dado" v={int(inScope ? inScope.filter((r) => r.aluno[yi] != null).length : s.reported)} />
              {(() => {
                const a = alunoReal(s.alunoMedian, year), b = yi > 0 ? alunoReal(sp?.alunoMedian, years[yi - 1]) : null;
                return a != null && b ? <FactRow k={`vs ${years[yi - 1]} (real)`} v={`${a >= b ? "+" : "−"}${pct((Math.abs(a - b) / b) * 100, 1)}`} tone={a >= b ? "blue" : "red"} /> : null;
              })()}
            </>
          )}
          {ind === "rec" && rec && (
            <>
              <FactRow k="3 anos ou mais abaixo" v={int(rec.three)} tone="red" />
              <FactRow k="5 anos ou mais abaixo" v={int(rec.five)} tone="red" />
              <FactRow k="Municípios" v={int(rec.n)} />
            </>
          )}
        </div>
      </section>

      <section className="m-panel m-rise p-4" style={{ animationDelay: "60ms" }}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[0.8125rem] font-medium text-(--m-ink)/85">Ao longo dos anos</h3>
          <span className="text-[0.6875rem] text-(--m-ink)/60">{chart.title}</span>
        </div>
        <LineChart years={years} series={chart.series} yi={yi} onPick={onYear} band={ind === "mde" || ind === "rec" ? EC119 : undefined} domain={ind === "aluno" ? undefined : [0, Math.max(1, ...chart.series.flatMap((x) => x.values).filter((v): v is number => v != null)) * 1.1]} />
      </section>

      <section className="m-panel m-rise p-4" style={{ animationDelay: "120ms" }}>
        {rowsLoading || !rank ? (
          <div className="py-6 text-center text-[0.8125rem] text-(--m-ink)/50" role="status">
            <div className="m-spinner mx-auto mb-2" />
            Carregando os municípios…
          </div>
        ) : (
          <>
            {ranks.length === 1 ? (
              <h3 className="mb-2 text-[0.8125rem] font-medium text-(--m-ink)/85">{rank.label}</h3>
            ) : (
              <div className="mb-2 flex flex-wrap items-center gap-1" role="tablist" aria-label="Rankings" onKeyDown={(e) => roving(e, ranks.length, Math.min(tab, ranks.length - 1), (i) => { setTab(i); setMore(false); })}>
                {ranks.map((r, i) => {
                  const on = i === Math.min(tab, ranks.length - 1);
                  return (
                    <button key={r.key} role="tab" type="button" aria-selected={on} tabIndex={on ? 0 : -1} className="m-pill h-7 px-2.5 text-[0.75rem] max-lg:h-9" onClick={() => { setTab(i); setMore(false); }}>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
            <ol className="divide-y divide-(--m-ink)/6">
              {shown.map((it, i) => (
                <li key={it.id}>
                  <button type="button" onClick={() => onCity(it.uf, it.id)} className="group flex w-full items-center gap-2.5 py-1.5 text-left transition-colors hover:bg-(--m-ink)/5">
                    <span className="w-4 shrink-0 text-center text-[0.6875rem] text-(--m-ink)/50 tnum">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5 text-[0.8125rem] text-(--m-ink)/90">
                        <span className="truncate">{it.name}</span>
                        {!scope.uf && <span className="text-[0.6875rem] text-(--m-ink)/55">{it.uf}</span>}
                        {it.flag && <span title="Valor fora do padrão do município: confirme na fonte" className="text-[0.6875rem] text-(--m-amber)">⚠</span>}
                      </span>
                      <span className="mt-1 block h-[3px] overflow-hidden rounded bg-(--m-ink)/8">
                        <span className="m-bar-in block h-full rounded bg-(--m-red)/85 transition-[width] duration-(--m-step) ease-(--m-ease)" style={{ width: `${Math.min(100, it.frac * 100)}%`, background: it.color ?? (ind === "aluno" ? "var(--m-blue)" : undefined), animationDelay: `${i * 40}ms` }} />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-[0.8125rem] font-medium text-(--m-ink) tnum">{it.value}</span>
                      {it.atMin && <span className="text-[0.625rem] text-(--m-ink)/60">no mínimo</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {rank.items.length > 5 && (
              <button type="button" className="mt-1.5 text-[0.75rem] text-(--m-ink)/55 underline-offset-2 hover:text-(--m-ink) hover:underline" onClick={() => setMore((m) => !m)}>
                {more ? "Mostrar menos" : `Ver os ${rank.items.length} primeiros`}
              </button>
            )}
            {rank.note && (
              <p className="mt-2 text-[0.6875rem] leading-snug text-(--m-ink)/60">
                {rank.note}
                {rank.toggle && (
                  <>
                    {" "}
                    <button type="button" className="underline underline-offset-2 hover:text-(--m-ink)" aria-pressed={rank.toggle.on} onClick={rank.toggle.flip}>
                      {rank.toggle.label}
                    </button>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ====================================================================================== drawer */

const money = (v: number) => `R$ ${int(Math.round(v))}`;

/** What the drawer leads with for the active indicator: the map and the drawer always tell the same story. */
function drawerSpec(ind: Ind, row: Row, yi: number, year: number, years: number[], brStats: Stats[], skip?: Set<number>) {
  const existed = row.since == null || year >= row.since;
  if (ind === "fun") {
    const m = funMin(year);
    const v = row.fun[yi];
    const status = v == null ? "Sem dados" : v < m ? "Abaixo do mínimo do Fundeb" : v < m + 5 ? "No limite" : "Cumpriu o mínimo do Fundeb";
    const tone = v == null ? "var(--m-faint)" : v < m ? "var(--m-red)" : v < m + 5 ? "var(--m-amber-fill)" : "var(--m-blue)";
    return {
      v, prev: yi > 0 ? row.fun[yi - 1] : null, fmt: (x: number) => pct(x, 1), deltaUnit: "pp" as const, status, tone,
      gauge: v == null ? null : { frac: Math.min(1, v / 100), mark: m / 100, markLabel: `${m}% mínimo`, lo: "0%", hi: "100%", aria: `${pct(v, 1)} do Fundeb em pessoal; mínimo de ${m}%` },
      sentence:
        v == null ? "Sem percentual do Fundeb declarado neste ano." : v < m
          ? <>Pagou <b className="font-medium text-(--m-ink)">{pct(m - v, 1).replace("%", "")} p.p.</b> abaixo do mínimo de {m}% do Fundeb aos profissionais da educação.</>
          : <>Pagou <b className="font-medium text-(--m-ink)">{pct(v - m, 1).replace("%", "")} p.p.</b> acima do mínimo de {m}% do Fundeb aos profissionais da educação.</>,
      chartTitle: `Fundeb em pessoal, ${years[0]}–${years[years.length - 1]}`,
      chart: { values: row.fun, label: "Fundeb", ref: years.map(funMin) as number | number[] | null, refLabel: `mínimo ${m}%`, marks: row.fun.flatMap((x, i) => (x != null && x < funMin(years[i]) ? [i] : [])), markLabel: "abaixo do mínimo" },
      atip: false, existed,
    };
  }
  if (ind === "aluno") {
    const v = alunoReal(row.aluno[yi], year);
    const med = alunoReal(brStats[yi].alunoMedian, year);
    const status = v == null || !med ? "Sem dados" : v >= med ? "Acima da mediana do Brasil" : "Abaixo da mediana do Brasil";
    const tone = v == null || !med ? "var(--m-faint)" : v >= med ? "var(--m-blue)" : "var(--m-dim)";
    const rel = v != null && med ? ((v - med) / med) * 100 : null;
    return {
      v, prev: yi > 0 ? alunoReal(row.aluno[yi - 1], years[yi - 1]) : null, fmt: money, deltaUnit: "rel" as const, status, tone,
      gauge: v == null || !med ? null : { frac: Math.min(1, v / (med * 2)), mark: 0.5, markLabel: `mediana ${money(med)}`, lo: "R$ 0", hi: `${money(med * 2)}+`, aria: `${money(v)} por aluno; mediana do Brasil ${money(med)}` },
      sentence:
        v == null || rel == null ? "Sem valor por aluno declarado neste ano." : (
          <>Investiu <b className="font-medium text-(--m-ink)">{money(v)}</b> por aluno no ano, {pct(Math.abs(rel), 0)} {rel >= 0 ? "acima" : "abaixo"} da mediana dos municípios brasileiros. Em {ALUNO_UNIT}.</>
        ),
      chartTitle: `R$ por aluno, ${years[0]}–${years[years.length - 1]}`,
      chart: { values: row.aluno.map((x, i) => alunoReal(x, years[i])), label: "Por aluno", ref: null, refLabel: undefined, marks: [] as number[], markLabel: null, base: brStats.map((x, i) => alunoReal(x.alunoMedian, years[i])) },
      atip: isAtip(row, yi, "aluno"), existed,
    };
  }
  // mde and rec share the series; rec leads with the count of years below up to the chosen year
  const v = row.mde[yi];
  const nd = row.nd[yi];
  const marks = row.mde.flatMap((x, i) => (x != null && x < MDE_MIN ? [i] : []));
  const chart = { values: row.mde, label: "% em educação", ref: MDE_MIN as number | number[] | null, refLabel: "mínimo 25%", marks, markLabel: "abaixo de 25%" };
  if (ind === "rec") {
    const n = timesBelowUntil(row, yi, skip);
    const known = row.mde.slice(0, yi + 1).filter((x, i) => x != null && !skip?.has(i)).length;
    const yrs = marks.filter((i) => i <= yi && !skip?.has(i)).map((i) => years[i]);
    return {
      v: n, prev: null, fmt: (x: number) => `${Math.round(x)} ${Math.round(x) === 1 ? "ano" : "anos"}`, deltaUnit: null, tone: n ? "var(--m-red)" : "var(--m-blue)",
      status: n === 0 ? `Nunca abaixo de 25% até ${year}` : n >= 3 ? "Reincidente" : `Abaixo de 25% em ${n === 1 ? "1 ano" : `${n} anos`}`,
      gauge: null, strip: true,
      sentence: n === 0
        ? <>Cumpriu o mínimo em todos os {known} anos com dado, de {years[0]} a {year}{skip ? " (sem contar 2020–21)" : ""}.</>
        : <>Ficou abaixo de 25% em <b className="font-medium text-(--m-ink)">{n} de {known}</b> anos com dado, de {years[0]} a {year}{skip ? " (sem contar 2020–21)" : ""}: {yrs.join(", ")}.</>,
      chartTitle: `% em educação, ${years[0]}–${years[years.length - 1]}`,
      chart, atip: false, existed,
    };
  }
  const short = row.short[yi];
  const diff = v != null ? v - MDE_MIN : null;
  return {
    v, prev: yi > 0 ? row.mde[yi - 1] : null, fmt: (x: number) => pct(x), deltaUnit: "pp" as const,
    status: !existed ? "Não existia" : nd ? "Não declarou" : v == null ? "Sem dados" : v < MDE_MIN ? "Abaixo do mínimo" : v < MDE_MIN + 1 ? "No limite" : "Cumpriu o mínimo",
    tone: !existed || v == null ? "var(--m-faint)" : v < MDE_MIN ? "var(--m-red)" : v < MDE_MIN + 1 ? "var(--m-amber-fill)" : "var(--m-blue)",
    gauge: v == null ? null : { frac: Math.min(1, v / 50), mark: 0.5, markLabel: "25% mínimo", lo: "0%", hi: "50%+", aria: `${pct(v)} aplicados; mínimo de 25%` },
    sentence: !existed
      ? `Município instalado em ${row.since}.`
      : nd
        ? "Não entregou a declaração de despesas em educação ao governo federal neste ano."
        : v == null
          ? "Sem percentual declarado neste ano."
          : v < MDE_MIN
            ? <>Aplicou <b className="font-medium text-(--m-ink)">{pct(-diff!, 2).replace("%", "")} p.p.</b> abaixo do mínimo{short ? <>, cerca de <b className="font-medium text-(--m-red)">{brlShort(short)}</b> a menos do que a Constituição manda</> : ""}.</>
            : <>Aplicou <b className="font-medium text-(--m-ink)">{pct(diff!, 2).replace("%", "")} p.p.</b> acima do mínimo constitucional.</>,
    chartTitle: `% em educação, ${years[0]}–${years[years.length - 1]}`,
    chart, atip: isAtip(row, yi, "mde"), existed,
  };
}

export function Drawer({
  ind, row, rows, year, yi, years, brStats, onClose, onYear, mobile, tall, onTall, skipPand, nav, onCity, onState,
}: {
  ind: Ind;
  row: Row;
  rows: Row[];
  year: number;
  yi: number;
  years: number[];
  brStats: Stats[];
  onClose: () => void;
  onYear: (i: number) => void;
  mobile?: boolean;
  tall?: boolean;
  onTall?: () => void;
  skipPand?: boolean;
  nav?: { pos: number; of: number; prev: number | null; next: number | null } | null;
  onCity?: (id: number) => void;
  onState?: () => void;
}) {
  const sp = drawerSpec(ind, row, yi, year, years, brStats, skipPand ? pandemicIdx(years) : undefined);
  const v = sp.v;
  const key = ind === "fun" ? "fun" : ind === "aluno" ? "aluno" : "mde";
  const metricLabel = key === "fun" ? "Fundeb em pessoal" : key === "aluno" ? "R$ por aluno" : "% em educação";
  const ranks = useMemo(() => {
    const own = row[key][yi];
    if (own == null) return null;
    const uf = rows.filter((r) => r.uf === row.uf && r[key][yi] != null);
    const br = rows.filter((r) => r[key][yi] != null);
    return {
      uf: { pos: 1 + uf.filter((r) => r[key][yi]! > own).length, of: uf.length },
      br: { pos: 1 + br.filter((r) => r[key][yi]! > own).length, of: br.length },
    };
  }, [rows, row, key, yi]);
  const fun = row.fun[yi];
  const aluno = alunoReal(row.aluno[yi], year);
  const mde = row.mde[yi];
  const times = timesBelowUntil(row, yi);
  const [copied, setCopied] = useState(false);
  const href = `${cityPath(row.uf, row.slug)}${year === years[years.length - 1] ? "" : `?ano=${year}`}`;
  const title = useRef<HTMLHeadingElement>(null);
  // move focus into the drawer when it opens (keyed per city), so keyboard and screen-reader users land on it
  useEffect(() => title.current?.focus({ preventScroll: true }), []);

  const delta =
    v != null && sp.prev != null && sp.deltaUnit
      ? sp.deltaUnit === "pp"
        ? `${v - sp.prev >= 0 ? "▲" : "▼"} ${pct(Math.abs(v - sp.prev), key === "fun" ? 1 : 2).replace("%", "")} p.p. vs ${years[yi - 1]}`
        : sp.prev
          ? `${v - sp.prev >= 0 ? "▲" : "▼"} ${pct((Math.abs(v - sp.prev) / sp.prev) * 100, 1)} vs ${years[yi - 1]}`
          : null
      : null;

  return (
    <aside data-ui className="m-panel m-slide-in flex min-h-0 flex-col overflow-hidden" aria-label={`Detalhes de ${row.name}`}>
      {mobile && (
        <button type="button" onClick={onTall} className="flex h-6 w-full shrink-0 items-center justify-center" aria-label={tall ? "Recolher detalhes" : "Expandir detalhes"} aria-expanded={tall}>
          <span className="h-1 w-10 rounded-full bg-(--m-ink)/25" />
        </button>
      )}
      <div className={cn("m-scroll min-h-0 flex-1 overflow-y-auto p-4", mobile && "pt-1")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.75rem] text-(--m-ink)/60">
              <button type="button" onClick={onState} className="inline-flex items-center gap-0.5 rounded hover:text-(--m-ink) hover:underline underline-offset-2" title={`Voltar para ${ufName(row.uf)}`}>
                <ChevronLeft className="size-3.5" />
                {ufName(row.uf)}
              </button>
              {row.capital ? " · capital" : ""}
            </div>
            <h2 ref={title} tabIndex={-1} className="font-display mt-0.5 text-[1.75rem] leading-tight text-(--m-ink) outline-none">{row.name}</h2>
            <div className="mt-0.5 text-[0.75rem] text-(--m-ink)/60 tnum">{int(row.pop)} habitantes</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {nav && (
              <div className="flex items-center rounded-full border border-(--m-line) text-[0.6875rem] text-(--m-ink)/65 tnum">
                <button type="button" className="m-ctl m-ctl-flat size-8! disabled:opacity-30" disabled={nav.prev == null} onClick={() => nav.prev != null && onCity?.(nav.prev)} aria-label="Município anterior no ranking do estado" title="Anterior no ranking do estado">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="px-0.5" title={`Posição em ${row.uf} (${metricLabel})`}>{nav.pos}/{nav.of}</span>
                <button type="button" className="m-ctl m-ctl-flat size-8! disabled:opacity-30" disabled={nav.next == null} onClick={() => nav.next != null && onCity?.(nav.next)} aria-label="Próximo município no ranking do estado" title="Próximo no ranking do estado">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <button type="button" onClick={onClose} className="m-ctl size-9!" aria-label="Fechar detalhes" title="Fechar (Esc)">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[0.75rem]" style={{ color: sp.tone }}>
          <span className="size-2 rounded-full" style={{ background: sp.tone }} />
          <span className="font-medium">{sp.status}</span>
          <span className="text-(--m-ink)/50">· {ind === "rec" ? `${years[0]}–${year}` : year}</span>
        </div>
        <div className="mt-1 flex items-end gap-3">
          <div className="font-display text-[3rem] leading-none text-(--m-ink) tnum">{v == null ? "—" : ind === "rec" ? sp.fmt(v) : <Num value={v} fmt={sp.fmt} />}</div>
          {delta && <div className="pb-1.5 text-[0.75rem] text-(--m-ink)/60 tnum">{delta}</div>}
        </div>
        <div className="mt-0.5 text-[0.6875rem] text-(--m-ink)/50">{INDS.find((i) => i.key === ind)!.unit}</div>

        {sp.gauge && (
          <div className="mt-3">
            <div className="relative h-2 rounded-full bg-(--m-ink)/10" role="img" aria-label={sp.gauge.aria}>
              <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${sp.gauge.frac * 100}%`, background: sp.tone }} />
              <div className="absolute -top-1 -bottom-1 w-px bg-(--m-ink)" style={{ left: `${sp.gauge.mark * 100}%` }} />
            </div>
            <div className="relative mt-1 h-3 text-[0.625rem] text-(--m-ink)/55 tnum">
              <span className="absolute left-0">{sp.gauge.lo}</span>
              <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${sp.gauge.mark * 100}%` }}>{sp.gauge.markLabel}</span>
              <span className="absolute right-0">{sp.gauge.hi}</span>
            </div>
          </div>
        )}
        {"strip" in sp && sp.strip && (
          <div className="mt-3">
            <div className="flex gap-[3px]" role="img" aria-label={`Anos abaixo de 25%: ${sp.chart.marks.map((i) => years[i]).join(", ") || "nenhum"}`}>
              {years.map((y, i) => {
                const x = row.mde[i];
                const off = skipPand && PANDEMIC.includes(y);
                const bg = x == null ? "color-mix(in srgb, var(--m-ink) 10%, transparent)" : x < MDE_MIN && !off ? "var(--m-red)" : x < MDE_MIN ? "color-mix(in srgb, var(--m-red) 35%, transparent)" : "color-mix(in srgb, var(--m-blue) 70%, transparent)";
                return (
                  <button
                    key={y}
                    type="button"
                    title={`${y}: ${x == null ? "sem dado" : pct(x)}${off ? " (não contado: EC 119)" : ""}`}
                    aria-label={`${y}: ${x == null ? "sem dado" : pct(x)}${off ? ", não contado" : ""}`}
                    onClick={() => onYear(i)}
                    className={cn("h-5 flex-1 rounded-[3px] transition-opacity", i > yi && "opacity-30", i === yi && "ring-2 ring-(--m-ink) ring-offset-1 ring-offset-(--m-panel-solid)")}
                    style={{ background: bg }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[0.625rem] text-(--m-ink)/55 tnum">
              <span>{years[0]}</span>
              <span>{years[years.length - 1]}</span>
            </div>
          </div>
        )}

        <p className="mt-3 text-[0.8125rem] leading-snug text-(--m-ink)/75">{sp.sentence}</p>
        {sp.atip && (
          <p className="mt-2 rounded-lg border border-(--m-amber-fill)/30 bg-(--m-amber-fill)/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-(--m-amber)">
            {key === "mde" && isImplausible(row, yi) ? "Valor fisicamente improvável — possível erro de declaração." : "Valor fora do padrão do próprio município — confirme na fonte."}
          </p>
        )}

        <div className="mt-4 border-t border-(--m-ink)/8 pt-3">
          <div className="mb-2 flex items-center justify-between text-[0.75rem]">
            <span className="font-medium text-(--m-ink)/85">{sp.chartTitle}</span>
            {sp.chart.markLabel && <span className="flex items-center gap-1 text-(--m-ink)/60"><i className="size-1.5 rounded-full bg-(--m-red)" />{sp.chart.markLabel}</span>}
          </div>
          <LineChart
            years={years}
            yi={yi}
            onPick={onYear}
            height={110}
            refLine={sp.chart.ref ?? undefined}
            band={key === "mde" ? EC119 : undefined}
            refLabel={sp.chart.refLabel}
            series={[
              { values: sp.chart.values, color: "var(--m-blue)", label: sp.chart.label, fmt: key === "aluno" ? money : (x: number) => pct(x, key === "fun" ? 1 : 2), area: true },
              ...("base" in sp.chart && sp.chart.base ? [{ values: sp.chart.base, color: "color-mix(in srgb, var(--m-ink) 55%, transparent)", label: "Mediana BR", fmt: money, dashed: true }] : []),
            ]}
            marks={sp.chart.marks}
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-(--m-ink)/8 pt-3">
          {key !== "mde" && <Fact k="% em educação (mín. 25%)" v={mde != null ? pct(mde) : "—"} warn={mde != null && mde < MDE_MIN} />}
          {key !== "aluno" && <Fact k="Por aluno" v={aluno != null ? money(aluno) : "—"} sub={ALUNO_UNIT} />}
          {key !== "fun" && <Fact k={`Fundeb em pessoal (mín. ${funMin(year)}%)`} v={fun != null ? pct(fun, 1) : "—"} warn={fun != null && fun < funMin(year)} />}
          <Fact k={`Posição em ${row.uf}`} v={ranks ? `${int(ranks.uf.pos)}º` : "—"} sub={ranks ? `de ${int(ranks.uf.of)} · ${metricLabel}` : undefined} />
          <Fact k="Posição no Brasil" v={ranks ? `${int(ranks.br.pos)}º` : "—"} sub={ranks ? `de ${int(ranks.br.of)}` : undefined} />
          {ind !== "rec" && (
            <Fact k={`Anos abaixo de 25% até ${year}`} v={`${times} de ${row.mde.slice(0, yi + 1).filter((x) => x != null).length}`} warn={times > 0} sub={times ? sp.chart.marks.filter((i) => key !== "mde" || i <= yi).map((i) => years[i]).join(", ") : "nunca abaixo"} className="col-span-2" />
          )}
        </dl>
      </div>
      <div className="flex items-center gap-2 border-t border-(--m-ink)/8 p-3">
        <Link href={href} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-(--m-ink) text-[0.8125rem] font-medium text-(--m-bg) transition-colors hover:bg-(--m-ink)/90">
          Ficha completa
          <ArrowRight className="size-3.5" />
        </Link>
        <WatchButton id={`${row.uf.toLowerCase()}/${row.slug}`} className="h-9 rounded-lg border-(--m-line-2) bg-transparent px-3 text-[0.8125rem] text-(--m-ink) hover:bg-(--m-ink)/8" />
        <button
          type="button"
          className="m-ctl h-9! w-9!"
          aria-label="Copiar o link"
          title="Copiar o link"
          onClick={() => {
            navigator.clipboard?.writeText(location.href).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
        >
          {copied ? <span className="text-[0.6875rem] text-(--m-blue)">ok</span> : <Link2 className="size-4" />}
        </button>
      </div>
    </aside>
  );
}

const Fact = ({ k, v, sub, warn, className }: { k: string; v: string; sub?: string; warn?: boolean; className?: string }) => (
  <div className={className}>
    <dt className="text-[0.6875rem] text-(--m-ink)/60">{k}</dt>
    <dd className={cn("mt-0.5 text-[1.0625rem] font-medium tnum", warn ? "text-(--m-red)" : "text-(--m-ink)")}>
      {v}
      {sub && <span className="mt-0.5 block text-[0.6875rem] font-normal text-(--m-ink)/55">{sub}</span>}
    </dd>
  </div>
);
