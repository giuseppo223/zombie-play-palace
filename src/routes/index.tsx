import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "@/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notte dei Morti — sparatutto zombie 3D a round" },
      {
        name: "description",
        content:
          "Sopravvivi a round infiniti di zombie in una città al buio: punti, colpi alla testa, armi da sbloccare. Gioca nel browser su desktop e mobile.",
      },
      { property: "og:title", content: "Notte dei Morti — sparatutto zombie 3D a round" },
      {
        property: "og:description",
        content:
          "Round infiniti, orde di zombie e una stazione rifornimenti: sopravvivi il più possibile in questo sparatutto 3D nel browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
