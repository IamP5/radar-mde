import type { ReactNode } from "react";
import { Stat, type Tone } from "@/components/kit/stat";

/** KPI tile (kept for existing call sites); renders the kit `Stat`. */
export default function Tile({
  label, value, sub, tone = "neutral", delta, deltaTone, context, spark,
}: { label: string; value: string; sub?: ReactNode; tone?: Tone; delta?: ReactNode; deltaTone?: Tone; context?: ReactNode; spark?: ReactNode }) {
  return <Stat label={label} value={value} sub={sub} tone={tone} delta={delta} deltaTone={deltaTone} context={context} spark={spark} />;
}
