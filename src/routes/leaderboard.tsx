import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Gift, Lock, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { usePlayer, isRankedEligible, displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";
import { useWallet } from "@/lib/onchain/wallet";
import {
  globalLeaderboard,
  listTournaments,
  registerForTournament,
  tournamentStandings,
} from "@/lib/tournaments.functions";

import {
  useSeason,
  rewardForRank,
  REWARD_RANKS,
  formatFacts,
  HOOD_JUNKIES_SITE,
  HOOD_JUNKIES_OPENSEA,
} from "@/lib/game/season";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — FarAction" },
      {
        name: "description",
        content:
          "Season 2 • The Rise of Junkies standings. Top 25 share the 100,000,000 $FACTS reward pool.",
      },
      { property: "og:title", content: "Leaderboard — FarAction" },
      {
        property: "og:description",
        content: "Top 25 FarAction fighters share the 100,000,000 $FACTS Season 2 reward pool.",
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
  const { address, connect, connecting } = useWallet();

  const eligible = isRankedEligible(player);
  const { config: season, status } = useSeason();
  const [claimed, setClaimed] = useState(false);
  const [tab, setTab] = useState<"global" | "tournament">("global");
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);

  const global = useQuery({
    queryKey: ["leaderboard", "global"],
    queryFn: () => globalLeaderboard({ data: { limit: 50 } }),
  });
  const tournaments = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => listTournaments({ data: { limit: 20 } }),
  });
  useEffect(() => {
    if (!selectedTournament && tournaments.data?.[0]) setSelectedTournament(tournaments.data[0].id);
  }, [selectedTournament, tournaments.data]);
  const tournament = tournaments.data?.find((item) => item.id === selectedTournament);
  const tournamentRows = useQuery({
    queryKey: ["leaderboard", "tournament", selectedTournament],
    enabled: Boolean(selectedTournament),
    queryFn: () => tournamentStandings({ data: { tournamentId: selectedTournament!, limit: 50 } }),
  });
  const registration = useMutation({
    mutationFn: async () => {
      if (!selectedTournament || !address) throw new Error("Connect a wallet to register.");
      return registerForTournament({
        data: { tournamentId: selectedTournament, wallet: address, handle: displayHandle(player), fid: player.fid },
      });
    },
  });

  const rows = tab === "global"
    ? (global.data ?? []).map((row) => ({ name: row.handle || row.wallet, score: row.fp, wins: row.wins, losses: row.losses }))
    : (tournamentRows.data ?? []).map((row) => ({ name: row.handle || row.wallet, score: row.points, wins: row.wins, losses: row.losses }));
  const loadingRows = tab === "global" ? global.isLoading : tournamentRows.isLoading;
  const rank = rows.findIndex((r) => r.name === displayHandle(player)) + 1;
  const potential = eligible ? rewardForRank(rank) : null;

  return (
    <Screen
      title="Leaderboard"
      eyebrow={`Station · ${season.shortName}`}
      heading={status.ended ? "Season 2 · Final Ranks" : "Season 2 · The Rise of Junkies Ranks"}
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
          <div className="panel space-y-2 border-fuchsia-500/40 p-3">
            <p className="label-xs text-fuchsia-400">Reward eligibility · Season 2</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              To be eligible for Season 2 rewards you must hold a{" "}
              <span className="text-foreground">Hood Junkies NFT</span> in the wallet you play with.
              A snapshot is taken on{" "}
              <span className="text-foreground">
                {new Date(status.snapshotAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>{" "}
              — the day before the season ends. Holders in the{" "}
              <span className="text-foreground">top 25 of the global leaderboard</span> at that
              snapshot receive their share of the {season.rewardPool.toLocaleString()} $FACTS pool,
              sent straight to their wallet.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={HOOD_JUNKIES_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="fa-chip border-fuchsia-500/50 text-fuchsia-300"
              >
                hoodjunkies.world
              </a>
              <a
                href={HOOD_JUNKIES_OPENSEA}
                target="_blank"
                rel="noopener noreferrer"
                className="fa-chip border-fuchsia-500/50 text-fuchsia-300"
              >
                Mint on OpenSea
              </a>
            </div>
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
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTab("global")} className={`fa-chip ${tab === "global" ? "border-accent text-accent" : ""}`}>
            <Trophy className="size-3.5" /> Global
          </button>
          <button type="button" onClick={() => setTab("tournament")} className={`fa-chip ${tab === "tournament" ? "border-accent text-accent" : ""}`}>
            <CalendarDays className="size-3.5" /> Tournaments
          </button>
        </div>
        <p className="label-xs text-facts">
          {tab === "global" ? "All-time FP standings" : "Tournament points standings"}
        </p>
      </div>
      {tab === "tournament" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(tournaments.data ?? []).map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedTournament(item.id)} className={`rounded-lg border px-3 py-2 text-left text-xs ${item.id === selectedTournament ? "border-accent bg-accent/10 text-accent" : "border-border/70"}`}>
                <span className="block font-display font-bold">{item.title}</span>
                <span className="text-muted-foreground">{item.status}</span>
              </button>
            ))}
          </div>
          {tournament ? (
            <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
              <div><p className="font-display font-bold">{tournament.title}</p><p className="text-xs text-muted-foreground">Prize pool {Number(tournament.prize_pool).toLocaleString()} FACTS</p></div>
              <button type="button" disabled={connecting || registration.isPending} onClick={() => { if (!address) void connect(); else registration.mutate(); }} className="fa-btn disabled:opacity-50">
                {registration.isSuccess ? "Registered" : connecting ? "Connecting…" : registration.isPending ? "Registering…" : address ? "Register" : "Connect wallet"}
              </button>
            </div>
          ) : null}
          {registration.isError ? <p className="text-xs text-destructive">{registration.error.message}</p> : null}
        </div>
      ) : null}
      {loadingRows ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading standings…</p>
      ) : null}
      {!loadingRows && rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {tab === "global" ? "No fighters have a recorded score yet." : "No fighters are registered in this tournament yet."}
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
                {r.score.toLocaleString()} {tab === "global" ? "FP" : "TP"}
              </span>
              <span className="w-28 text-right font-display text-usdc">
                {tab === "global" && reward ? `${formatFacts(reward)} FACTS` : `${r.wins}W / ${r.losses}L`}
              </span>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
