import type { MetadataRoute } from "next";

// PWA manifest — lets staff "Add to Home Screen" so Web Push order alerts work
// (required on iOS 16.4+). See the notification settings on the buyer dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Damen Preorder",
    short_name: "Damen",
    description: "Internal preorder system — Damen Service Alimentaire",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
