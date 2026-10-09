"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MDE_MIN, funMin, int, pct } from "@/lib/format";
import { UFS, cityPath } from "@/lib/geo";
import { alignRows, isAtip, loadAllRows, type Row, type Stats, type UfSummary } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { loadBrGeo, type BrGeo } from "./geo";
import { LeftPanel, Drawer, Legend, SubBar, TopBar } from "./Panels";
import Stage, { type CityLabel, type Insets, type Ping, type UfTag } from "./Stage";
import Timeline from "./Timeline";
import { INDS, alunoReal, isBad, legendCounts, makeLayer, ufCode, ufName, ufSigla, type Ind, type Level, type Scope, type UfVar } from "./model";
import { Num, useIsDesktop } from "./ui";
import "./mapa.css";

type Props = { years: number[]; initialYear: number; brStats: Stats[]; ufs: UfSummary[] };

const IND_KEYS = INDS.map((i) => i.key);
/** ms per year while playing: the fills crossfade in --m-step (0.6 s), then the year holds long enough to read */
const BEAT = 1500;

type UrlState = { ind: Ind; level: Level; ufVar: UfVar; year: number | null; scope: Scope; skipPand: boolean };

function readUrl(): UrlState {
  const q = new URLSearchParams(location.search);
  const i = q.get("i") as Ind | null;
  const hash = location.hash.slice(1).toLowerCase();
  const [u, c] = hash.split("-");
  const uf = UFS.find((x) => x.uf.toLowerCase() === u)?.uf ?? null;
  const city = uf && c && /^\d{7}$/.test(c) ? Number(c) : null;
  const y = Number(q.get("ano"));
  return {
    ind: i && IND_KEYS.includes(i) ? i : "mde",
    level: q.get("nivel") === "estados" ? "uf" : "mun",
    ufVar: (["share", "median", "gov"] as const).find((v) => v === q.get("medida")) ?? "share",
    year: y > 1990 ? y : null,
    scope: { uf, city },
    skipPand: q.get("pandemia") === "0",
  };
}

function writeUrl(s: UrlState & { year: number }, defaults: { year: number }, push: boolean) {
  const q = new URLSearchParams();
  if (s.ind !== "mde") q.set("i", s.ind);
  if (s.level === "uf") q.set("nivel", "estados");
  if (s.ufVar !== "share" && s.ind === "mde" && s.level === "uf" && !s.scope.uf) q.set("medida", s.ufVar);
  if (s.year !== defaults.year) q.set("ano", String(s.year));
  if (s.ind === "rec" && s.skipPand) q.set("pandemia", "0");
  const hash = s.scope.uf ? `#${s.scope.uf.toLowerCase()}${s.scope.city ? `-${s.scope.city}` : ""}` : "";
  const url = `${location.pathname}${q.size ? `?${q}` : ""}${hash}`;
  if (url === `${location.pathname}${location.search}${location.hash}`) return;
  history[push ? "pushState" : "replaceState"](null, "", url);
}

