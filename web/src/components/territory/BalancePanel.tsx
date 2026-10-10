"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InfoTip } from "./InfoTip";
import { useUrlParam } from "./useUrlParam";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Panel } from "@/components/kit/panel";
import { brlShort, brlSigned } from "@/lib/format";
import { IPCA_BASE, netBalance, type BalanceItem, type PeriodBalance } from "@/lib/rows";
import { cn } from "@/lib/utils";

type Sort = "worst" | "best" | "name";
export type BalanceGroup = { key: string; label: string; /** column header and listbox noun, e.g. "Estado" */ noun: string; items: BalanceItem[] };

const VALUE_OPTIONS = [
  { value: "nom", label: "Nominal" },
  { value: "real", label: "Corrigido (IPCA)" },
];
const SORT_OPTIONS = [
  { value: "worst", label: "Pior saldo" },
  { value: "best", label: "Maior saldo" },
  { value: "name", label: "A–Z" },
];

const tone = (v: number) => (v < 0 ? "text-critical-ink" : v > 0 ? "text-good-ink" : "text-muted-foreground");

/**
 * "Saldo no período": for each region / state / municipality, R$ applied above the 25% minimum minus R$ that fell
 * short of it, summed over every published year. Negative = faltou; positive = aplicou além do mínimo.
 * Nominal / IPCA toggle shares the `?valores=` parameter with DeficitPanel.
 */
export function BalancePanel({
  title, description, total, totalLabel, groups, years, className, listClassName,
}: {
  title: string; description: string; total: PeriodBalance; totalLabel: string; groups: BalanceGroup[]; years: number[];
  className?: string; listClassName?: string;
}) {
  const [mode, setMode] = useUrlParam<"nom" | "real">("valores", { nom: "nominal", real: "ipca" }, "nom");
  const [sort, setSort] = useState<Sort>("worst");
  const [gk, setGk] = useState(groups[0].key);
  const real = mode === "real";
  const group = groups.find((g) => g.key === gk) ?? groups[0];
  const span = `${years[0]}–${years[years.length - 1]}`;

  const list = useMemo(() => {
    const net = (b: BalanceItem) => netBalance(b, real);
    const out = [...group.items];
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else out.sort((a, b) => (sort === "worst" ? net(a) - net(b) : net(b) - net(a)));
    return out;
  }, [group, sort, real]);
  const maxAbs = Math.max(1, ...group.items.map((b) => Math.abs(netBalance(b, real))));
  const sh = real ? total.shortReal : total.short;
  const ov = real ? total.overReal : total.over;
  const tn = ov - sh;

  return (
    <Panel
      divided
      className={className}
      title={title}
      description={description}
      action={
        <SegmentedControl label="Valores do saldo" value={mode} onValueChange={(v) => setMode(v as typeof mode)} options={VALUE_OPTIONS} />
      }
    >
      <dl className="grid grid-cols-1 divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-4 py-3 sm:px-5">
          <dt className="flex items-center gap-1 text-sm text-muted-foreground">
            Saldo {totalLabel}, {span}
            <InfoTip label="Como o saldo é calculado">
              <p>
                Para cada município e cada ano com % declarado e receita conhecida: <strong className="font-medium">(% aplicado − 25%) × receita de impostos</strong>.
                Negativo é o que faltou para 25%; positivo é o que foi aplicado além do mínimo. O saldo é a soma de todos os anos.
              </p>
              <p className="text-muted-foreground">
                É um retrato do conjunto, não uma conta de compensação: a lei não permite “abater” um município com o excesso de outro, e o
                déficit acumulado (painel ao lado) só desconta o excesso do próprio município nos anos seguintes. Valores declarados ao SIOPE;
                anos sem declaração ou sem receita não entram.
              </p>
            </InfoTip>
          </dt>
          <dd className={cn("mt-1 text-xl leading-7 font-medium tracking-[-0.04em] tnum sm:text-2xl sm:leading-8", tone(tn))}>{brlSigned(tn)}</dd>
        </div>
        <div className="px-4 py-3 sm:px-5">
          <dt className="text-sm text-muted-foreground">Aplicado acima do mínimo</dt>
          <dd className="mt-1 text-lg leading-7 font-medium tracking-[-0.03em] tnum text-good-ink">{ov ? `+${brlShort(ov)}` : "R$ 0"}</dd>
        </div>
        <div className="px-4 py-3 sm:px-5">
          <dt className="text-sm text-muted-foreground">Faltou para chegar a 25%</dt>
          <dd className={cn("mt-1 text-lg leading-7 font-medium tracking-[-0.03em] tnum", sh ? "text-critical-ink" : "text-muted-foreground")}>{sh ? `−${brlShort(sh)}` : "R$ 0"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-5">
        {groups.length > 1 ? (
          <SegmentedControl label="Nível" value={group.key} onValueChange={setGk} options={groups.map((g) => ({ value: g.key, label: g.label }))} />
        ) : (
          <span className="text-sm text-muted-foreground">{group.items.length} {group.label.toLowerCase()}</span>
        )}
        <SegmentedControl label="Ordem" value={sort} onValueChange={(v) => setSort(v as Sort)} options={SORT_OPTIONS} />
      </div>

      <ol className={cn("scroll-thin fade-b max-h-[28rem] divide-y overflow-y-auto pb-6", listClassName)} aria-label={`${group.label}: saldo ${span}, ${real ? `R$ de ${IPCA_BASE} corrigidos pelo IPCA` : "valores nominais"}`}>
        {list.map((b) => {
          const v = netBalance(b, real);
          const w = (Math.abs(v) / maxAbs) * 50;
          const s = real ? b.shortReal : b.short;
          const o = real ? b.overReal : b.over;
          return (
            <li key={b.key}>
              <Link href={b.href} className="flex items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-accent/60 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{b.name}</span>
                    {b.sub && <span className="shrink-0 rounded border px-1 font-mono text-[11px] leading-4 text-muted-foreground">{b.sub}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground tnum">
                    {b.years ? `aplicou ${brlShort(o)} a mais · faltou ${brlShort(s)}` : "sem receita declarada para calcular"}
                  </span>
                </span>
                <span aria-hidden className="relative hidden h-1.5 w-28 shrink-0 rounded-full bg-muted forced-color-adjust-none sm:block">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
                  <span
                    className={cn("absolute inset-y-0 rounded-full", v < 0 ? "bg-critical" : "bg-good")}
                    style={v < 0 ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }}
                  />
                </span>
                <span className={cn("w-24 shrink-0 text-right text-sm font-medium tnum", tone(v))}>{b.years ? brlSigned(v) : "—"}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
