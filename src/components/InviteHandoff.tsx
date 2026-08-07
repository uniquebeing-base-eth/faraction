import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Swords } from "lucide-react";
import { Screen } from "@/components/Screen";
import { fetchMatch } from "@/lib/matches.functions";
import {
  configFromRecord,
  decodeMatch,
  formatAmount,
  loadActiveMatch,
  modeLabel,
  potFor,
  type MatchConfig,
  type MatchRecord,
} from "@/lib/game/match";

/**
 * Shareable landing for /invite/{id} and /match/{id}. It renders real HTML
 * (so casts and social crawlers get a card) and then deep-links straight into
 * the pending match: the lobby when this player is already in the bout, the
 * join screen otherwise.
 */
export function InviteHandoff({
  matchId,
  payload,
}: {
  matchId: string;
  payload?: string | undefined;
}) {
  const navigate = useNavigate();
  const resolve = useServerFn(fetchMatch);

  // The short code is the durable handle on a match; the encoded payload is
  // only a legacy fallback for links cast before short invites shipped.
  const lookup = useQuery({
    queryKey: ["invite-match", matchId],
    queryFn: () => resolve({ data: { matchId } }),
    retry: 1,
  });

  const record = lookup.data as unknown as MatchRecord | null | undefined;
  const match: MatchConfig | null = record
    ? configFromRecord(record)
    : payload
      ? decodeMatch(payload)
      : null;

  useEffect(() => {
    if (lookup.isLoading) return;
    // Already part of this bout (host, or joined earlier)? Go to the lobby.
    const active = loadActiveMatch();
    if (active && active.id.toUpperCase() === matchId.toUpperCase()) {
      void navigate({ to: "/lobby" });
      return;
    }
    void navigate({
      to: "/join-match",
      search: { code: matchId, ...(payload ? { m: payload } : {}) },
    });
  }, [navigate, payload, matchId, lookup.isLoading]);

  const pot = match ? potFor(match) : null;

  return (
    <Screen
      title="Match Invite"
      eyebrow="Station · Invite"
      heading={`Match ${matchId}`}
      blurb={
        match
          ? `${modeLabel(match.mode)} opened by ${match.hostHandle}. Taking you to the bout…`
          : "Opening this invite…"
      }
    >
      <div className="panel flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Swords className="size-4 text-accent" />
          <span className="font-display">{match ? modeLabel(match.mode) : "1 vs 1"}</span>
        </div>
        {match?.staked && pot ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="label-xs">Stake each</p>
              <p className="font-display text-facts">{formatAmount(match.stake, match.token)}</p>
            </div>
            <div>
              <p className="label-xs">Winner takes</p>
              <p className="font-display text-usdc">{formatAmount(pot.winnerTake, match.token)}</p>
            </div>
          </div>
        ) : null}
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Opening the bout…
        </p>
      </div>
    </Screen>
  );
}
