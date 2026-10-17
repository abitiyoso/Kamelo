import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kamelo by ELENIO",
    short_name: "Kamelo",
    description:
      "Urus Properti Jadi Gampang. Kelola kamar, penghuni, dan tagihan dengan Kamelo.",
    start_url: "/app/dashboard",
    display: "standalone",
    background_color: "#f5f8fc",
    theme_color: "#086af5",
    lang: "id",
    icons: [
      {
        src: "/brand/elenio-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
