"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Choropleth, { Legend } from "@/components/Choropleth";
import { Segmented } from "@/components/kit/segmented";
import { StatusDot, type StatusKind } from "@/components/kit/status";
import { BINS, METRICS, SHARE_BINS, colorOf, funBins, quintileBins, type MetricKey } from "@/lib/bins";
import { MDE_MIN, int, pct } from "@/lib/format";
import { UFS, cityPath, ufPath } from "@/lib/geo";
import { belowShare, shortfallLabel, type Row, type UfSummary } from "@/lib/rows";

type UfMetric = "share" | "median" | "gov";
const UF_METRICS: { key: UfMetric; label: string; short: string }[] = [
  { key: "share", label: "% de municípios abaixo de 25%", short: "% abaixo de 25%" },
  { key: "median", label: "MDE mediana dos municípios", short: "MDE mediana" },
  { key: "gov", label: "MDE do governo estadual", short: "Governo estadual" },
];
const MUN_SHORT: Record<MetricKey, string> = { mde: "MDE (%)", fun: "Fundeb pessoal", aluno: "R$ por aluno" };

type Props = {
  ufs: UfSummary[];
  years: number[];
  year: number;
  rows: Row[] | null;
  rowsError: boolean;
  defaultMode: "uf" | "mun";
  /** restrict to these UFs (region view) */
  ufCodes?: number[];
  ariaScope: string;
};

const Row = ({ k, v, className }: { k: string; v: ReactNode; className?: string }) => (
  <>
    <span className="text-muted-foreground">{k}</span>
    <span className={`text-right tnum ${className ?? ""}`}>{v}</span>
  </>
);

export default function TerritoryMap({ ufs, years, year, rows, rowsError, defaultMode, ufCodes, ariaScope }: Props) {
  const [mode, setMode] = useState<"uf" | "mun">(defaultMode);
  const [metric, setMetric] = useState<MetricKey>("mde");
  const [ufMetric, setUfMetric] = useState<UfMetric>("share");
  const yi = years.indexOf(year);
  // until the municipal rows arrive, keep drawing states
  const eff: "uf" | "mun" = mode === "mun" && rows ? "mun" : "uf";

  const byCode = useMemo(() => new Map(ufs.map((u) => [UFS.find((x) => x.uf === u.uf)!.code, u])), [ufs]);
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);

  const munBins = useMemo(() => {
    if (metric === "mde") return BINS;
    if (metric === "fun") return funBins(year);
    const scoped = ufCodes ? (rows ?? []).filter((r) => ufCodes.includes(Math.floor(r.id / 100000))) : rows ?? [];
    return quintileBins(scoped.map((r) => r.aluno[yi]).filter((v): v is number => v != null));
  }, [metric, year, rows, yi, ufCodes]);

  const ufVal = useCallback(
    (u: UfSummary | undefined) => {
      if (!u) return null;
      const s = u.stats[yi];
      return ufMetric === "share" ? belowShare(s) : ufMetric === "median" ? s.median : u.gov[yi];
    },
    [ufMetric, yi],
  );
  const ufBins = ufMetric === "share" ? SHARE_BINS : BINS;

  const munVal = useCallback((r: Row | undefined) => (r ? r[metric][yi] : null), [metric, yi]);

  const fill = useCallback(
    (id: number) => (eff === "uf" ? colorOf(ufBins, ufVal(byCode.get(id))) : colorOf(munBins, munVal(byId.get(id)))),
    [eff, ufBins, ufVal, byCode, munBins, munVal, byId],
  );
  const hatched = useCallback(
    (id: number) => eff === "mun" && metric === "mde" && !!byId.get(id)?.nd[yi],
    [eff, metric, byId, yi],
  );

  const tooltip = (id: number) => {
    if (eff === "uf") {
      const u = byCode.get(id);
      if (!u) return null;
      const s = u.stats[yi];
      const sh = belowShare(s);
      const kind: StatusKind = sh == null ? "nd" : s.below === 0 ? "ok" : "below";
      return (
        <>
          <div className="flex items-center gap-2 font-semibold">
            <StatusDot kind={kind} />
            <span className="truncate">{u.name}</span>
            <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground">{u.uf}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs">
            <Row k="Abaixo de 25%" v={`${s.below} de ${s.reported}`} className={s.below ? "font-medium text-critical" : ""} />
            <Row k="Faltou" v={s.below ? shortfallLabel(s).value : "—"} />
            <Row k="MDE mediana" v={pct(s.median)} />
            <Row k="Governo estadual" v={pct(u.gov[yi])} className={u.gov[yi] != null && u.gov[yi]! < MDE_MIN ? "text-critical" : ""} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Clique para abrir o estado</div>
        </>
      );
    }
    const r = byId.get(id);
    if (!r) return <div className="text-muted-foreground">Sem dados</div>;
    const v = r[metric][yi];
    const m = METRICS.find((x) => x.key === metric)!;
    const nd = r.nd[yi] && metric === "mde";
    const kind: StatusKind | null =
      metric !== "mde" ? null : nd ? "below" : v == null ? "nd" : v < MDE_MIN ? "below" : v < 26 ? "edge" : "ok";
    return (
      <>
        <div className="flex items-center gap-2">
          {kind && <StatusDot kind={kind} />}
          <span className="truncate font-semibold">{r.name}</span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">{r.uf}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <span className="text-xs text-muted-foreground">{m.short}</span>
          <span className="text-[15px] font-semibold tnum">
            {nd ? <span className="text-critical">Não declarou</span> : v == null ? <span className="text-muted-foreground">Sem dados</span> : m.fmt(v)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground tnum">{int(r.pop)} hab.</div>
      </>
    );
  };

  const href = useCallback(
    (id: number) => {
      if (eff === "uf") {
        const u = byCode.get(id);
        return u ? ufPath(u.uf) : null;
      }
      const r = byId.get(id);
      return r ? cityPath(r.uf, r.slug) : null;
    },
    [eff, byCode, byId],
  );

  const showMun = mode === "mun";
  const loading = showMun && !rows;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Nível do mapa"
          value={mode}
          onChange={setMode}
          options={[
            { value: "uf", label: "Estados" },
            { value: "mun", label: "Municípios" },
          ]}
        />
        {showMun ? (
          <Segmented ariaLabel="Indicador do mapa" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.key, label: MUN_SHORT[m.key], title: m.label }))} />
        ) : (
          <Segmented ariaLabel="Indicador do mapa" value={ufMetric} onChange={setUfMetric} options={UF_METRICS.map((m) => ({ value: m.key, label: m.short, title: m.label }))} />
        )}
        {loading && (
          <span className="text-xs text-muted-foreground" role="status">
            {rowsError ? "Falha ao carregar os municípios." : "Carregando 5.570 municípios…"}
          </span>
        )}
      </div>
      <Choropleth
        src="br"
        layer={eff}
        ufCodes={ufCodes}
        fill={fill}
        hatched={hatched}
        tooltip={tooltip}
        href={href}
        ufBorders={showMun}
        ariaLabel={`Mapa ${ariaScope} por ${showMun ? "município" : "estado"}, ${year}`}
        height={ufCodes ? 520 : 600}
      />
      {showMun ? (
        <Legend title={METRICS.find((m) => m.key === metric)!.label} bins={munBins} nd={metric === "mde"} />
      ) : (
        <Legend title={UF_METRICS.find((m) => m.key === ufMetric)!.label} bins={ufBins} nd={false} />
      )}
    </div>
  );
}
