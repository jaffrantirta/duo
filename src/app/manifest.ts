import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Duo",
    short_name: "Duo",
    description: "A little world for the two of you.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#FBF8F3",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
