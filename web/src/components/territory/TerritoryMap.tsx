"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useUrlParam } from "./useUrlParam";

import Choropleth, { Legend, prewarmMap } from "@/components/Choropleth";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { StatusDot, type StatusKind } from "@/components/kit/status";
import { withYear } from "@/components/YearPicker";
import { ChartActions, type ChartLegendItem } from "@/components/kit/chart-actions";
import { NO_DATA_COLOR } from "@/lib/bins";
import { BINS, METRICS, SHARE_BINS, colorOf, funBins, isBelowBin, quintileBins, type Bin, type MetricKey } from "@/lib/bins";
import { MDE_MIN, int, pct } from "@/lib/format";
import { UFS, cityPath, ufPath } from "@/lib/geo";
import { atipNote, belowShare, isAtip, isImplausible, shortfallLabel, type Row, type UfSummary } from "@/lib/rows";

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
  /** the page's default year: links only carry `?ano=` when another year is selected */
  initialYear: number;
  rows: Row[] | null;
  rowsError: boolean;
  /** asks the dashboard to fetch municipal rows (only the municipal layer needs them) */
  onNeedRows: () => void;
  defaultMode: "uf" | "mun";
  /** id of the table with the same per-state numbers (keyboard / screen-reader alternative) */
  tableId?: string;
  /** link to the same municipalities as a table */
  explorerHref: string;
  /** "Brasil" / "Região Sul", for export titles */
  scopeLabel: string;
  /** file-name scope, e.g. "brasil" */
  fileScope: string;
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

const belowKeys = (b: Bin) => /^(b1|b2|f1|f2)$/.test(b.key);

