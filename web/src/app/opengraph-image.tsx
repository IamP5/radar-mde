import { ImageResponse } from "next/og";
import { META, YEARS } from "@/lib/data";

export const alt = "Radar MDE · Brasil: quanto cada município aplica em educação";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BINS = ["#b42727", "#e27371", "#d1cfc8", "#5598e7", "#1c5cab"];

/** Default share image for every page without its own (SEO-02). */
export default function OpenGraphImage() {
  const first = YEARS[0];
  const last = YEARS[YEARS.length - 1];
  const updated = new Date(META.updated + "T12:00:00").toLocaleDateString("pt-BR");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: "72px 80px", color: "#171717" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#171717" />
            <circle cx="12" cy="12" r="7" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3.5" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1.5" />
            <path d="M12 12 L18.5 8.2" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="1.4" fill="#ffffff" />
          </svg>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em" }}>Radar MDE · Brasil</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.04em", maxWidth: 980 }}>
            Quanto cada município aplica em educação
          </div>
          <div style={{ fontSize: 30, color: "#666666", lineHeight: 1.35, maxWidth: 980 }}>
            {`O mínimo da Constituição é 25% da receita de impostos. Os 5.570 municípios, de ${first} a ${last}.`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {BINS.map((c) => (
              <div key={c} style={{ width: 56, height: 16, borderRadius: 4, background: c }} />
            ))}
          </div>
          <div style={{ fontSize: 22, color: "#666666" }}>{`Dados SIOPE/FNDE · atualizado em ${updated}`}</div>
        </div>
      </div>
    ),
    size,
  );
}
