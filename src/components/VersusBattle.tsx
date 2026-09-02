/**
 * Synchronised 1 vs 1 battle.
 *
 * Both players fight the *same* bout: each side reveals only their own card,
 * the slot resolves once both cards are face up, and the shared state
 * (round, reveal counters, round wins) lives in the database so neither player
 * is quietly playing against an AI.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Share2, Swords } from "lucide-react";
import { CARDS, CHARACTERS, randomFact, type Card } from "@/lib/game/gameData";
import { resolveRound, type SlotResult } from "@/lib/game/combatEngine";
import { usePlayer, displayHandle } from "@/lib/game/store";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";
import { ArenaStage } from "@/components/ArenaStage";
import { BattleCard, Combatant, withSeededRandom } from "@/components/BattleStage";
import { sfx } from "@/lib/sound";
import { battleShareImage, shareCast } from "@/lib/share";
import { matchUrl } from "@/lib/config";
import { recordBattleOutcome } from "@/lib/battle.functions";
import {
  advanceMatchRound,
  fetchMatch,
  revealMatchSlot,
  settleStakedMatch,
  updateMatchStatus,
} from "@/lib/matches.functions";
import {
  clearActiveMatch,
  formatAmount,
  potFor,
  saveActiveMatch,
  type ActiveMatch,
  type MatchRecord,
} from "@/lib/game/match";
import type { ArenaId } from "@/lib/game/arenas";

const ROUNDS_TO_WIN = 2;

export function VersusBattle({ match }: { match: ActiveMatch }) {
  const navigate = useNavigate();
  const { player, update } = usePlayer();
  const isHost = match.role === "host";

  const resolve = useServerFn(fetchMatch);
  const reveal = useServerFn(revealMatchSlot);
  const advance = useServerFn(advanceMatchRound);
  const settle = useServerFn(settleStakedMatch);
  const setStatus = useServerFn(updateMatchStatus);

  const live = useQuery({
    queryKey: ["versus", match.id],
    refetchInterval: 2_000,
    queryFn: () => resolve({ data: { matchId: match.id } }),
  });
  const row = live.data as unknown as MatchRecord | null | undefined;

  const [ended, setEnded] = useState<null | { won: boolean; fp: number; payout: string | null }>(
    null,
  );
  const [fact, setFact] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const settled = useRef(false);
  const lastOppReveal = useRef(0);
  const [oppJustRevealed, setOppJustRevealed] = useState(false);

  const hostDeck = useDeck(row?.host_deck, match.hostDeck);
  const joinerDeck = useDeck(row?.joiner_deck, match.joinerDeck);

  const hostChar =
    CHARACTERS.find((c) => c.id === (row?.host_fighter_id ?? match.hostFighterId)) ?? CHARACTERS[0]!;
  const joinerChar =
    CHARACTERS.find((c) => c.id === (row?.joiner_fighter_id ?? match.joinerFighterId)) ??
    CHARACTERS.find((c) => c.id !== hostChar.id) ??
    CHARACTERS[1]!;

  const hostOrder = useCards(hostDeck);
  const joinerOrder = useCards(joinerDeck);

  const round = Math.min(Math.max(row?.round ?? 1, 1), 3);
  const hostRevealed = row?.host_revealed ?? 0;
  const joinerRevealed = row?.joiner_revealed ?? 0;
  const hostWins = row?.host_round_wins ?? 0;
  const joinerWins = row?.joiner_round_wins ?? 0;

  const ready = hostOrder.length === 5 && joinerOrder.length === 5;

  /** Resolved from the host's point of view, deterministically on both devices. */
  const slots = useMemo<SlotResult[]>(() => {
    if (!ready) return [];
    return withSeededRandom(`${match.id}:${round}`, () =>
      resolveRound(hostOrder, joinerOrder, hostChar, joinerChar),
    ).slots;
  }, [ready, match.id, round, hostOrder, joinerOrder, hostChar, joinerChar]);

  const resolved = Math.min(hostRevealed, joinerRevealed, slots.length);
  const myRevealed = isHost ? hostRevealed : joinerRevealed;
  const theirRevealed = isHost ? joinerRevealed : hostRevealed;
  const myTurn = myRevealed === resolved && resolved < 5;

  const meChar = isHost ? hostChar : joinerChar;
  const themChar = isHost ? joinerChar : hostChar;
  const myOrder = isHost ? hostOrder : joinerOrder;
  const theirOrder = isHost ? joinerOrder : hostOrder;
  const myName = displayHandle(player);
  const theirName =
    (isHost ? (row?.joiner_handle ?? match.joinerHandle) : (row?.host_handle ?? match.hostHandle)) ??
    "Challenger";

  // Running knock for the current round.
  const done = slots.slice(0, resolved);
  const hostKnock = done.reduce((a, s) => a + s.playerKnock, 0);
  const joinerKnock = done.reduce((a, s) => a + s.opponentKnock, 0);
  const myKnock = isHost ? hostKnock : joinerKnock;
  const theirKnock = isHost ? joinerKnock : hostKnock;
  const totalKnock = hostKnock + joinerKnock || 1;

  const currentIdx = Math.min(resolved, 4);
  const displayIdx = resolved > 0 && myRevealed === theirRevealed ? Math.min(resolved - 1, 4) : currentIdx;
  const lastSlot = resolved > 0 ? slots[resolved - 1] : undefined;
  const myLastWin = lastSlot ? (isHost ? lastSlot.winner === "player" : lastSlot.winner === "opponent") : false;

  // Announce the opponent's reveal.
  useEffect(() => {
    if (theirRevealed > lastOppReveal.current) {
      lastOppReveal.current = theirRevealed;
      if (theirRevealed > 0) {
        setOppJustRevealed(true);
        sfx.flip();
        const t = setTimeout(() => setOppJustRevealed(false), 2500);
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [theirRevealed]);

  const revealNext = useMutation({
    mutationFn: () => reveal({ data: { matchId: match.id, role: match.role, slot: myRevealed + 1 } }),
    onSuccess: () => {
      sfx.flip();
      void live.refetch();
    },
  });

  // Round bookkeeping — the host owns the transition so the round never
  // double-advances when both clients poll at once.
  const roundOver = ready && resolved === 5;
  const roundHostWon = roundOver && hostKnock > joinerKnock;
  const roundJoinerWon = roundOver && joinerKnock > hostKnock;
  const nextHostWins = hostWins + (roundHostWon ? 1 : 0);
  const nextJoinerWins = joinerWins + (roundJoinerWon ? 1 : 0);
  const matchOver =
    roundOver && (nextHostWins >= ROUNDS_TO_WIN || nextJoinerWins >= ROUNDS_TO_WIN || round === 3);

  useEffect(() => {
    if (!roundOver || matchOver || !isHost) return;
    const t = setTimeout(() => {
      void advance({
        data: { matchId: match.id, hostWins: nextHostWins, joinerWins: nextJoinerWins },
      })
        .then(() => live.refetch())
        .catch(() => undefined);
    }, 3_000);
    return () => clearTimeout(t);
  }, [roundOver, matchOver, isHost, advance, match.id, nextHostWins, nextJoinerWins, live]);

  // Settle the bout once, locally, for whichever side is looking at it.
  useEffect(() => {
    if (!matchOver || settled.current) return;
    settled.current = true;
    const iWon = isHost ? nextHostWins > nextJoinerWins : nextJoinerWins > nextHostWins;
    const myRounds = isHost ? nextHostWins : nextJoinerWins;
    const gained = Math.round(iWon ? 100 + myRounds * 50 : 10);
    let payout: string | null = null;
    if (match.staked) {
      const { winnerTake } = potFor(match);
      payout = iWon
        ? `Pot claimed · ${formatAmount(winnerTake, match.token)}`
        : `Stake lost · ${formatAmount(match.stake, match.token)}`;
    }
    update((p) => ({
      fp: p.fp + gained,
      wins: p.wins + (iWon ? 1 : 0),
      losses: p.losses + (iWon ? 0 : 1),
    }));
    setFact(randomFact());
    setEnded({ won: iWon, fp: gained, payout });
    if (iWon) sfx.win();
    else sfx.lose();

    if (match.staked) {
      const winnerWallet =
        isHost
          ? (nextHostWins > nextJoinerWins ? row?.host_wallet : row?.joiner_wallet)
          : (nextJoinerWins > nextHostWins ? row?.joiner_wallet : row?.host_wallet);

      if (!winnerWallet) {
        console.error("Could not settle staked match: missing winner wallet on record.");
      } else {
        void settle({ data: { matchId: match.id, winnerWallet } }).catch(() => undefined);
      }
    } else if (isHost) {
      void setStatus({ data: { matchId: match.id, status: "complete" } }).catch(() => undefined);
    }

    // Persist the result so FP, wins and losses survive a reload and the daily
    // $FACTS claim can read the points.
    const myWallet = (isHost ? row?.host_wallet : row?.joiner_wallet) ?? null;
    if (myWallet) {
      void recordBattleOutcome({
        data: {
          wallet: myWallet,
          handle: displayHandle(player),
          fp: gained,
          won: iWon,
          ranked: !match.staked && match.mode === "ranked",
          tp: 0,
          matchId: match.id,
          fid: player.fid ?? null,
          opponentHandle: isHost ? (row?.joiner_handle ?? null) : (row?.host_handle ?? null),
          opponentFid: isHost ? (row?.joiner_fid ?? null) : (row?.host_fid ?? null),
          payout,
        },
      }).catch(() => undefined);
    }
    clearActiveMatch();
  }, [matchOver, isHost, nextHostWins, nextJoinerWins, match, row, update, settle, setStatus, player]);

  // Keep the local record fresh so a refresh mid-battle restores the bout.
  useEffect(() => {
    if (!row || ended) return;
    saveActiveMatch({ ...match, hostDeck, joinerDeck, ...(row.arena ? { arena: row.arena } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.match_id, row?.round]);

  const arena = (row?.arena ?? match.arena ?? "nexus") as ArenaId;
  const economics = match.staked ? potFor(match) : null;

  if (!ready) {
    return (
      <main className="fa-screen">
        <GameWorld dim={0.5} />
        <TopBar title="1 vs 1 · Preparing" back="/lobby" />
        <div className="absolute inset-0 z-20 grid place-items-center px-8">
          <div className="panel max-w-md space-y-3 p-8 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-accent" />
            <p className="font-display text-lg font-bold">Waiting for both loadouts</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Each fighter picks their own character and their own five cards. Once
              {" "}@{theirName.replace(/^@/, "")} locks theirs, the bout begins.
            </p>
            <Link to="/select-fighter" className="fa-btn w-full">
              Edit my loadout
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fa-screen">
      <ArenaStage arena={arena} />
      <TopBar title={`1 vs 1 · Round ${round} / 3`} back="/lobby" />

      <Combatant
        character={meChar}
        name={myName}
        side="left"
        hit={Boolean(lastSlot) && !myLastWin && lastSlot!.winner !== "draw"}
        knock={myKnock}
        share={(myKnock / totalKnock) * 100}
      />
      <Combatant
        character={themChar}
        name={`@${theirName.replace(/^@/, "")}`}
        side="right"
        hit={Boolean(lastSlot) && myLastWin}
        knock={theirKnock}
        share={(theirKnock / totalKnock) * 100}
      />

      <div className="absolute top-16 left-1/2 z-20 -translate-x-1/2 text-center">
        <div className="panel px-7 py-2.5">
          <p className="label-xs">Rounds</p>
          <p className="font-display text-3xl leading-none font-bold">
            <span style={{ color: meChar.color }}>{isHost ? hostWins : joinerWins}</span>
            <span className="mx-2 text-muted-foreground">—</span>
            <span style={{ color: themChar.color }}>{isHost ? joinerWins : hostWins}</span>
          </p>
        </div>
        {economics ? (
          <p className="label-xs mt-1.5 text-facts">
            Pot {formatAmount(economics.pot, match.token)} · winner takes{" "}
            {formatAmount(economics.winnerTake, match.token)}
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[32%] z-20 flex flex-col items-center gap-3 px-8">
        <div className="flex items-center gap-6">
          <BattleCard
            card={myOrder[displayIdx]}
            colour={meChar.color}
            side="left"
            hidden={myRevealed <= displayIdx}
          />
          <div className="text-center">
            <p className="font-display text-3xl leading-none font-bold text-accent">VS</p>
            <p className="label-xs mt-1">Slot {Math.min(displayIdx + 1, 5)} / 5</p>
          </div>
          <BattleCard
            card={theirOrder[displayIdx]}
            colour={themChar.color}
            side="right"
            hidden={theirRevealed <= displayIdx}
          />
        </div>

        <div className="panel w-[560px] p-3 text-center">
          <p className="label-xs text-accent">
            {matchOver
              ? "Bout complete"
              : roundOver
                ? isHost
                  ? "Round over · next round starting"
                  : `Round over · waiting for @${(row?.host_handle ?? match.hostHandle).replace(/^@/, "")}`
                : myTurn
                  ? `Your move — reveal slot ${myRevealed + 1}`
                  : `Waiting for @${theirName.replace(/^@/, "")} to make their move…`}
          </p>
          {oppJustRevealed && !roundOver ? (
            <p className="mt-1 text-sm text-facts">
              @{theirName.replace(/^@/, "")} revealed their card.
            </p>
          ) : null}
          {lastSlot ? (
            <>
              <p className="mt-1.5 text-sm leading-relaxed">{lastSlot.description}</p>
              <div className="mt-2 flex justify-center gap-4 font-display text-[12px]">
                <span className="text-strike">
                  You +{isHost ? lastSlot.playerKnock : lastSlot.opponentKnock}
                </span>
                <span className="text-defense">
                  Them +{isHost ? lastSlot.opponentKnock : lastSlot.playerKnock}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Reveal your card. The exchange only resolves when both fighters have committed.
            </p>
          )}
        </div>
      </div>

      {ended ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="panel animate-slam w-[520px] space-y-2 p-8 text-center">
            <p className="font-display text-5xl font-bold tracking-tight">
              {ended.won ? "VICTORY" : "DEFEAT"}
            </p>
            <p className="font-display text-lg text-accent">+{ended.fp} FP</p>
            <p className="text-sm text-muted-foreground">
              {ended.won
                ? `You defeated @${theirName.replace(/^@/, "")}`
                : `@${theirName.replace(/^@/, "")} took the bout`}
            </p>
            {ended.payout ? <p className="label-xs text-accent">{ended.payout}</p> : null}
            <p className="label-xs pt-3">Base fact unlocked</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{fact}</p>
            <button
              type="button"
              onClick={() => {
                sfx.tap();
                setShared(true);
                const opp = theirName.replace(/^@/, "");
                const me = myName.replace(/^@/, "");
                void shareCast(
                  ended.won
                    ? `I defeated @${opp} in FarAction. ⚔️`
                    : `I lost to @${opp} in FarAction. ⚔️`,
                  matchUrl(match.id),
                  battleShareImage({
                    kind: "result",
                    matchId: match.id,
                    mode: "1v1",
                    hostHandle: me,
                    opponentHandle: opp,
                    winnerHandle: ended.won ? me : opp,
                    loserHandle: ended.won ? opp : me,
                    reward: ended.fp,
                  }),
                );
              }}
              className="fa-btn mt-4 w-full"
            >
              <Share2 className="size-4" /> {shared ? "Shared to Farcaster" : "Share result"}
            </button>
            <div className="flex gap-3 pt-4">
              <Link to="/create-match" className="fa-btn flex-1">
                New match
              </Link>
              <button type="button" onClick={() => navigate({ to: "/" })} className="fa-btn-ghost flex-1">
                Home
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-5 border-t border-border/60 bg-background/85 px-8 py-3 backdrop-blur-md">
        <div className="flex flex-1 gap-2.5">
          {myOrder.map((card, i) => {
            const mine = i < myRevealed;
            const open = i < resolved;
            return (
              <div
                key={i}
                className={`flex h-16 flex-1 flex-col items-center justify-center rounded-lg border text-center transition-all ${
                  mine ? "animate-slam border-accent/70 bg-accent/10" : "border-border/70 bg-card/40"
                }`}
              >
                <span className="label-xs">S{i + 1}</span>
                <span className="px-2 font-display text-[12px] leading-tight">
                  {mine ? card.name : "?"}
                </span>
                {open ? (
                  <span className="font-display text-[11px] text-strike">
                    +{(isHost ? slots[i]?.playerKnock : slots[i]?.opponentKnock) ?? 0}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {!ended ? (
          <button
            type="button"
            disabled={!myTurn || revealNext.isPending}
            onClick={() => revealNext.mutate()}
            className="fa-btn w-64 shrink-0 disabled:opacity-40"
          >
            {revealNext.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Swords className="size-4" />
            )}
            {myTurn
              ? `Reveal slot ${myRevealed + 1}`
              : roundOver
                ? "Round over"
                : `Waiting for @${theirName.replace(/^@/, "")}`}
          </button>
        ) : null}
      </div>
    </main>
  );
}

function useDeck(remote: unknown, local: string[] | undefined): string[] {
  return useMemo(() => {
    const fromRemote = Array.isArray(remote)
      ? (remote as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    return fromRemote.length ? fromRemote : (local ?? []);
  }, [remote, local]);
}

function useCards(deck: string[]): Card[] {
  return useMemo(
    () => deck.map((id) => CARDS.find((c) => c.id === id)).filter(Boolean) as Card[],
    [deck],
  );
}