export default function TerritoryMap({ ufs, years, year, initialYear, rows, rowsError, onNeedRows, defaultMode, ufCodes, ariaScope, tableId, explorerHref, scopeLabel, fileScope }: Props) {
  // JOR-26: map level and metric live in the URL (?mapa=estados|municipios, ?indicador=…)
  const [mode, setModeState] = useUrlParam<"uf" | "mun">("mapa", { uf: "estados", mun: "municipios" }, defaultMode);
  const setMode = (m: "uf" | "mun") => {
    if (m === "mun") onNeedRows();
    setModeState(m);
  };
  useEffect(() => {
    if (mode === "mun") onNeedRows();
  }, [mode, onNeedRows]);
  const [metric, setMetric] = useUrlParam<MetricKey>("indicador", { mde: "mde", fun: "fundeb", aluno: "aluno" }, "mde");
  const [ufMetric, setUfMetric] = useUrlParam<UfMetric>("estados", { share: "abaixo", median: "mediana", gov: "governo" }, "share");
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
  // below the legal minimum gets an outline, so it doesn't depend on telling two reds apart
  const outlined = useCallback(
    (id: number) =>
      eff === "mun" ? metric !== "aluno" && isBelowBin(munBins, munVal(byId.get(id))) : ufMetric !== "share" && isBelowBin(BINS, ufVal(byCode.get(id))),
    [eff, metric, munBins, munVal, byId, ufMetric, ufVal, byCode],
  );
  const label = useCallback(
    (id: number) => {
      const u = byCode.get(id);
      if (!u) return "";
      const s = u.stats[yi];
      return `${u.name}: ${s.below} de ${s.reported} municípios abaixo de 25% em ${year}; MDE mediana ${pct(s.median)}`;
    },
    [byCode, yi, year],
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
          <div className="flex items-center gap-2 font-medium">
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
          {s.nd > 0 && <div className="mt-1 text-xs text-muted-foreground tnum">{s.nd} não declararam</div>}
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
          <span className="truncate font-medium">{r.name}</span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">{r.uf}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <span className="text-xs text-muted-foreground">{m.short}</span>
          <span className="text-[15px] font-medium tnum">
            {nd ? <span className="text-critical">Não declarou</span> : v == null ? <span className="text-muted-foreground">{r.since != null && year < r.since ? "Não existia" : "Sem dados"}</span> : m.fmt(v)}
          </span>
        </div>
        {metric !== "fun" && isAtip(r, yi, metric === "aluno" ? "aluno" : "mde") && (
                      <div className="text-xs text-warning-ink">{atipNote([metric === "aluno" ? "aluno" : "mde"], isImplausible(r, yi))}</div>
                    )}
        <div className="text-xs text-muted-foreground tnum">{int(r.pop)} hab.</div>
      </>
    );
  };

  const href = useCallback(
    (id: number) => {
      if (eff === "uf") {
        const u = byCode.get(id);
        return u ? withYear(ufPath(u.uf), year, initialYear) : null;
      }
      const r = byId.get(id);
      return r ? withYear(cityPath(r.uf, r.slug), year, initialYear) : null;
    },
    [eff, byCode, byId, year, initialYear],
  );

  const showMun = mode === "mun";
  const exportMetric = eff === "uf" ? UF_METRICS.find((m) => m.key === ufMetric)!.label : METRICS.find((m) => m.key === metric)!.label;
  const legendBins = eff === "uf" ? ufBins : munBins;
  const outlines = eff === "mun" ? metric !== "aluno" : ufMetric !== "share";
  const exportLegend: ChartLegendItem[] = [
    ...legendBins.map((b) => ({ label: b.label, color: b.color, kind: "swatch" as const })),
    ...(eff === "mun" && metric === "mde" ? [{ label: "Não declarou", color: "var(--critical)", kind: "hatch" as const }] : []),
    { label: "Sem dados", color: NO_DATA_COLOR, kind: "swatch" },
    ...(outlines ? [{ label: "Contorno vermelho: abaixo do mínimo legal", color: "var(--critical-ink)", kind: "ring" as const }] : []),
  ];
  const exportCsv =
    eff === "uf"
      ? {
          columns: ["uf", "estado", "ano", "municipios_abaixo_25", "municipios_declararam", "abaixo_pct", "mde_mediana_pct", "governo_estadual_mde_pct", "nao_declararam"],
          rows: ufs.map((u) => {
            const st = u.stats[yi];
            const sh = belowShare(st);
            return {
              uf: u.uf, estado: u.name, ano: year, municipios_abaixo_25: st.below, municipios_declararam: st.reported,
              abaixo_pct: sh == null ? null : Math.round(sh * 100) / 100, mde_mediana_pct: st.median, governo_estadual_mde_pct: u.gov[yi], nao_declararam: st.nd,
            };
          }),
        }
      : {
          columns: ["ibge", "municipio", "uf", "ano", metric === "mde" ? "mde_pct" : metric === "fun" ? "fundeb_pessoal_pct" : "por_aluno_rs", "nao_declarou"],
          rows: (ufCodes ? (rows ?? []).filter((r) => ufCodes.includes(Math.floor(r.id / 100000))) : rows ?? []).map((r) => ({
            ibge: r.id, municipio: r.name, uf: r.uf, ano: year,
            [metric === "mde" ? "mde_pct" : metric === "fun" ? "fundeb_pessoal_pct" : "por_aluno_rs"]: r[metric][yi],
            nao_declarou: r.nd[yi] ? 1 : 0,
          })),
        };
  const mapHeight = ufCodes ? 520 : 600;
  const warm = () => {
    if (mode === "mun") return;
    onNeedRows();
    prewarmMap("br", "mun", ufCodes, mapHeight, true);
  };
  const loading = showMun && !rows;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* PERF-12: start the municipal download and projection on intent, before the click */}
        <span
          className="contents"
          onPointerEnter={warm}
          onFocus={warm}
          onTouchStart={warm}
        >
        <SegmentedControl
          label="Nível do mapa"
          value={mode}
          onValueChange={(v) => setMode(v as typeof mode)}
          options={[
            { value: "uf", label: "Estados" },
            { value: "mun", label: "Municípios" },
          ]}
        />
        </span>
        {showMun ? (
          <SegmentedControl label="Indicador do mapa" value={metric} onValueChange={(v) => setMetric(v as MetricKey)} options={METRICS.map((m) => ({ value: m.key, label: MUN_SHORT[m.key] }))} />
        ) : (
          <SegmentedControl label="Indicador do mapa" value={ufMetric} onValueChange={(v) => setUfMetric(v as UfMetric)} options={UF_METRICS.map((m) => ({ value: m.key, label: m.short }))} />
        )}
        {loading && (
          <span className="text-xs text-muted-foreground" role="status">
            {rowsError ? "Falha ao carregar os municípios." : "Carregando 5.570 municípios…"}
          </span>
        )}
        <span className="ml-auto">
          <ChartActions
            // JOR-24: the title names the metric, the level and the year; the legend is drawn into the image
            title={`${exportMetric} por ${eff === "uf" ? "estado" : "município"} · ${scopeLabel} · ${year}`}
            filename={[fileScope, "mapa", eff === "uf" ? ufMetric : metric, year]}
            svgSelector="svg[role=img], svg[role=group]"
            note={eff === "mun" && metric === "aluno" ? "Valores nominais" : undefined}
            legend={exportLegend}
            csv={exportCsv}
          />
        </span>
      </div>
      <Choropleth
        src="br"
        layer={eff}
        ufCodes={ufCodes}
        fill={fill}
        hatched={hatched}
        outlined={outlined}
        label={eff === "uf" ? label : undefined}
        describedBy={eff === "uf" ? tableId : undefined}
        tooltip={tooltip}
        href={href}
        ufBorders={showMun}
        ariaLabel={
          eff === "uf"
            ? `Mapa ${ariaScope} por estado, ${year}: ${UF_METRICS.find((m) => m.key === ufMetric)!.label}. Use Tab para percorrer os estados.`
            : `Mapa ${ariaScope} por município, ${year}: ${METRICS.find((m) => m.key === metric)!.label}`
        }
        height={mapHeight}
      />
      {showMun ? (
        <Legend title={METRICS.find((m) => m.key === metric)!.label} bins={munBins} nd={metric === "mde"} outlined={metric === "aluno" ? undefined : belowKeys} />
      ) : (
        <Legend title={UF_METRICS.find((m) => m.key === ufMetric)!.label} bins={ufBins} nd={false} outlined={ufMetric === "share" ? undefined : belowKeys} />
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {(showMun ? metric !== "aluno" : ufMetric !== "share") ? "Contorno vermelho (com ponto nos menores): abaixo do mínimo legal. " : ""}
        Os mesmos números em tabela:{" "}
        {tableId && (
          <>
            <a href={`#${tableId}`} className="font-medium text-brand-ink underline-offset-2 hover:underline">
              ranking dos estados
            </a>
            {" · "}
          </>
        )}
        <Link href={explorerHref} className="font-medium text-brand-ink underline-offset-2 hover:underline">
          municípios no Explorar
        </Link>
      </p>
    </div>
  );
}
