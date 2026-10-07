import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { MDE_MIN, YEARS, getCity, pct } from "@/lib/data";
import { getUf } from "@/lib/geo";

export const alt = "Quanto o município aplicou em educação (MDE), segundo o Radar MDE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = { ok: "#0f7b3f", edge: "#a35200", below: "#c0262d", nd: "#666666" } as const;

/** Share card: city, latest MDE % with its status colour, and an 18-year bar strip with the 25% line. */
export default async function Image({ params }: { params: Promise<{ uf: string; slug: string }> }) {
  const { uf, slug } = await params;
  const c = uf === uf.toLowerCase() ? getCity(uf, slug) : undefined;
  if (!c) notFound();
  const series = YEARS.map((y) => ({ y, v: c.years[y]?.mde ?? null, nd: c.years[y]?.s === "nd" }));
  const last = [...series].reverse().find((p) => p.v != null);
  // a municipality that stopped declaring leads with that, never with an older green number
  const stopped = series.filter((p) => p.nd && (!last || p.y > last.y)).map((p) => p.y);
  const kind = stopped.length ? "below" : !last ? "nd" : last.v! < MDE_MIN ? "below" : last.v! < MDE_MIN + 1 ? "edge" : "ok";
  const label = stopped.length
    ? `Não declarou ${stopped.length > 1 ? `${stopped[0]}–${stopped[stopped.length - 1]}` : stopped[0]}${last ? ` · último dado: ${last.y}` : ""}`
    : !last
      ? "Sem dados declarados"
      : kind === "below"
      ? `Abaixo do mínimo de 25% em ${last.y}`
      : kind === "edge"
        ? `No limite (25–26%) em ${last.y}`
        : `Acima do mínimo de 25% em ${last.y}`;
  // zero baseline (a truncated axis exaggerates differences); values above 45% are capped
  const H = 170;
  const h = (v: number) => Math.max(4, (Math.min(v, 45) / 45) * H);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: "64px 72px", fontSize: 32, color: "#171717" }}>
        <div style={{ display: "flex", fontSize: 28, color: "#666666" }}>Radar MDE · aplicação em educação</div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 28, gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3 }}>{c.name}</div>
          <div style={{ fontSize: 34, color: "#666666" }}>{getUf(c.uf)?.name ?? c.uf}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 24, gap: 24 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, color: stopped.length ? COLORS.nd : COLORS[kind] }}>{last ? pct(last.v) : "—"}</div>
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: `${COLORS[kind]}1a`, color: COLORS[kind], fontSize: 30 }}>{label}</div>
        </div>
        <div style={{ display: "flex", flexGrow: 1, alignItems: "flex-end", gap: 8, marginTop: 24, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${h(MDE_MIN)}px`, borderTop: "3px dashed #999999", display: "flex" }} />
          {series.map((p) => (
            <div
              key={p.y}
              style={{
                display: "flex",
                flexGrow: 1,
                height: p.v == null ? (p.nd ? H : 4) : h(p.v),
                // "não declarou": full-height outlined (empty) bar, unmistakable from a low value
                background: p.v == null ? (p.nd ? "transparent" : "#e5e5e5") : p.v < MDE_MIN ? COLORS.below : "#3b82f6",
                border: p.nd ? `3px dashed ${COLORS.below}` : "none",
                borderRadius: 4,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 22, color: "#666666" }}>
          <span>{YEARS[0]}</span>
          <span>{series.some((p) => p.nd) ? "tracejado: mínimo de 25% · contorno vermelho: não declarou" : "linha tracejada: mínimo constitucional de 25%"}</span>
          <span>{YEARS[YEARS.length - 1]}</span>
        </div>
      </div>
    ),
    {
      ...size,
      // the og:image URL carries a content hash, so CDNs and crawlers may keep it for long
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000" },
    },
  );
}
