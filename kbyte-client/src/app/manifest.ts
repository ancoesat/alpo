import type { MetadataRoute } from "next";

// Lets Android (Chrome / Samsung Internet) install the site as a home-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Alpo",
    short_name: "Alpo",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#245edb",
    theme_color: "#245edb",
    lang: "tr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed artwork with the letter inside the safe zone, so it also works as maskable.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
