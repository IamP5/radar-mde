import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radar MDE · Brasil",
    short_name: "Radar MDE",
    description: "Quanto cada município brasileiro aplica em educação e se cumpre o mínimo constitucional de 25%.",
    lang: "pt-BR",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
