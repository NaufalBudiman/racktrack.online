import type { MetadataRoute } from "next";

// "Add to home screen" opens the dashboard like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RackTrack",
    short_name: "RackTrack",
    description: "Team inventory for network and IT gear: what's in stock, what's at a customer.",
    start_url: "/app",
    display: "standalone",
    background_color: "#07090D",
    theme_color: "#07090D",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
