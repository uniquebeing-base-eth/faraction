import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, Link2, Swords, Loader2, Lock } from "lucide-react";
import { z } from "zod";
import { Screen } from "@/components/Screen";
import { CHARACTERS } from "@/lib/game/gameData";
import { usePlayer, passIsActive, displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";

import { joinStakedMatch } from "@/lib/onchain/actions";
import { notifyHostOfJoin } from "@/lib/neynar.functions";
import { pushActivity } from "@/lib/activity";
import { PROD_ORIGIN } from "@/lib/config";
import {
  decodeMatch,
  ENTRY_FEE_USDC,
  requiresSeasonPass,
  formatAmount,
  modeLabel,
  potFor,
  saveActiveMatch,
  type MatchConfig,
} from "@/lib/game/match";
import { sfx } from "@/lib/sound";

const searchSchema = z.object({
  m: z.string().optional(),
});

export const Route = createFileRoute("/join-match")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Join Match — FarAction" },
      {
        name: "description",
        content:
          "Open a FarAction invite link, match the stake, and drop straight into the battle on Base.",
      },
      { property: "og:title", content: "Join Match — FarAction" },
      { property: "og:description", content: "Paste an invite link or code and join the bout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinMatch,
});

/**
 * Accepts anything a host can paste: a full invite link, an invite link with
 * the payload in the hash, or the raw join code copied from the match maker.
 */
function payloadFrom(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, "");
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("m");
    if (fromQuery) return fromQuery;
    const hash = new URLSearchParams(url.hash.replace(/^#/, "")).get("m");
    if (hash) return hash;
    return url.pathname.split("/").filter(Boolean).pop() ?? trimmed;
  } catch {
    return trimmed;
  }
}

function JoinMatch() {
  const { m } = Route.useSearch();
  const navigate = useNavigate();
  const { player, update } = usePlayer();
  const wallet = useTokenBalances();

  const [input, setInput] = useState(m ?? "");
  const [match, setMatch] = useState<MatchConfig | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!m) return;
    const decoded = decodeMatch(payloadFrom(m));
    if (decoded) {
      setMatch(decoded);
      sfx.bell();
    } else {
      setError("That invite link is not readable. Ask your friend to send it again.");
    }
  }, [m]);

  const lookup = () => {
    const decoded = decodeMatch(payloadFrom(input));
    if (!decoded) {
      setError("That invite link or code is not readable. Copy it again from the match maker.");
      setMatch(null);
      return;
    }
    setError("");
    setMatch(decoded);
    sfx.select();
  };

  const joining = useMutation({
    mutationFn: async (cfg: MatchConfig) => {
      // Step 2 of the payment flow: match the stake onchain. The entry fee is
      // charged in the lobby once both players are ready.
      if (cfg.staked) await joinStakedMatch(cfg.id);
    },
    onSuccess: () => {
      if (!match) return;
      sfx.coin();
      // The stake and fee moved onchain — refresh the wallet balances.
      void wallet.refetch();

      if (match.hostFid) {
        void notifyHostOfJoin({
          data: {
            matchId: match.id,
            joinerHandle: displayHandle(player),
            hostFid: match.hostFid,
          },
        });
      }
      saveActiveMatch({
        ...match,
        role: "joiner",
        joinerHandle: displayHandle(player),
        joinerFighterId: player.fighterId,
        paid: false,
      });
      pushActivity("win", `${displayHandle(player)} joined ${modeLabel(match.mode)} ${match.id}`);
      navigate({ to: "/lobby" });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not join this match."),
  });

  const join = () => {
    if (!match) return;
    if (requiresSeasonPass(match.mode) && !passIsActive(player)) {
      setError("Ranked Matches require an active Season Pass.");
      return;
    }
    const balance = match.token === "USDC" ? wallet.usdc : wallet.facts;
    if (match.staked && balance < match.stake) {
      setError(`You need ${formatAmount(match.stake, match.token)} to match this stake.`);
      return;
    }
    setError("");
    joining.mutate(match);
  };

  const host = match
    ? (CHARACTERS.find((c) => c.id === match.hostFighterId) ?? CHARACTERS[0]!)
    : null;
  const economics = match ? potFor(match) : null;

  return (
    <Screen
      title="Join Match"
      eyebrow="Invite link"
      heading="Join a battle"
      blurb="Someone opened a match and sent you the link. Match the stake and the pot locks — winner takes 90%."
      aside={
        <div className="space-y-2">
          {match && economics ? (
            <div className="panel space-y-1.5 p-4">
              <Row k="Match" v={match.id} />
              <Row k="Mode" v={modeLabel(match.mode)} />
              <Row k="Host" v={match.hostHandle} />
              <Row
                k="Stake each"
                v={match.staked ? formatAmount(match.stake, match.token) : "None"}
              />
              <Row k="Entry fee (at ready)" v={`${ENTRY_FEE_USDC.toFixed(2)} USDC`} />
              <Row
                k="Winner takes 90%"
                v={match.staked ? formatAmount(economics.winnerTake, match.token) : "Points only"}
                accent
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Paste the invite link your friend shared, or the match code (FAR0000000).
            </p>
          )}
          {error ? <p className="text-xs text-strike">{error}</p> : null}
          <button
            type="button"
            onClick={match ? join : lookup}
            disabled={joining.isPending}
            className="fa-btn w-full disabled:opacity-50"
          >
            {joining.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : match && requiresSeasonPass(match.mode) && !passIsActive(player) ? (
              <Lock className="size-4" />
            ) : match ? (
              <Swords className="size-4" />
            ) : (
              <LogIn className="size-4" />
            )}
            {match
              ? match.staked
                ? `Match ${formatAmount(match.stake, match.token)} & join`
                : "Join battle"
              : "Find match"}
          </button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4">
        <div>
          <p className="label-xs">Invite link or code</p>
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${PROD_ORIGIN}/invite/… or FA-XXXX-XX`}
              className="min-w-0 flex-1 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5 text-xs outline-none focus:border-accent"
            />
            <button type="button" onClick={lookup} className="fa-btn-ghost shrink-0">
              <Link2 className="size-4" /> Check
            </button>
          </div>
        </div>

        {match && host ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Card
              title={match.hostHandle}
              sub={`${host.name} · ${host.className}`}
              art={host.fullArt}
            />
            <span className="font-display text-2xl font-bold text-muted-foreground">VS</span>
            <Card
              title={displayHandle(player)}
              sub="You"
              art={(CHARACTERS.find((c) => c.id === player.fighterId) ?? CHARACTERS[0]!).fullArt}
            />
          </div>
        ) : (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border/70">
            <p className="text-xs text-muted-foreground">No match loaded yet</p>
          </div>
        )}
      </div>
    </Screen>
  );
}

function Card({ title, sub, art }: { title: string; sub: string; art: string }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-lg border border-accent/50 bg-card/40 p-3">
      <img
        loading="lazy"
        decoding="async"
        src={art}
        alt=""
        className="absolute inset-0 size-full object-cover object-top opacity-45"
      />
      <div className="relative flex h-full flex-col justify-end">
        <p className="truncate font-display text-sm font-bold">{title}</p>
        <p className="label-xs">{sub}</p>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label-xs">{k}</span>
      <span className={`font-display text-xs ${accent ? "text-facts" : ""}`}>{v}</span>
    </div>
  );
}
