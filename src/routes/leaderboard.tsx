import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Gift } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLeaderboard } from "@/lib/chain.functions";
import { Screen } from "@/components/Screen";
import { usePlayer, isRankedEligible , displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";

import { useSeason, rewardForRank, REWARD_RANKS, formatFacts } from "@/lib/game/season";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — FarAction" },
      {
        name: "description",
        content:
          "Season 1 • Genesis: The Awakening standings. Top 25 share the 100,000,000 $FACTS reward pool.",
      },
      { property: "og:title", content: "Leaderboard — FarAction" },
      {
        property: "og:description",
        content: "Top 25 FarAction fighters share the 100,000,000 $FACTS Season 1 reward pool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { player } = usePlayer();
  const wallet = useTokenBalances();

  const eligible = isRankedEligible(player);
  const { config: season, status } = useSeason();
  const [claimed, setClaimed] = useState(false);

  const standings = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => listLeaderboard(),
  });

  // Ranked FP standings from the database — Season Pass holders only. The local
  // player is folded in only while their own pass is active.
  const rows = [
    ...(standings.data ?? []).filter(
      (r) => r.name.toLowerCase() !== displayHandle(player).toLowerCase(),
    ),
    ...(eligible ? [{ name: displayHandle(player), fp: player.rankedFp }] : []),
  ].sort((a, b) => b.fp - a.fp);
  const rank = rows.findIndex((r) => r.name === displayHandle(player)) + 1;
  const potential = eligible ? rewardForRank(rank) : null;

  return (
    <Screen
      title="Leaderboard"
      eyebrow={`Station · ${season.shortName}`}
      heading={status.ended ? "Season 1 · Final Ranks" : "Season 1 · Genesis Ranks"}
      blurb={`Top ${REWARD_RANKS} fighters share the ${season.rewardPool.toLocaleString()} $FACTS reward pool. Rewards are weighted — #1 takes 20,000,000 FACTS. ${
        status.ended
          ? "The season has closed: standings are locked and rewards are claimable."
          : "Rankings settle when the season timer hits zero."
      }`}
      aside={
        <div className="space-y-2">
          <div className="panel p-4">
            <p className="label-xs">Your rank</p>
            <p className="font-display text-4xl font-bold text-accent">#{rank}</p>
          </div>
          <div className="panel flex items-center justify-between p-3">
            <span className="label-xs">Your FACTS</span>
            <span className="font-display text-facts">
              {wallet.connected ? Math.floor(wallet.facts).toLocaleString() : "—"}
            </span>

          </div>
          <div className="panel p-3">
            <p className="label-xs">Potential reward</p>
            <p className="font-display text-lg text-facts">
              {potential
                ? `${potential.toLocaleString()} FACTS`
                : eligible
                  ? "Outside top 25"
                  : "—"}
            </p>
          </div>
          {eligible ? null : (
            <Link
              to="/season-pass"
              className="flex items-center gap-2 rounded-lg border border-facts/40 bg-facts/10 p-3 text-[11px] text-muted-foreground"
            >
              <Lock className="size-3.5 shrink-0 text-facts" />A Season Pass is required to appear
              on the Season Leaderboard and to be eligible for the{" "}
              {season.rewardPool.toLocaleString()} $FACTS reward pool.
            </Link>
          )}
          <div className="panel p-3">
            <p className="label-xs">{status.ended ? "Season closed" : "Season ends in"}</p>
            <p className="font-display text-sm">
              {status.ended
                ? "Leaderboard locked"
                : `${status.parts.days}d ${status.parts.hours}h ${status.parts.minutes}m ${status.parts.seconds}s`}
            </p>
          </div>
          {status.ended ? (
            <button
              type="button"
              disabled={!potential || claimed}
              onClick={() => setClaimed(true)}
              className="fa-btn w-full disabled:opacity-50"
            >
              <Gift className="size-4" />
              {claimed
                ? "Reward claimed"
                : potential
                  ? "Claim reward"
                  : eligible
                    ? "Not eligible"
                    : "Season Pass required"}
            </button>
          ) : (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Lock className="size-3" /> Rewards unlock at season close
            </p>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <p className="label-xs">Ranked standings</p>
        <p className="label-xs text-facts">
          Ranked FP · Pool {formatFacts(season.rewardPool)} FACTS · Top {REWARD_RANKS} paid
        </p>
      </div>
      {standings.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading standings…</p>
      ) : null}
      {!standings.isLoading && rows.length <= 1 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No Season Pass holders on the board yet. Ranked wins with an active pass open the
          standings.
        </p>
      ) : null}
      <ul className="fa-scroll mt-2 max-h-[calc(100%-2rem)] divide-y divide-border/60 pr-1">
        {rows.map((r, i) => {
          const reward = rewardForRank(i + 1);
          return (
            <li
              key={r.name}
              className={`flex items-center gap-4 py-3 text-sm ${
                r.name === displayHandle(player) ? "text-accent" : ""
              }`}
            >
              <span className="w-10 font-display text-muted-foreground">#{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="w-32 text-right font-display text-accent">
                {r.fp.toLocaleString()} FP
              </span>
              <span className="w-28 text-right font-display text-usdc">
                {reward ? `${formatFacts(reward)} FACTS` : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
