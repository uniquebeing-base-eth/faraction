import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { InviteHandoff } from "@/components/InviteHandoff";
import { PROD_ORIGIN } from "@/lib/config";

const searchSchema = z.object({ m: z.string().optional() });

/**
 * Production invite permalink: https://faraction.signalify.xyz/invite/{matchId}
 * Renders a shareable card, then hands off to the join flow with the encoded
 * match payload intact.
 */
export const Route = createFileRoute("/invite/$matchId")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `Match invite ${params.matchId} — FarAction` },
      {
        name: "description",
        content: `You have been challenged to FarAction match ${params.matchId}. Match the stake and fight on Base.`,
      },
      { property: "og:title", content: `FarAction match invite · ${params.matchId}` },
      {
        property: "og:description",
        content: "Accept the challenge, match the stake, winner takes 90% of the pot.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${PROD_ORIGIN}/preview.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${PROD_ORIGIN}/preview.png` },
    ],
  }),
  component: InviteRoute,
});

function InviteRoute() {
  const { matchId } = Route.useParams();
  const { m } = Route.useSearch();
  return <InviteHandoff matchId={matchId} payload={m} />;
}
