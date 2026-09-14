import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { InviteHandoff } from "@/components/InviteHandoff";
import { PROD_ORIGIN } from "@/lib/config";
import { buildShareMeta, shareImageUrl } from "@/lib/share-meta";

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
      ...buildShareMeta({
        url: `${PROD_ORIGIN}/invite/${params.matchId}`,
        title: `FarAction challenge · ${params.matchId}`,
        description: "Accept the challenge, match the stake, and take the bout.",
        imageUrl: shareImageUrl({
          kind: "challenge",
          matchId: params.matchId,
          mode: "1v1",
          season: "Season 2 • The Rise of Junkies",
        }),
        buttonTitle: "Accept the challenge",
      }),
    ],
    links: [{ rel: "canonical", href: `/invite/${params.matchId}` }],
  }),
  component: InviteRoute,
});

function InviteRoute() {
  const { matchId } = Route.useParams();
  const { m } = Route.useSearch();
  return <InviteHandoff matchId={matchId} payload={m} />;
}
