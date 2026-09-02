import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CARDS, CHARACTERS, randomFact, type Card, type Character } from "@/lib/game/gameData";
import { generateAIOrder, resolveRound, type SlotResult } from "@/lib/game/combatEngine";
import { usePlayer, displayHandle } from "@/lib/game/store";
import { useWallet } from "@/lib/onchain/wallet";
import { recordRankedResult } from "@/lib/rank.functions";
import { battleShareImage, shareCast } from "@/lib/share";
import { PROD_ORIGIN } from "@/lib/config";
import {
  clearActiveMatch,
  formatAmount,
  loadActiveMatch,
  modeLabel,
  potFor,
  type ActiveMatch,
} from "@/lib/game/match";
import { sfx } from "@/lib/sound";
import { Share2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";
import { VersusBattle } from "@/components/VersusBattle";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Arena Match — FarAction" },
      {
        name: "description",
        content: "Reveal your five slots card-for-card against your rival and stack FACTS on Base.",
      },
      { property: "og:title", content: "Arena Match — FarAction" },
      { property: "og:description", content: "Slot-by-slot card combat in the FarAction arena." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Play,
});

type Phase = "ready" | "revealing" | "round-end" | "match-end";

function Play() {
  const [routed, setRouted] = useState<ActiveMatch | null | undefined>(undefined);

  useEffect(() => {
    setRouted(loadActiveMatch());
  }, []);

  if (routed === undefined) return null;
  // A 1 vs 1 bout is a real shared battle, not a solo run against the engine.
  if (routed && (routed.mode === "1v1" || routed.mode === "ranked")) return <VersusBattle match={routed} />;
  return <SoloBattle />;
}

