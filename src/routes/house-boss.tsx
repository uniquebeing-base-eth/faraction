import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listHouseWinners } from "@/lib/chain.functions";
import { Screen } from "@/components/Screen";
import { usePlayer } from "@/lib/game/store";

export const Route = createFileRoute("/house-boss")({
  head: () => ({
    meta: [
      { title: "House Boss Challenge — FarAction" },
      {
        name: "description",
        content:
          "Clear the 5/5 House streak on Base and climb toward the 100,000,000 $FACTS Season 1 reward pool.",
      },
      { property: "og:title", content: "House Boss Challenge — FarAction" },
      { property: "og:description", content: "Beat the House AI 5 times in a row to claim USDC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HouseBoss,
});

function HouseBoss() {
  const { player } = usePlayer();
  const winners = useQuery({
    queryKey: ["house-winners"],
    queryFn: () => listHouseWinners(),
  });
  const rows = winners.data ?? [];
  return (
    <Screen
      title="House Boss Event"
      eyebrow="Season 1 • Genesis: The Awakening"
      heading="House Boss Challenge"
      blurb="Beat the House AI through a full 5/5 Upper Chamber streak. Clear the final mirror fight, get your verified winner code, and climb the Season 1 • Genesis: The Awakening leaderboard — the top 25 share the 100,000,000 $FACTS reward pool."
      aside={
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Season pool", "100M FACTS", "text-facts"],
                ["Top rank", "20M FACTS", "text-usdc"],
                ["Verified", String(rows.length), ""],
              ] as const
            ).map(([k, v, cls]) => (
              <div key={k} className="panel p-2.5">
                <p className="label-xs">{k}</p>
                <p className={`font-display text-sm ${cls}`}>{v}</p>
              </div>
            ))}
          </div>
          <Link to="/select-fighter" className="fa-btn w-full">
            <Crown className="size-4" /> Play vs House
          </Link>
        </div>
      }
    >
      <p className="label-xs">Your streak</p>
      <div className="mt-2 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex h-14 flex-1 items-center justify-center rounded-lg border font-display text-sm ${
              i < player.houseStreak
                ? "border-facts/60 bg-facts/15 text-facts"
                : "border-border text-muted-foreground"
            }`}
          >
            {i < player.houseStreak ? <Check className="size-5" /> : i + 1}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        You only qualify if you beat the full 5/5 streak, including the final mirror fight against
        your own fighter.
      </p>

      <p className="label-xs mt-5">Recent verified winners</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {winners.isLoading
            ? "Loading verified winners…"
            : "No verified winners yet — clear the 5/5 streak to be the first."}
        </p>
      ) : null}
      <ul className="mt-2 divide-y divide-border/60">
        {rows.map((w) => (
          <li key={w.code} className="flex items-center gap-3 py-2.5 text-xs">
            <span className="w-8 font-display text-muted-foreground">#{w.rank}</span>
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            <span className="label-xs">{w.code}</span>
            <span className="w-14 text-right font-display text-usdc">${w.reward.toFixed(2)}</span>
            <span className="label-xs w-14 text-right">{w.date}</span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
