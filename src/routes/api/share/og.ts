import { createFileRoute } from "@tanstack/react-router";
import { buildShareCardSvg, type SharePreviewContext } from "@/lib/share-meta";

export const Route = createFileRoute("/api/share/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;
        const kindParam = params.get("kind");
        const context: SharePreviewContext = {
          ...(kindParam === "challenge" ||
          kindParam === "result" ||
          kindParam === "reward" ||
          kindParam === "leaderboard" ||
          kindParam === "match"
            ? { kind: kindParam }
            : { kind: "match" }),
          ...(params.get("matchId") ? { matchId: params.get("matchId")! } : {}),
          ...(params.get("hostHandle") ? { hostHandle: params.get("hostHandle")! } : {}),
          ...(params.get("opponentHandle") ? { opponentHandle: params.get("opponentHandle")! } : {}),
          ...(params.get("winnerHandle") ? { winnerHandle: params.get("winnerHandle")! } : {}),
          ...(params.get("loserHandle") ? { loserHandle: params.get("loserHandle")! } : {}),
          ...(params.get("mode") ? { mode: params.get("mode")! } : {}),
          ...(params.get("token") ? { token: params.get("token")! } : {}),
          ...(params.get("reward") ? { reward: params.get("reward")! } : {}),
          ...(params.get("season") ? { season: params.get("season")! } : {}),
          ...(params.get("title") ? { title: params.get("title")! } : {}),
          ...(params.get("description") ? { description: params.get("description")! } : {}),
        };

        const svg = buildShareCardSvg(context);
        return new Response(svg, {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=300",
          },
        });
      },
    },
  },
});
