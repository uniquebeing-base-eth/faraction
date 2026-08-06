import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Swords } from "lucide-react";
import { Screen } from "@/components/Screen";
import { decodeMatch, formatAmount, modeLabel, potFor } from "@/lib/game/match";

/**
 * Shareable landing for /invite/{id} and /match/{id}. It renders real HTML
 * (so casts and social crawlers get a card) and then hands the encoded match
 * payload to the join flow on the client.
 */
export function InviteHandoff({
  matchId,
  payload,
}: {
  matchId: string;
  payload?: string | undefined;
}) {
  const navigate = useNavigate();
  const match = payload ? decodeMatch(payload) : null;

  useEffect(() => {
    const t = window.setTimeout(() => {
      navigate({ to: "/join-match", search: payload ? { m: payload } : {} });
    }, 250);
    return () => window.clearTimeout(t);
  }, [navigate, payload]);

  const pot = match ? potFor(match) : null;

  return (
    <Screen
      title="Match Invite"
      eyebrow="Station · Invite"
      heading={`Match ${matchId}`}
      blurb={
        match
          ? `${modeLabel(match.mode)} opened by ${match.hostHandle}. Taking you to the join screen…`
          : "Opening this invite in the join screen…"
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
              <p className="font-display text-usdc">
                {formatAmount(pot.winnerTake, match.token)}
              </p>
            </div>
          </div>
        ) : null}
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Loading the join flow…
        </p>
      </div>
    </Screen>
  );
}
