import { createFileRoute } from "@tanstack/react-router";
import { Screen } from "@/components/Screen";
import { usePlayer, passIsActive, displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";

import { DailyClaimCard } from "@/components/DailyClaimCard";
import { CHARACTERS, BASE_FACTS } from "@/lib/game/gameData";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — FarAction" },
      {
        name: "description",
        content:
          "Your FarAction record: FACTS balance, Facts Points earned in battle, House streak and the 500 FACTS daily claim.",
      },
      { property: "og:title", content: "Profile — FarAction" },
      {
        property: "og:description",
        content: "Track your FACTS, Facts Points and daily claim on Base.",
      },
      { property: "og:url", content: "/profile" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/profile" }],
  }),
  component: Profile,
});

function Profile() {
  const { player } = usePlayer();
  const wallet = useTokenBalances();
  const fighter = CHARACTERS.find((c) => c.id === player.fighterId) ?? CHARACTERS[0]!;

  return (
    <Screen
      title="Profile"
      eyebrow="Station · Dossier"
      heading={displayHandle(player)}
      blurb={`Main · ${fighter.name} · ${fighter.className}`}
      aside={
        <div className="space-y-2">
          <div className="panel flex items-center gap-3 p-3">
            <img
              src={fighter.portrait}
              alt={fighter.name}
              loading="lazy"
              className="size-16 shrink-0 rounded-md object-cover object-top"
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold">{fighter.name}</p>
              <p className="label-xs mt-1 text-facts">
                {passIsActive(player) ? "Season pass active" : "No season pass"}
              </p>
            </div>
          </div>
          <DailyClaimCard onClaimed={() => void wallet.refetch()} />
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-3">
        {(
          [
            ["FACTS", wallet.connected ? Math.floor(wallet.facts).toLocaleString() : "—", "text-facts"],
            ["Facts Points", `${player.fp.toLocaleString()} FP`, "text-accent"],
            ["Ranked FP", `${player.rankedFp.toLocaleString()} FP`, "text-accent"],
            ["House streak", `${player.houseStreak}/5`, ""],
          ] as const
        ).map(([label, value, cls]) => (
          <div key={label} className="rounded-lg border border-border/70 bg-card/40 p-3">
            <p className="label-xs">{label}</p>
            <p className={`font-display text-xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {(
          [
            ["USDC", wallet.connected ? `$${wallet.usdc.toFixed(2)}` : "—", "text-usdc"],
            ["Wins", String(player.wins), ""],
            ["Losses", String(player.losses), ""],
          ] as const
        ).map(([label, value, cls]) => (
          <div key={label} className="rounded-lg border border-border/70 bg-card/40 p-3">
            <p className="label-xs">{label}</p>
            <p className={`font-display text-xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Battles pay Facts Points (FP). Only FP earned in Ranked matches counts toward the Season
        leaderboard. $FACTS itself is claimed once every 24 hours from the reward distributor on
        Base.
      </p>

      <p className="label-xs mt-5">Base codex · {BASE_FACTS.length} facts</p>
      <ul className="fa-scroll mt-2 grid max-h-[calc(100%-16rem)] grid-cols-2 gap-x-6 gap-y-2 pr-1">
        {BASE_FACTS.map((f) => (
          <li key={f} className="text-xs leading-relaxed text-muted-foreground">
            • {f}
          </li>
        ))}
      </ul>
    </Screen>
  );
}
