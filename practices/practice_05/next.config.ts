import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  async rewrites() {
    const backend = process.env.GO_API_URL ?? "http://127.0.0.1:8080";
    return [
      { source: "/auth/:path*", destination: `${backend}/auth/:path*` },
      { source: "/api/session", destination: `${backend}/api/session` },
      {
        source: "/api/me/:path*",
        destination: `${backend}/api/me/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${backend}/api/users/:path*`,
      },
    ];
  },
};
export default config;
