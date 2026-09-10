import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Price-file uploads go through a Server Action, and the default cap is
      // 1MB — the real PriceList export is already ~130KB as .xlsx, so leave
      // room for it to grow rather than failing the buyer mid-upload.
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        // The service worker must never be cached, so alert logic updates
        // reach every device on the next visit.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
