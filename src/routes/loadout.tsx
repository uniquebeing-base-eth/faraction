import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/onchain/wallet";
import { listFighterEnergy } from "@/lib/energy.functions";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { CARDS, CHARACTERS } from "@/lib/game/gameData";
import { calcEnergyPool } from "@/lib/game/combatEngine";
import { getStarterArchetypes } from "@/lib/game/archetypes";
import { usePlayer, displayHandle } from "@/lib/game/store";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";
import { CardTile } from "@/components/CardTile";
import {
  ENTRY_FEE_USDC,
  loadActiveMatch,
  newMatchId,
  saveActiveMatch,
  type MatchRecord,
} from "@/lib/game/match";
import { chargeEntryFee } from "@/lib/payment-flows";
import { setMatchLoadout } from "@/lib/matches.functions";

export const Route = createFileRoute("/loadout")({
  head: () => ({
    meta: [
      { title: "Deck Loadout — FarAction" },
      {
        name: "description",
        content: "Build your 5-card sequence within your energy pool before the FarAction match.",
      },
      { property: "og:title", content: "Deck Loadout — FarAction" },
      {
        property: "og:description",
        content: "Build the 5-card sequence you will reveal slot by slot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Loadout,
});

const FILTERS = ["all", "strike", "defense", "control"] as const;

function Loadout() {
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const fighter = CHARACTERS.find((c) => c.id === player.fighterId) ?? CHARACTERS[0]!;
  const { address } = useWallet();
  // Energy boosts bought in the Black Market permanently widen the pool.
  const boosts = useQuery({
    queryKey: ["fighter-energy", address],
    enabled: Boolean(address),
    queryFn: () => listFighterEnergy({ data: { wallet: address! } }),
  });
  const bonusEnergy =
    boosts.data?.find((b) => b.fighterId === fighter.id)?.bonusEnergy ?? 0;
  const energyPool = calcEnergyPool(fighter) + bonusEnergy;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sequence, setSequence] = useState<string[]>([]);
  const [feeError, setFeeError] = useState("");

  /**
   * Every competitive match costs a flat entry fee. Matches opened through the
   * match maker already carry a verified receipt; quick play pays here.
   */
  const enterArena = useMutation({
    mutationFn: async () => {
      const existing = loadActiveMatch();
      const id = existing?.id ?? newMatchId();
      const match = existing ?? {
        id,
        mode: "house" as const,
        staked: false,
        token: "FACTS" as const,
        stake: 0,
        difficulty: 1 as const,
        hostHandle: displayHandle(player),
        hostFighterId: player.fighterId || fighter.id,
        createdAt: Date.now(),
        role: "host" as const,
        paid: false,
      };

      if (!existing) {
        saveActiveMatch(match);
      }

      if (match.mode === "1v1" || match.mode === "ranked") {
        const role = match.role;
        const row = await setMatchLoadout({
          data: {
            matchId: match.id,
            role,
            fighterId: player.fighterId || fighter.id,
            deck: sequence,
            ready: true,
          },
        });

        const result = row as MatchRecord;
        const hostDeck = Array.isArray(result.host_deck)
          ? result.host_deck.filter((v): v is string => typeof v === "string")
          : (match.hostDeck ?? player.deck);
        const joinerDeck = Array.isArray(result.joiner_deck)
          ? result.joiner_deck.filter((v): v is string => typeof v === "string")
          : (match.joinerDeck ?? player.deck);

        const next = {
          ...match,
          hostFighterId: role === "host" ? player.fighterId || fighter.id : match.hostFighterId,
          ...(role === "joiner" && match.joinerFighterId
            ? { joinerFighterId: match.joinerFighterId }
            : {}),
          ...(role === "joiner" && !match.joinerFighterId
            ? { joinerFighterId: player.fighterId || fighter.id }
            : {}),
          hostDeck: role === "host" ? sequence : hostDeck,
          joinerDeck: role === "joiner" ? sequence : joinerDeck,
          hostReady: role === "host" ? true : Boolean(result.host_ready ?? match.hostReady),
          joinerReady: role === "joiner" ? true : Boolean(result.joiner_ready ?? match.joinerReady),
          paid: true,
        };
        saveActiveMatch(next);
        navigate({ to: "/lobby" });
        return;
      }

      if (match.entryReceiptId) return;
      await chargeEntryFee({ matchId: match.id, mode: match.mode, payer: displayHandle(player) });
      saveActiveMatch({
        ...match,
        paid: true,
        entryReceiptId: match.id,
      });
    },
    onSuccess: () => {
      const existing = loadActiveMatch();
      if (existing?.mode === "1v1" || existing?.mode === "ranked") return;
      navigate({ to: "/play" });
    },
    onError: (e) =>
      setFeeError(
        e instanceof Error && e.message
          ? e.message
          : `Entry fee of ${ENTRY_FEE_USDC.toFixed(2)} USDC could not be confirmed. Try again.`,
      ),
  });

  const pool = useMemo(
    () => CARDS.filter((c) => !c.isPremium || player.unlockedCards.includes(c.id)),
    [player.unlockedCards],
  );
  const shown = pool.filter((c) => filter === "all" || c.type === filter);
  const used = sequence.reduce(
    (sum, id) => sum + (CARDS.find((c) => c.id === id)?.energyCost ?? 0),
    0,
  );
  const archetypes = getStarterArchetypes(fighter.id);

  const add = (id: string) => {
    const card = CARDS.find((c) => c.id === id)!;
    if (sequence.includes(id) || sequence.length >= 5 || used + card.energyCost > energyPool) return;
    setSequence((s) => [...s, id]);
  };

  const activeCardId = sequence[sequence.length - 1] ?? shown[0]?.id ?? pool[0]?.id;
  const activeCard = activeCardId ? CARDS.find((c) => c.id === activeCardId) : undefined;

  return (
    <main className="fa-screen overflow-hidden bg-[#050915] text-white">
      <GameWorld dim={0.65} motes={false} />

      <TopBar title="Deck Loadout" back="/select-fighter" />

      <div className="relative z-10 grid h-[calc(100%-110px)] grid-cols-[minmax(0,1.7fr)_330px] gap-7 px-8 pb-6 pt-20">
        <section className="panel overflow-hidden p-4">
          <div className="flex items-center justify-between pb-3">
            <p className="font-display text-[15px] tracking-[0.22em] text-white uppercase">
              Your deck
              <span className="ml-3 text-cyan-300">{sequence.length}/5</span>
              <span className="ml-2 text-[10px] tracking-[0.18em] text-slate-300 uppercase">cards</span>
            </p>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => {
              const id = sequence[i];
              const card = id ? CARDS.find((c) => c.id === id) : undefined;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSequence((s) => s.filter((_, idx) => idx !== i))}
                  className={`group relative h-[200px] overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                    card
                      ? "border-cyan-400/80 bg-[#090d1b]/70 shadow-[0_0_26px_rgba(34,211,238,0.22)]"
                      : "border-dashed border-border/70 bg-[#0d1220]/60"
                  }`}
                >
                  {card ? (
                    <>
                      <img
                        src={card.image}
                        alt={card.name}
                        className="absolute inset-0 h-full w-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,20,0.0),rgba(11,13,20,0.5)_34%,rgba(7,9,15,0.94)_100%)]" />
                      <div className="absolute left-2 top-2 flex items-center justify-center rounded-full border border-cyan-300/80 bg-[#0b1020]/70 px-2 py-1 font-display text-[11px] text-white">
                        {i + 1}
                      </div>
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-1.5 py-0.5 text-[10px] text-cyan-300">
                        {card.energyCost}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <p className="font-display text-[11px] tracking-[0.12em] text-white uppercase">
                          {card.name}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-slate-500">
                      +
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border/70 bg-[#090f1f]/80">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-md border px-3 py-1.5 font-display text-[10px] tracking-[0.2em] uppercase transition-all ${
                      filter === f
                        ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.18)]"
                        : "border-border/70 bg-transparent text-slate-300"
                    }`}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="flex items-center gap-2 rounded-md border border-border/70 bg-[#0d1324] px-2.5 py-1.5 font-display text-[10px] tracking-[0.18em] text-slate-200 uppercase"
              >
                All rarities
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2.5 p-3">
              {shown.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  selected={sequence.includes(card.id)}
                  disabled={sequence.length >= 5 || used + card.energyCost > energyPool}
                  onClick={() => add(card.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="panel overflow-hidden p-3">
          {activeCard ? (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-cyan-400/70 bg-[#060d1d]/90">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_35%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.25),transparent_38%)]" />
                <img
                  src={activeCard.image}
                  alt={activeCard.name}
                  className="relative z-10 h-[260px] w-full object-cover object-top"
                />
                <div className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/80 bg-[#09111c]/80 font-display text-lg text-cyan-300">
                  {sequence.filter((id) => id === activeCard.id).length || 1}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-400/50 bg-[#091120]/80 p-4 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
                <h3 className="font-display text-[25px] leading-none tracking-[0.08em] text-white uppercase">
                  {activeCard.name}
                </h3>
                <div className="mt-4 flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-slate-200">
                  <span className="rounded-full border border-cyan-300/60 bg-cyan-400/10 px-2 py-1 text-cyan-300">
                    {activeCard.type}
                  </span>
                  <span className="rounded-full border border-pink-400/60 bg-pink-500/10 px-2 py-1 text-pink-300">
                    {activeCard.rarity}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
                  <div>
                    <p className="label-xs text-slate-400">Knock</p>
                    <p className="mt-1 font-display text-[20px] text-white">{activeCard.knock}</p>
                  </div>
                  <div>
                    <p className="label-xs text-slate-400">Priority</p>
                    <p className="mt-1 font-display text-[20px] text-white">{activeCard.priority}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-200">{activeCard.effect}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!sequence.includes(activeCard.id)) {
                    add(activeCard.id);
                  }
                }}
                className="mt-4 w-full rounded-xl border border-fuchsia-400/80 bg-gradient-to-r from-fuchsia-500/80 via-violet-500/80 to-cyan-400/80 px-4 py-3 font-display text-[13px] tracking-[0.22em] text-white uppercase shadow-[0_0_30px_rgba(217,70,239,0.30)] transition hover:brightness-110 disabled:opacity-50"
                disabled={sequence.length >= 5 || used + activeCard.energyCost > energyPool || sequence.includes(activeCard.id)}
              >
                {sequence.includes(activeCard.id) ? "In Deck" : "Equip"}
              </button>
            </>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-[#0b0f1b]/60 text-slate-500">
              Load a card to preview it.
            </div>
          )}
        </aside>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-5 border-t border-border/60 bg-[#070c1a]/90 px-8 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setSequence([])}
          className="rounded-lg border border-border/70 bg-[#0c101a] px-4 py-2 font-display text-[10px] tracking-[0.18em] text-slate-200 uppercase"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={sequence.length !== 5 || enterArena.isPending}
          onClick={() => {
            setFeeError("");
            update({ deck: sequence });
            enterArena.mutate();
          }}
          className="fa-btn ml-auto w-56 shrink-0 disabled:opacity-40"
        >
          {enterArena.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {enterArena.isPending
            ? "Paying entry fee…"
            : sequence.length === 5
              ? `Lock Sequence · ${ENTRY_FEE_USDC.toFixed(2)} USDC`
              : `Select ${5 - sequence.length} more`}
        </button>
      </div>

      {feeError ? (
        <p className="absolute inset-x-0 bottom-3 z-40 text-center text-[11px] text-strike">
          {feeError}
        </p>
      ) : null}
    </main>
  );
}
