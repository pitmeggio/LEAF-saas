import type { MetadataRoute } from "next";

// PWA manifest → makes LEAF installable on a phone ("Add to Home Screen"):
// a standalone, full-screen app with the leaf icon. start_url is the athlete
// app. Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LEAF",
    short_name: "LEAF",
    description: "La tua academy, gli allenamenti del coach e il tuo profilo FIS.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0f17",
    theme_color: "#0c0f17",
    icons: [
      { src: "/brand/leaf-appicon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/leaf-appicon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/leaf-appicon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
