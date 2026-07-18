import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.APTOR_NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@aptor/browser", "@aptor/shared"],
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
