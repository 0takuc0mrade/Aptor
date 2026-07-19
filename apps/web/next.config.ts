import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.APTOR_NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  transpilePackages: ["@aptor/browser", "@aptor/shared"],
  serverExternalPackages: ["@aptor/delivery"],
  async headers() {
    return [
      {
        source: "/zk/aptor/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          {
            key: "Cache-Control",
            value: "public, max-age=300, must-revalidate",
          },
        ],
      },
      {
        source: "/zk/aptor/:directory(keys|zkir)/:artifact*",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      "isomorphic-ws": "@aptor/browser/isomorphic-ws",
    },
  },
  webpack(config) {
    config.resolve.alias["isomorphic-ws"] = "@aptor/browser/isomorphic-ws";
    return config;
  },
};

export default nextConfig;
