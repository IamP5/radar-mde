import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // lets a production build run next to `next dev` (NEXT_DIST_DIR=.next-build npm run build)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The first version covered São Paulo only, under /municipio/<slug>
  async redirects() {
    return [
      { source: "/df", destination: "/df/brasilia", permanent: true },
      { source: "/municipio/:slug", destination: "/sp/:slug", permanent: true },
      { source: "/dados/radar-mde-sp.csv", destination: "/dados/csv/sp", permanent: true },
      // Pages declare app/icon.svg; old clients and crawlers still ask for /favicon.ico
      { source: "/favicon.ico", destination: "/icon.svg", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
