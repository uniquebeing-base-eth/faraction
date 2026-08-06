import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { InviteHandoff } from "@/components/InviteHandoff";
import { PROD_ORIGIN } from "@/lib/config";

const searchSchema = z.object({ m: z.string().optional() });

/**
 * Canonical match permalink: https://faraction.signalify.xyz/match/{matchId}
 */
export const Route = createFileRoute("/match/$matchId")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `Match ${params.matchId} — FarAction` },
      {
        name: "description",
        content: `FarAction match ${params.matchId} on Base. Open the bout, match the stake and fight for the pot.`,
      },
      { property: "og:title", content: `FarAction match · ${params.matchId}` },
      {
        property: "og:description",
        content: "Staked 1 vs 1 on Base — winner takes 90% of the pot.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${PROD_ORIGIN}/preview.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${PROD_ORIGIN}/preview.png` },
    ],
  }),
  component: MatchRoute,
});

function MatchRoute() {
  const { matchId } = Route.useParams();
  const { m } = Route.useSearch();
  return <InviteHandoff matchId={matchId} payload={m} />;
}
