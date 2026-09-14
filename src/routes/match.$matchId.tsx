import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { InviteHandoff } from "@/components/InviteHandoff";
import { PROD_ORIGIN } from "@/lib/config";
import { buildShareMeta, shareImageUrl } from "@/lib/share-meta";

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
      ...buildShareMeta({
        url: `${PROD_ORIGIN}/match/${params.matchId}`,
        title: `FarAction match · ${params.matchId}`,
        description: "Staked 1 vs 1 on Base — winner takes 90% of the pot.",
        imageUrl: shareImageUrl({
          kind: "match",
          matchId: params.matchId,
          mode: "1v1",
          season: "Season 2 • The Rise of Junkies",
        }),
        buttonTitle: "Enter the bout",
      }),
    ],
    links: [{ rel: "canonical", href: `/match/${params.matchId}` }],
  }),
  component: MatchRoute,
});

function MatchRoute() {
  const { matchId } = Route.useParams();
  const { m } = Route.useSearch();
  return <InviteHandoff matchId={matchId} payload={m} />;
}
