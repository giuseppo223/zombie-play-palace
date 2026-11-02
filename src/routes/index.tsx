import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "@/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notte dei Morti — zombie 3D e multiplayer cooperativo" },
      {
        name: "description",
        content:
          "Sopravvivi alle orde zombie da solo o in squadra online fino a 3 giocatori. Stanze con codice, armi, perk e round infiniti su PC, telefono e controller.",
      },
      { property: "og:title", content: "Notte dei Morti — zombie 3D in squadra fino a 3" },
      {
        property: "og:description",
        content:
          "Crea una stanza, invita fino a due amici e affronta insieme round infiniti di zombie nella città notturna.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
