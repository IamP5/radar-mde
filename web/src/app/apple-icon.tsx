import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the radar mark (kit/logo) on the brand ink, full bleed (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#171717" }}>
        <svg width="132" height="132" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="7" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3.5" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1.5" />
          <path d="M12 12 L18.5 8.2" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.4" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