export default function MapaApp({ years, initialYear, brStats, ufs }: Props) {
  const desktop = useIsDesktop();
  const [ind, setInd] = useState<Ind>("mde");
  const [level, setLevel] = useState<Level>("mun");
  const [ufVar, setUfVar] = useState<UfVar>("share");
  const [skipPand, setSkipPand] = useState(false);
  const [year, setYear] = useState(initialYear);
  const [scope, setScope] = useState<Scope>({ uf: null, city: null });
  const [geo, setGeo] = useState<BrGeo | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovBin, setHovBin] = useState<string | null>(null);
  const [pinBin, setPinBin] = useState<string | null>(null);
  const [drawerTall, setDrawerTall] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [ready, setReady] = useState(false);
  const lastScope = useRef("");
  const fromPop = useRef(false);
  const yi = Math.max(0, years.indexOf(year));

  // ---------- data
  useEffect(() => {
    loadBrGeo().then(setGeo, () => setFailed(true));
    loadAllRows().then(
      (f) => setRows(alignRows(f, years)),
      () => setFailed(true),
    );
  }, [years]);

  // ---------- URL <-> state
  useEffect(() => {
    const apply = (u: UrlState) => {
      setInd(u.ind);
      setLevel(u.level);
      setUfVar(u.ufVar);
      setSkipPand(u.skipPand);
      if (u.year != null && years.includes(u.year)) setYear(u.year);
      else setYear(initialYear);
      setScope(u.scope);
    };
    // the URL is an external system: state is initialised from it once, and again on back/forward
    const u = readUrl();
    apply(u);
    lastScope.current = `${u.scope.uf ?? ""}/${u.scope.city ?? ""}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    const onPop = () => {
      fromPop.current = true;
      apply(readUrl());
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, [years, initialYear]);

  useEffect(() => {
    if (!ready) return;
    const key = `${scope.uf ?? ""}/${scope.city ?? ""}`;
    const push = key !== lastScope.current && !fromPop.current;
    lastScope.current = key;
    fromPop.current = false;
    writeUrl({ ind, level, ufVar, year, scope, skipPand }, { year: initialYear }, push);
  }, [ready, ind, level, ufVar, year, scope, skipPand, initialYear]);

  // ---------- derived data
  const byId = useMemo(() => (rows ? new Map(rows.map((r) => [r.id, r])) : null), [rows]);
  const munShape = useMemo(() => new Map(geo?.mun.map((s) => [s.id, s]) ?? []), [geo]);
  const ufByCode = useMemo(() => new Map(ufs.map((u) => [ufCode(u.uf), u])), [ufs]);
  const effLevel: Level = scope.uf ? (rows ? "mun" : "uf") : level === "mun" && !rows ? "uf" : level;
  const loading = !failed && !rows && (level === "mun" || !!scope.uf);

  const layer = useMemo(() => makeLayer({ ind, level: effLevel, ufVar, year, yi, rows, byId, ufs, years, skipPandemic: skipPand }), [ind, effLevel, ufVar, year, yi, rows, byId, ufs, years, skipPand]);
  const ufLayer = useMemo(() => makeLayer({ ind, level: "uf", ufVar, year, yi, rows, byId, ufs, years, skipPandemic: skipPand }), [ind, ufVar, year, yi, rows, byId, ufs, years, skipPand]);

  const inScope = useMemo(() => (rows ? (scope.uf ? rows.filter((r) => r.uf === scope.uf) : rows).filter((r) => r.since == null || year >= r.since) : null), [rows, scope.uf, year]);

  // a pinned legend class survives year changes but not a change of scale (indicator/level)
  const binKeys = layer.bins.map((b) => b.key).join();
  const pinned = pinBin && binKeys.split(",").includes(pinBin) ? pinBin : null;
  const hotBin = hovBin ?? pinned;

  const legend = useMemo(() => {
    const ids = effLevel === "mun" ? (inScope ?? []).map((r) => r.id) : ufs.map((u) => ufCode(u.uf));
    const { counts, nd } = legendCounts(layer, ids);
    const undeclared = effLevel === "mun" ? ids.filter((id) => !layer.binOf(id) && layer.notDeclared(id)).length : 0;
    return { counts, nd: nd - undeclared, undeclared, total: ids.length };
  }, [layer, inScope, effLevel, ufs]);

  const pings = useMemo<Ping[]>(() => {
    if (!inScope || !geo || effLevel !== "mun" || (ind !== "mde" && ind !== "fun")) return [];
    // every municipality below the minimum gets a marker (the redundant cue to colour); in crisis years (2020–21:
    // over 1,000) only the 30 lowest pulse and the rest are still dots, so the map stays readable. While the years
    // play nothing pulses: markers just appear and fade with the fills, and the pulse comes back on the year it stops.
    const key = ind === "fun" ? "fun" : "mde";
    const bad = inScope.filter((r) => isBad(ind, r, yi, year)).sort((a, b) => a[key][yi]! - b[key][yi]!);
    const calm = bad.length > 60;
    return bad.flatMap((r, i) => {
      const s = munShape.get(r.id);
      return s ? [{ id: r.id, cx: s.cx, cy: s.cy, still: playing || (calm && i >= 30), epoch: year, i: Math.min(i, 30) }] : [];
    });
  }, [inScope, geo, effLevel, ind, yi, year, munShape, playing]);

  const cityLabels = useMemo<CityLabel[]>(() => {
    if (!scope.uf || !inScope) return [];
    const pick = [...inScope].sort((a, b) => b.pop - a.pop).slice(0, 14);
    const cap = inScope.find((r) => r.capital);
    if (cap && !pick.includes(cap)) pick.push(cap);
    if (scope.city) {
      const sel = byId?.get(scope.city);
      if (sel && !pick.includes(sel)) pick.push(sel);
    }
    return pick.sort((a, b) => b.pop - a.pop).flatMap((r) => {
      const s = munShape.get(r.id);
      return s ? [{ id: r.id, name: r.name, cx: s.cx, cy: s.cy, pop: r.pop }] : [];
    });
  }, [scope.uf, scope.city, inScope, byId, munShape]);

  const ufTag = useCallback(
    (code: number): UfTag => {
      const u = ufByCode.get(code);
      if (!u) return { text: "", color: null };
      const bin = ufLayer.binOf(code);
      const color = bin?.color ?? null;
      if (effLevel === "uf") {
        const v = ufLayer.valueOf(code);
        const sm = u.stats[yi];
        // small denominators: "4/22" next to the share so a state with few municipalities isn't over-read
        const frac = ind === "mde" && ufVar === "share" ? ` · ${sm.below}/${sm.reported}` : ind === "fun" ? ` · ${sm.funBelow}/${sm.funReported}` : "";
        return { text: v == null ? "" : `${ufLayer.fmt(v)}${frac}`, color, strong: !!bin && /^(s4|s5|q3|q4|b1|b5|m5)$/.test(bin.key) };
      }
      const s = u.stats[yi];
      const am = alunoReal(s.alunoMedian, year);
      const text = ind === "mde" ? (s.below ? `${s.below} abaixo` : "") : ind === "fun" ? (s.funBelow ? `${s.funBelow} abaixo` : "") : ind === "aluno" && am ? `R$ ${(am / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : "";
      return { text, color, strong: !!bin && /^(s4|s5)$/.test(bin.key) };
    },
    [ufByCode, ufLayer, effLevel, yi, ind, ufVar, year],
  );

  // ---------- actions
  const goScope = useCallback((s: Scope) => {
    setScope(s);
    if (!s.uf) setSheet(false);
  }, []);
  const pickUf = useCallback((uf: string | null) => goScope({ uf, city: null }), [goScope]);
  const pickCity = useCallback(
    (id: number | null) => setScope((s) => ({ uf: s.uf, city: id })),
    [],
  );
  const pickCityIn = useCallback((uf: string, id: number) => {
    setScope({ uf, city: id });
    setSheet(false);
  }, []);
  const setYearI = useCallback((i: number) => setYear(years[Math.max(0, Math.min(years.length - 1, i))]), [years]);

  // play: one year per BEAT, stops on the latest. Each step is a transition, so React renders the panels in slices and
  // the map's crossfade keeps its frames; the timer restarts from each committed year (in step with the beat ring).
  useEffect(() => {
    if (!playing || yi >= years.length - 1) return;
    const t = setTimeout(() => {
      startTransition(() => {
        setYear(years[yi + 1]);
        if (yi + 1 >= years.length - 1) setPlaying(false);
      });
    }, BEAT);
    return () => clearTimeout(t);
  }, [playing, yi, years]);
  const togglePlay = () => {
    if (!playing && year === years[years.length - 1]) setYear(years[0]);
    setPlaying((p) => !p);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (scope.city) {
        setScope({ uf: scope.uf, city: null });
        if (document.activeElement?.closest("aside")) requestAnimationFrame(() => document.querySelector<HTMLElement>(".mapa-stage")?.focus({ preventScroll: true }));
      }
      else if (scope.uf) setScope({ uf: null, city: null });
      else if (playing) setPlaying(false);
      else if (pinBin) setPinBin(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scope, playing, pinBin]);

  // search palette (⌘K) results fly the map instead of leaving the page
  useEffect(() => {
    const onNav = (e: Event) => {
      const href = (e as CustomEvent<{ href: string }>).detail.href;
      const seg = href.split("?")[0].split("/").filter(Boolean);
      if (seg.length === 1 && seg[0] !== "regiao") {
        const uf = UFS.find((u) => u.uf.toLowerCase() === seg[0])?.uf;
        if (uf) {
          e.preventDefault();
          goScope({ uf, city: null });
        }
      } else if (seg.length === 2 && seg[0] !== "regiao" && rows) {
        const r = rows.find((x) => x.uf.toLowerCase() === seg[0] && x.slug === seg[1]);
        if (r) {
          e.preventDefault();
          pickCityIn(r.uf, r.id);
        }
      }
    };
    window.addEventListener("radar:navigate", onNav);
    return () => window.removeEventListener("radar:navigate", onNav);
  }, [rows, goScope, pickCityIn]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const share = () => {
    navigator.clipboard?.writeText(location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  // ---------- tooltip
  const tooltip = useCallback(
    ({ id, uf, level: lv }: { id: number; uf: number; level: Level }) => {
      const dot = (c: string | null | undefined) => <span className="size-2 shrink-0 rounded-full" style={{ background: c ?? "var(--m-faint)" }} />;
      const Line = ({ k, v, red }: { k: string; v: React.ReactNode; red?: boolean }) => (
        <div className="flex justify-between gap-3 py-px text-[0.75rem]">
          <span className="text-(--m-ink)/55">{k}</span>
          <span className={cn("text-right tnum text-(--m-ink)/90", red && "text-(--m-red)")}>{v}</span>
        </div>
      );
      const showUf = lv === "uf" || !scope.uf || ufSigla(uf) !== scope.uf;
      if (showUf) {
        const u = ufByCode.get(uf);
        if (!u) return null;
        const s = u.stats[yi];
        const v = ufLayer.valueOf(uf);
        const sub = lv === "mun" ? byId?.get(id) : null;
        return (
          <>
            <div className="flex items-center gap-2 font-semibold text-(--m-ink)">
              {dot(ufLayer.binOf(uf)?.color)}
              <span className="truncate">{u.name}</span>
              <span className="ml-auto font-mono text-[0.6875rem] font-normal text-(--m-ink)/45">{u.uf}</span>
            </div>
            <div className="mt-2">
              {ind === "mde" && (
                <>
                  <Line k="Abaixo de 25%" v={`${int(s.below)} de ${int(s.reported)}`} red={s.below > 0} />
                  <Line k="MDE mediana" v={pct(s.median)} />
                  <Line k="Governo estadual" v={pct(u.gov[yi])} red={u.gov[yi] != null && u.gov[yi]! < MDE_MIN} />
                </>
              )}
              {ind === "fun" && (
                <>
                  <Line k={`Abaixo de ${funMin(year)}%`} v={`${int(s.funBelow)} de ${int(s.funReported)}`} red={s.funBelow > 0} />
                  <Line k="Mediana" v={pct(s.funMedian)} />
                </>
              )}
              {ind === "aluno" && <Line k="Mediana por aluno" v={v != null ? ufLayer.fmt(v) : "—"} />}
              {ind === "rec" && <Line k="3+ anos abaixo de 25%" v={v == null ? "…" : `${pct(v, 0)} dos municípios`} />}
            </div>
            {sub && (
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-(--m-ink)/10 pt-2 text-[0.75rem]">
                <span className="truncate text-(--m-ink)/70">{sub.name}</span>
                <span className="tnum font-medium text-(--m-ink)">{layer.valueOf(id) != null ? layer.fmt(layer.valueOf(id)!) : layer.notDeclared(id) ? "Não declarou" : "—"}</span>
              </div>
            )}
            <div className="mt-2 text-[0.6875rem] text-(--m-ink)/40">Clique para aproximar</div>
          </>
        );
      }
      const r = byId?.get(id);
      if (!r) return <div className="text-(--m-ink)/60">Sem dados</div>;
      const v = layer.valueOf(id);
      const b = layer.binOf(id);
      const pv = yi > 0 && (ind === "mde" || ind === "fun") ? r[ind][yi - 1] : null;
      return (
        <>
          <div className="flex items-center gap-2 font-semibold text-(--m-ink)">
            {dot(b?.color)}
            <span className="truncate">{r.name}</span>
            <span className="ml-auto font-mono text-[0.6875rem] font-normal text-(--m-ink)/45">{r.uf}</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[0.75rem] text-(--m-ink)/55">{INDS.find((i) => i.key === ind)!.unit}</span>
            <span className="font-display text-[1.375rem] leading-none tnum text-(--m-ink)">
              {v != null ? layer.fmt(v) : layer.notDeclared(id) ? <span className="text-(--m-red) text-base">Não declarou</span> : <span className="text-base text-(--m-ink)/50">{r.since != null && year < r.since ? "Não existia" : "Sem dados"}</span>}
            </span>
          </div>
          {b && (
            <div className="mt-1 flex items-center justify-between gap-3 text-[0.6875rem] text-(--m-ink)/65 tnum">
              <span>Classe {b.label}{ind === "mde" && b.key === "b3" ? " · no limite" : ""}</span>
              {v != null && pv != null && <span>{v - pv >= 0 ? "▲" : "▼"} {pct(Math.abs(v - pv), 2).replace("%", "")} p.p. vs {years[yi - 1]}</span>}
            </div>
          )}
          {ind !== "mde" && r.mde[yi] != null && <Line k="% em educação" v={pct(r.mde[yi])} red={r.mde[yi]! < MDE_MIN} />}
          {isAtip(r, yi, ind === "aluno" ? "aluno" : "mde") && ind !== "fun" && ind !== "rec" && <div className="mt-1 text-[0.6875rem] text-(--m-amber)">Valor fora do padrão: confirme na fonte</div>}
          <div className="mt-1 text-[0.6875rem] text-(--m-ink)/45 tnum">{int(r.pop)} hab. · clique para detalhar</div>
        </>
      );
    },
    [scope.uf, ufByCode, yi, year, years, ufLayer, byId, layer, ind],
  );

  // ---------- insight pill
  const insight = useMemo(() => {
    if (!inScope || scope.city || effLevel === "uf" || (ind !== "mde" && ind !== "fun")) return null;
    const key = ind === "mde" ? "mde" : "fun";
    const ok = inScope.filter((r) => r[key][yi] != null && !isAtip(r, yi, key === "mde" ? "mde" : undefined));
    if (!ok.length) return null;
    const worst = ok.reduce((a, b) => (b[key][yi]! < a[key][yi]! ? b : a));
    const n = inScope.filter((r) => isBad(ind, r, yi, year)).length;
    const min = key === "mde" ? "25%" : `${funMin(year)}%`;
    const name = (
      <>
        <b className="font-medium text-(--m-ink)">{worst.name}</b>
        {!scope.uf ? ` (${worst.uf})` : ""}, {pct(worst[key][yi])}
      </>
    );
    return {
      text: n ? (
        <>
          <b className="font-medium text-(--m-ink)"><Num value={n} fmt={(v) => int(Math.round(v))} /></b> {n === 1 ? "município abaixo" : "municípios abaixo"} de {min} em {year}. Menor percentual (sem valores atípicos): {name}
        </>
      ) : (
        <>
          Nenhum município abaixo de {min} em {year}. Mais perto do limite: {name}
        </>
      ),
      go: () => pickCityIn(worst.uf, worst.id),
    };
  }, [inScope, scope.city, scope.uf, effLevel, ind, yi, year, pickCityIn]);

  // ---------- layout
  const cityRow = scope.city ? byId?.get(scope.city) : undefined;
  // ‹ › in the drawer walk the state's ranking for the active indicator (same order as "Posição em UF")
  const cityNav = useMemo(() => {
    if (!cityRow || !rows) return null;
    const k = ind === "fun" ? "fun" : ind === "aluno" ? "aluno" : "mde";
    const list = rows.filter((r) => r.uf === cityRow.uf && r[k][yi] != null).sort((a, b) => b[k][yi]! - a[k][yi]! || b.pop - a.pop);
    const i = list.findIndex((r) => r.id === cityRow.id);
    if (i < 0) return null;
    return { pos: i + 1, of: list.length, prev: i > 0 ? list[i - 1].id : null, next: i < list.length - 1 ? list[i + 1].id : null };
  }, [cityRow, rows, ind, yi]);
  const drawerOpen = !!(scope.city && cityRow && rows);
  const L = 404, R = 16, DR = 376;
  const insets: Insets = desktop
    ? { left: L, right: drawerOpen ? R + DR : R, top: 112, bottom: 96 }
    : { left: 0, right: 0, top: 176, bottom: drawerOpen ? Math.round((typeof window === "undefined" ? 800 : window.innerHeight) * 0.46) + 112 : 132 };
  const latest = year === years[years.length - 1];
  const coverage = `${int(brStats[yi].reported)} de ${int(brStats[yi].n)} declararam`;
  const scopeLabel = scope.uf ? ufName(scope.uf) : "Brasil";

  useEffect(() => {
    document.title = `${scopeLabel} · ${INDS.find((i) => i.key === ind)!.label} ${year} · Radar MDE`;
  }, [scopeLabel, ind, year]);

  const indMeta = INDS.find((i) => i.key === ind)!;
  const liveText = (() => {
    if (scope.city && cityRow) return `${cityRow.name}, ${year}: ${indMeta.unit} ${layer.valueOf(cityRow.id) != null ? layer.fmt(layer.valueOf(cityRow.id)!) : "sem dados"}.`;
    const st = (scope.uf ? ufByCode.get(ufCode(scope.uf))!.stats : brStats)[yi];
    if (ind === "mde") return `${scopeLabel}, ${year}: ${int(st.below)} de ${int(st.reported)} municípios abaixo de 25%.`;
    if (ind === "fun") return `${scopeLabel}, ${year}: ${int(st.funBelow)} de ${int(st.funReported)} municípios abaixo do mínimo do Fundeb.`;
    if (ind === "aluno") return `${scopeLabel}, ${year}: mediana de ${st.alunoMedian ? `R$ ${int(Math.round(st.alunoMedian))}` : "—"} por aluno.`;
    return `${scopeLabel}: anos abaixo de 25% de ${years[0]} a ${year}.`;
  })();
  const closeDrawer = () => {
    pickCity(null);
    setDrawerTall(false);
    // focus would otherwise fall to <body> when the drawer unmounts
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".mapa-stage")?.focus({ preventScroll: true }));
  };
  const smallUfs = ufs.filter((u) => u.stats[yi].reported > 0 && u.stats[yi].reported < 34).map((u) => u.uf);
  const legendNote =
    effLevel === "uf" && (ind === "fun" || ind === "rec" || (ind === "mde" && ufVar === "share")) && smallUfs.length
      ? `${smallUfs.join(", ")}: menos de 34 municípios, cada um pesa mais de 3 p.p.`
      : undefined;
  // where municipalities bunch up just above the line ("aplica o mínimo e nada além")
  const hist = useMemo(() => {
    if (ind !== "mde" || effLevel !== "mun" || !inScope) return undefined;
    const lo = 22, step = 0.25, n = 32;
    const counts = new Array<number>(n).fill(0);
    let at = 0;
    for (const r of inScope) {
      const v = r.mde[yi];
      if (v == null) continue;
      if (v >= 25 && v < 25.5) at++;
      const i = Math.floor((v - lo) / step);
      if (i >= 0 && i < n) counts[i]++;
    }
    return {
      counts, lo, step, ref: MDE_MIN,
      caption: <><b className="font-medium text-(--m-ink)">{int(at)}</b> aplicaram entre 25,0% e 25,5%: no mínimo e quase nada além.</>,
    };
  }, [ind, effLevel, inScope, yi]);

  // DOM order is the keyboard order: controls and summary first, then the map, then the timeline and details
  return (
    <div className="mapa-shell fixed inset-0 z-50 overflow-hidden font-sans">
      <h1 className="sr-only">Mapa de educação nos municípios brasileiros</h1>
      <TopBar ind={ind} onInd={setInd} fullscreen={fullscreen} onFullscreen={toggleFullscreen} onShare={share} copied={copied} />
      <SubBar
        scope={scope}
        cityName={cityRow?.name ?? null}
        onScope={goScope}
        level={level}
        onLevel={setLevel}
        ufVar={ufVar}
        onUfVar={setUfVar}
        ind={ind}
        skipPand={skipPand}
        onSkipPand={setSkipPand}
        left={desktop ? insets.left : 16}
      />

      {/* left column (desktop) / sheet (mobile) */}
      <div
        className={cn(
          "absolute z-20 flex min-h-0 flex-col",
          desktop ? "top-[68px] bottom-4 left-4 w-[372px]" : "inset-x-3 bottom-[188px] max-h-[50vh] transition-[translate,visibility] duration-300",
          !desktop && (sheet && !drawerOpen ? "visible translate-y-0" : "pointer-events-none invisible translate-y-[calc(100%+200px)]"),
        )}
        inert={!desktop && !(sheet && !drawerOpen) ? true : undefined}
      >
        <LeftPanel ind={ind} scope={scope} year={year} yi={yi} years={years} brStats={brStats} ufs={ufs} rows={rows} rowsLoading={!rows && !failed} onCity={pickCityIn} onYear={setYearI} skipPand={skipPand} insight={insight} />
      </div>

      <Stage
        geo={geo}
        layer={layer}
        level={effLevel}
        scope={scope}
        insets={insets}
        hotBin={hotBin}
        pings={pings}
        cityLabels={cityLabels}
        ufTag={ufTag}
        loading={loading || (!geo && !failed)}
        onPickUf={pickUf}
        onPickCity={pickCity}
        tooltip={tooltip}
      />
      {failed && (
        <div className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--m-ink)/10 bg-(--m-bg)/70 px-4 py-3 text-sm text-(--m-ink)/80" role="alert">
          Não foi possível carregar os dados do mapa. Recarregue a página.
        </div>
      )}

      {(desktop || !drawerOpen) && (
        <Legend
          layer={layer}
          counts={legend.counts}
          nd={legend.nd}
          undeclared={legend.undeclared}
          total={legend.total}
          hot={hotBin}
          onHot={setHovBin}
          pinned={pinned}
          onPin={setPinBin}
          left={insets.left}
          compact={desktop && drawerOpen}
          mobile={!desktop}
          scopeLabel={scopeLabel}
          note={legendNote}
          hist={hist}
        />
      )}

      {!desktop && !drawerOpen && (
        <button type="button" data-ui className="m-panel absolute right-3 bottom-[136px] z-30 h-10 rounded-full px-4 text-[0.8125rem] font-medium text-(--m-ink)" aria-expanded={sheet} onClick={() => setSheet((s) => !s)}>
          {sheet ? "Fechar painel" : "Ver dados"}
        </button>
      )}

      {desktop && !scope.uf && geo && (
        <p className="m-hint absolute top-[108px] z-10 -translate-x-1/2 rounded-full bg-(--m-bg)/60 px-3 py-1 text-[0.75rem] text-(--m-ink)/70" style={{ left: `calc(${insets.left}px + (100% - ${insets.left + R}px) / 2)` }}>
          Clique em um estado para aproximar · arraste para mover · role para o zoom
        </p>
      )}

      <Timeline
        years={years}
        yi={yi}
        onPick={(i) => {
          setPlaying(false);
          setYearI(i);
        }}
        playing={playing}
        beat={BEAT}
        onToggle={togglePlay}
        coverage={ind === "rec" ? `acumulado desde ${years[0]}` : coverage}
        band={ind === "mde" || ind === "rec" ? { from: 2020, to: 2021, label: "2020–21: anos da pandemia (EC 119/2022)" } : undefined}
        latest={latest}
        className="absolute z-30"
        style={desktop ? { left: insets.left, right: R, bottom: 16 } : { left: 12, right: 12, bottom: 12 }}
      />

      {drawerOpen && cityRow && rows && (
        <div className={cn("absolute z-30 flex min-h-0 flex-col", desktop ? "top-[64px] right-4 bottom-[96px] w-[360px]" : cn("inset-x-3 bottom-[84px] transition-[max-height] duration-300", drawerTall ? "max-h-[82vh]" : "max-h-[46vh]"))}>
          <Drawer
            key={cityRow.id}
            ind={ind}
            row={cityRow}
            rows={rows}
            year={year}
            yi={yi}
            years={years}
            brStats={brStats}
            onClose={closeDrawer}
            onYear={setYearI}
            mobile={!desktop}
            tall={drawerTall}
            onTall={() => setDrawerTall((t) => !t)}
            skipPand={skipPand}
            nav={cityNav}
            onCity={pickCity}
            onState={() => goScope({ uf: cityRow.uf, city: null })}
          />
        </div>
      )}

      {/* one announcement when the years start playing (not one per beat), then the year it stopped on */}
      <p className="sr-only" role="status" aria-live="polite">
        {playing ? "Reproduzindo a evolução ano a ano." : liveText}
      </p>
      <noscript>
        <a href={scope.city && cityRow ? cityPath(cityRow.uf, cityRow.slug) : "/"}>Abrir o painel</a>
      </noscript>
    </div>
  );
}
