import type { NextConfig } from "next";

const BACKEND_API_BASE = "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_API_BASE}/api/:path*`,
      },
      {
        source: "/nominatim/:path*",
        destination: "https://nominatim.openstreetmap.org/:path*",
      },
    ];
  },
};

export default nextConfig;