function SoloBattle() {
  const { player, update, hydrated } = usePlayer();
  const { address } = useWallet();
  const navigate = useNavigate();
  const [match, setMatch] = useState<ActiveMatch | null>(null);

  useEffect(() => {
    setMatch(loadActiveMatch());
  }, []);

  const friendlyMatch = match?.mode === "1v1";
  const localRole = friendlyMatch ? match.role : "host";
  const localFighterId = friendlyMatch
    ? (localRole === "host" ? match.hostFighterId : match.joinerFighterId ?? player.fighterId)
    : player.fighterId;
  const opponentFighterId = friendlyMatch
    ? (localRole === "host" ? match.joinerFighterId ?? match.hostFighterId : match.hostFighterId)
    : null;
  const localDeck = friendlyMatch
    ? (localRole === "host" ? (match.hostDeck ?? player.deck) : (match.joinerDeck ?? player.deck))
    : player.deck;
  const opponentDeck = friendlyMatch
    ? (localRole === "host" ? (match.joinerDeck ?? []) : (match.hostDeck ?? []))
    : [];

  const fighter = CHARACTERS.find((c) => c.id === localFighterId) ?? CHARACTERS[0]!;
  const opponent = useMemo(
    () =>
      friendlyMatch
        ? (CHARACTERS.find((c) => c.id === opponentFighterId) ?? CHARACTERS.find((c) => c.id !== fighter.id) ?? CHARACTERS[1]!)
        : (() => {
            const pool = CHARACTERS.filter((c) => c.id !== fighter.id);
            return pool[Math.floor(Math.random() * pool.length)] ?? CHARACTERS[1]!;
          })(),
    [fighter.id, friendlyMatch, opponentFighterId],
  );

  const playerOrder = useMemo<Card[]>(
    () => localDeck.map((id) => CARDS.find((c) => c.id === id)).filter(Boolean) as Card[],
    [localDeck],
  );
  const opponentOrder = useMemo<Card[]>(
    () => opponentDeck.map((id) => CARDS.find((c) => c.id === id)).filter(Boolean) as Card[],
    [opponentDeck],
  );

  const [round, setRound] = useState(1);
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [phase, setPhase] = useState<Phase>("ready");
  const [slots, setSlots] = useState<SlotResult[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [knock, setKnock] = useState({ player: 0, opponent: 0 });
  const [aiOrder, setAiOrder] = useState<Card[]>([]);
  const [fact, setFact] = useState<string | null>(null);
  const [reward, setReward] = useState<{
    fp: number;
    usdc: number;
    payout: string | null;
  } | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!match) return;
    if (match.mode === "1v1" && !(match.hostReady && match.joinerReady)) {
      navigate({ to: "/lobby" });
      return;
    }
    if (hydrated && playerOrder.length !== 5) navigate({ to: "/loadout" });
  }, [hydrated, match, navigate, playerOrder.length]);

  const opponentName =
    match?.mode === "1v1"
      ? match.role === "host"
        ? (match.joinerHandle ?? "Challenger")
        : match.hostHandle
      : "The House";

  const startRound = useCallback(() => {
    const ai = friendlyMatch && opponentOrder.length === 5
      ? opponentOrder
      : (generateAIOrder(opponent, fighter, match?.difficulty ?? 2, {
          playerOrder,
          playerRoundsWon: score.player,
          opponentRoundsWon: score.opponent,
        }) as Card[]);
    const result = resolveRound(playerOrder, ai, fighter, opponent);
    setAiOrder(ai);
    setSlots(result.slots);
    setRevealed(0);
    setKnock({ player: 0, opponent: 0 });
    setPhase("revealing");
    sfx.bell();
  }, [fighter, friendlyMatch, opponent, opponentOrder, playerOrder, score.opponent, score.player, match?.difficulty]);

  const revealNext = useCallback(() => {
    if (revealed >= slots.length) return;
    const s = slots[revealed]!;
    if (s.winner === "player") sfx.hit();
    else if (s.winner === "opponent") sfx.block();
    else sfx.clash();
    setKnock((k) => ({ player: k.player + s.playerKnock, opponent: k.opponent + s.opponentKnock }));
    const next = revealed + 1;
    setRevealed(next);
    if (next === slots.length) {
      const totalP = slots.reduce((a, x) => a + x.playerKnock, 0);
      const totalO = slots.reduce((a, x) => a + x.opponentKnock, 0);
      const won = totalP > totalO;
      const nextScore = {
        player: score.player + (won ? 1 : 0),
        opponent: score.opponent + (!won && totalO > totalP ? 1 : 0),
      };
      setScore(nextScore);
      if (nextScore.player === 2 || nextScore.opponent === 2 || round === 3) {
        const matchWon = nextScore.player > nextScore.opponent;
        // Battles pay Facts Points (FP), never raw FACTS.
        const gained = matchWon ? 100 + nextScore.player * 50 : 10;
        let usdc = matchWon ? 0.25 : 0;
        let potFp = 0;
        let payoutLabel: string | null = null;

        // Staked pot settlement — winner takes 90%, platform keeps 10%.
        if (match?.staked) {
          const { winnerTake } = potFor(match);
          if (matchWon) {
            if (match.token === "USDC") usdc += winnerTake;
            else potFp += winnerTake;
            payoutLabel = `Pot claimed · ${formatAmount(winnerTake, match.token)}`;
          } else {
            payoutLabel = `Stake lost · ${formatAmount(match.stake, match.token)}`;
          }
        }

        const fpGained = Math.round(gained + potFp);
        const ranked = match?.mode === "ranked";
        setReward({ fp: fpGained, usdc, payout: payoutLabel });
        setFact(randomFact());
        update((p) => ({
          fp: p.fp + fpGained,
          rankedFp: p.rankedFp + (ranked ? fpGained : 0),
          wins: p.wins + (matchWon ? 1 : 0),
          losses: p.losses + (matchWon ? 0 : 1),
          houseStreak: matchWon ? p.houseStreak + 1 : 0,
        }));
        // Every bout is written to the database, so FP, wins and streaks
        // survive a reload and the daily $FACTS claim can see the points.
        if (address) {
          void recordBattleOutcome({
            data: {
              wallet: address,
              handle: displayHandle(player),
              fp: fpGained,
              won: matchWon,
              ranked,
              tp: 0,
            },
          }).catch(() => undefined);
        }
        clearActiveMatch();
        setPhase("match-end");
        if (matchWon) sfx.win();
        else sfx.lose();
      } else {
        setPhase("round-end");
      }
    }
  }, [revealed, slots, score, round, update, match, address, player]);

  const currentSlot = revealed > 0 ? slots[revealed - 1] : undefined;
  const total = knock.player + knock.opponent || 1;
  const playerHit = currentSlot?.winner === "opponent";
  const opponentHit = currentSlot?.winner === "player";

  const playerCard = playerOrder[Math.max(revealed - 1, 0)];
  const oppCard = aiOrder[Math.max(revealed - 1, 0)];
  const showCards = revealed > 0 && phase !== "ready";
  const economics = match?.staked ? potFor(match) : null;

  return (
    <main className="fa-screen">
      <GameWorld dim={0.4} />
      <TopBar title={`${match ? `${modeLabel(match.mode)} · ` : ""}Round ${round} / 3`} back="/" />

      {/* Combatants — always on stage */}
      <Combatant
        character={fighter}
        name={displayHandle(player)}
        side="left"
        hit={playerHit}
        knock={knock.player}
        share={(knock.player / total) * 100}
      />
      <Combatant
        character={opponent}
        name={opponentName}
        side="right"
        hit={opponentHit}
        knock={knock.opponent}
        share={(knock.opponent / total) * 100}
      />

      {/* Score plaque + pot */}
      <div className="absolute top-16 left-1/2 z-20 -translate-x-1/2 text-center">
        <div className="panel px-7 py-2.5">
          <p className="label-xs">Rounds</p>
          <p className="font-display text-3xl leading-none font-bold">
            <span style={{ color: fighter.color }}>{score.player}</span>
            <span className="mx-2 text-muted-foreground">—</span>
            <span style={{ color: opponent.color }}>{score.opponent}</span>
          </p>
        </div>
        {economics && match ? (
          <p className="label-xs mt-1.5 text-facts">
            Pot {formatAmount(economics.pot, match.token)} · winner takes{" "}
            {formatAmount(economics.winnerTake, match.token)}
          </p>
        ) : null}
      </div>

      {/* Centre stage — the card versus board, always visible */}
      <div className="pointer-events-none absolute inset-x-0 top-[32%] z-20 flex flex-col items-center gap-3 px-8">
        <div className="flex items-center gap-6">
          <BattleCard
            card={showCards ? playerCard : undefined}
            colour={fighter.color}
            side="left"
          />
          <div className="text-center">
            <p className="font-display text-3xl leading-none font-bold text-accent">VS</p>
            <p className="label-xs mt-1">Slot {Math.max(revealed, 1)} / 5</p>
          </div>
          <BattleCard card={showCards ? oppCard : undefined} colour={opponent.color} side="right" />
        </div>

        {currentSlot ? (
          <div key={revealed} className="panel animate-slam w-[560px] p-3 text-center">
            <p className="label-xs text-accent">
              {currentSlot.winner === "player"
                ? "You win the exchange"
                : currentSlot.winner === "opponent"
                  ? `${opponentName} wins the exchange`
                  : "Clash"}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed">{currentSlot.description}</p>
            <div className="mt-2 flex justify-center gap-4 font-display text-[11px]">
              <span className="text-strike">You +{currentSlot.playerKnock}</span>
              <span className="text-defense">Them +{currentSlot.opponentKnock}</span>
            </div>
          </div>
        ) : (
          <p className="label-xs">Reveal your sequence slot by slot</p>
        )}
      </div>

      {/* Match end overlay */}
      {phase === "match-end" && reward ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="panel animate-slam w-[520px] space-y-2 p-8 text-center">
            <p className="font-display text-5xl font-bold tracking-tight">
              {score.player > score.opponent ? "VICTORY" : "DEFEAT"}
            </p>
            <p className="font-display text-lg text-accent">+{reward.fp} FP</p>
            <p className="label-xs text-muted-foreground">
              {match?.mode === "ranked"
                ? "Ranked Facts Points · counted on the Season leaderboard"
                : "Facts Points · Ranked FP is what the leaderboard counts"}
            </p>
            {reward.usdc > 0 ? (
              <p className="font-display text-base text-usdc">+{reward.usdc.toFixed(2)} USDC</p>
            ) : null}
            {reward.payout ? (
              <p className="label-xs text-accent">{reward.payout} · platform fee 10%</p>
            ) : null}
            <p className="label-xs pt-3">Base fact unlocked</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{fact}</p>
            <button
              type="button"
              onClick={() => {
                sfx.tap();
                setShared(true);
                void shareCast(
                  `${score.player > score.opponent ? "Victory" : "Fought hard"} in the FarAction arena — +${reward.fp} FP as ${fighter.name}. Come take me on ⚔️`,
                  PROD_ORIGIN,
                );
              }}
              className="fa-btn mt-4 w-full"
            >
              <Share2 className="size-4" /> {shared ? "Shared to Farcaster" : "Share to Farcaster"}
            </button>
            <div className="flex gap-3 pt-4">
              <Link to="/create-match" className="fa-btn flex-1">
                New match
              </Link>
              <Link to="/" className="fa-btn-ghost flex-1">
                Home
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Slot rail + controls */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-5 border-t border-border/60 bg-background/85 px-8 py-3 backdrop-blur-md">
        <div className="flex flex-1 gap-2.5">
          {playerOrder.map((card, i) => {
            const isOpen = i < revealed;
            return (
              <div
                key={i}
                className={`flex h-16 flex-1 flex-col items-center justify-center rounded-lg border text-center transition-all ${
                  isOpen
                    ? "animate-slam border-accent/70 bg-accent/10"
                    : "border-border/70 bg-card/40"
                }`}
              >
                <span className="label-xs">S{i + 1}</span>
                <span className="px-2 font-display text-[11px] leading-tight">
                  {isOpen ? card.name : "?"}
                </span>
                {isOpen ? (
                  <span className="font-display text-[10px] text-strike">
                    +{slots[i]?.playerKnock ?? 0}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {phase !== "match-end" ? (
          <div className="flex shrink-0 gap-2.5">
            {phase === "ready" ? (
              <button type="button" onClick={startRound} className="fa-btn w-56">
                Start round {round}
              </button>
            ) : null}
            {phase === "revealing" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    sfx.flip();
                    revealNext();
                  }}
                  className="fa-btn w-56"
                >
                  Reveal slot {revealed + 1}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    let i = revealed;
                    const tick = () => {
                      if (i >= slots.length) return;
                      sfx.flip();
                      revealNext();
                      i += 1;
                      setTimeout(tick, 550);
                    };
                    tick();
                  }}
                  className="fa-btn-ghost"
                >
                  Auto
                </button>
              </>
            ) : null}
            {phase === "round-end" ? (
              <button
                type="button"
                onClick={() => {
                  sfx.select();
                  setRound((r) => r + 1);
                  setPhase("ready");
                  setSlots([]);
                  setRevealed(0);
                  setKnock({ player: 0, opponent: 0 });
                }}
                className="fa-btn w-56"
              >
                Next round
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** The played card for one side of the centre versus board. */
function BattleCard({
  card,
  colour,
  side,
}: {
  card: Card | undefined;
  colour: string;
  side: "left" | "right";
}) {
  return (
    <div
      key={card?.id ?? `empty-${side}`}
      className={`relative h-40 w-32 overflow-hidden rounded-xl border-2 bg-card/70 backdrop-blur-md ${
        card ? "animate-slam" : "border-dashed"
      }`}
      style={{ borderColor: card ? colour : undefined }}
    >
      {card ? (
        <>
          <img
            loading="lazy"
            decoding="async"
            src={card.image}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="relative flex h-full flex-col justify-between p-2 text-center">
            <span className="label-xs" style={{ color: colour }}>
              {card.type}
            </span>
            <div>
              <p className="font-display text-[12px] leading-tight font-bold">{card.name}</p>
              <div className="mt-1 flex justify-center gap-2 font-display text-[10px]">
                <span className="text-strike">KNK {card.knock}</span>
                <span className="text-defense">PRI {card.priority}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid h-full place-items-center">
          <span className="font-display text-3xl text-muted-foreground">?</span>
        </div>
      )}
    </div>
  );
}

function Combatant({
  character,
  name,
  side,
  hit,
  knock,
  share,
}: {
  character: Character;
  name: string;
  side: "left" | "right";
  hit: boolean;
  knock: number;
  share: number;
}) {
  const isLeft = side === "left";
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-[5] w-[440px] ${
        isLeft ? "left-0" : "right-0"
      } ${hit ? "animate-shake" : ""}`}
    >
      <div className="fa-pedestal absolute inset-x-0 bottom-16 h-44" />
      <img
        loading="lazy"
        decoding="async"
        src={character.fullArt}
        alt={character.name}
        className="fa-art absolute bottom-16 h-[600px] object-contain object-bottom"
        style={{
          [isLeft ? "left" : "right"]: "40px",
          transform: isLeft ? undefined : "scaleX(-1)",
        }}
      />
      <div
        className={`absolute top-20 z-10 w-[300px] ${isLeft ? "left-8 text-left" : "right-8 text-right"}`}
      >
        <p className="label-xs" style={{ color: character.color }}>
          {character.name} · {character.className}
        </p>
        <p className="truncate font-display text-xs text-muted-foreground">{name}</p>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-border/70 bg-secondary">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isLeft ? "" : "ml-auto"}`}
            style={{ width: `${share}%`, background: character.color }}
          />
        </div>
        <p className="mt-1 font-display text-sm font-bold">{knock} KNOCK</p>
      </div>
    </div>
  );
}
