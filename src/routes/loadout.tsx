import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { CARDS, CHARACTERS } from "@/lib/game/gameData";
import { calcEnergyPool } from "@/lib/game/combatEngine";
import { getStarterArchetypes } from "@/lib/game/archetypes";
import { usePlayer , displayHandle } from "@/lib/game/store";
import { TopBar } from "@/components/TopBar";
import { GameWorld } from "@/components/GameWorld";
import { CardTile } from "@/components/CardTile";
import { ENTRY_FEE_USDC, loadActiveMatch, newMatchId, saveActiveMatch } from "@/lib/game/match";
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
  const energyPool = calcEnergyPool(fighter);
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
      const match =
        existing ?? {
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

      if (match.mode === "1v1") {
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

        const next = {
          ...match,
          hostFighterId: role === "host" ? player.fighterId || fighter.id : match.hostFighterId,
          ...(role === "joiner" && match.joinerFighterId
            ? { joinerFighterId: match.joinerFighterId }
            : {}),
          ...(role === "joiner" && !match.joinerFighterId
            ? { joinerFighterId: player.fighterId || fighter.id }
            : {}),
          hostDeck: role === "host" ? sequence : match.hostDeck ?? player.deck,
          joinerDeck: role === "joiner" ? sequence : match.joinerDeck ?? player.deck,
          hostReady: role === "host" ? true : Boolean((row as any)?.host_ready ?? match.hostReady),
          joinerReady: role === "joiner" ? true : Boolean((row as any)?.joiner_ready ?? match.joinerReady),
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
      if (existing?.mode === "1v1") return;
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
    if (sequence.length >= 5 || used + card.energyCost > energyPool) return;
    setSequence((s) => [...s, id]);
  };

  return (
    <main className="fa-screen">
      <GameWorld dim={0.68} motes={false} />
      <TopBar title="Deck Loadout" back="/select-fighter" />

      <div className="relative z-10 grid h-full grid-cols-[300px_minmax(0,1fr)] gap-7 px-8 pt-20 pb-[104px]">
        {/* Fighter + energy + archetypes */}
        <aside className="flex min-h-0 flex-col gap-3">
          <div className="panel flex items-center gap-3 p-3">
            <img
              src={fighter.portrait}
              alt={fighter.name}
              loading="lazy"
              className="size-14 shrink-0 rounded-md object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">
                {fighter.name} · {fighter.className}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-facts transition-all duration-300"
                  style={{ width: `${(used / energyPool) * 100}%` }}
                />
              </div>
              <p className="label-xs mt-1">
                Energy {used} / {energyPool}
              </p>
            </div>
          </div>

          <div className="panel min-h-0 flex-1 p-3">
            <p className="label-xs">Preset sequences</p>
            <div className="fa-scroll mt-2 flex max-h-[200px] flex-col gap-1.5 pr-1">
              {archetypes.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setSequence(a.cardIds.slice(0, 5))}
                  className="shrink-0 rounded-md border border-border px-3 py-2 text-left font-display text-[11px] tracking-wider uppercase transition-colors hover:border-accent"
                >
                  {a.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSequence([])}
                className="shrink-0 rounded-md border border-border/60 px-3 py-2 text-left font-display text-[11px] tracking-wider text-muted-foreground uppercase"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-md border py-2 font-display text-[10px] tracking-wider uppercase ${
                  filter === f
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </aside>

        {/* Card pool */}
        <section className="panel min-h-0 overflow-hidden p-4">
          <p className="label-xs">Card pool · {shown.length} available</p>
          <div className="fa-scroll mt-3 grid max-h-[calc(100%-2rem)] grid-cols-6 gap-2.5 pr-1">
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
        </section>
      </div>

      {/* Sequence dock */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-5 border-t border-border/60 bg-background/85 px-8 py-3 backdrop-blur-md">
        <p className="label-xs w-24 shrink-0">
          Sequence
          <br />
          {sequence.length}/5
        </p>
        <div className="flex flex-1 gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => {
            const id = sequence[i];
            const card = id ? CARDS.find((c) => c.id === id) : undefined;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSequence((s) => s.filter((_, idx) => idx !== i))}
                className={`flex h-16 flex-1 flex-col items-center justify-center rounded-lg border text-center transition-all ${
                  card
                    ? "animate-slam border-accent/70 bg-accent/10"
                    : "border-dashed border-border"
                }`}
              >
                <span className="label-xs">Slot {i + 1}</span>
                <span className="px-2 font-display text-[11px] leading-tight">
                  {card ? card.name : "+"}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={sequence.length !== 5 || enterArena.isPending}
          onClick={() => {
            setFeeError("");
            update({ deck: sequence });
            enterArena.mutate();
          }}
          className="fa-btn w-56 shrink-0 disabled:opacity-40"
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
        <p className="absolute inset-x-0 bottom-2 z-30 text-center text-[11px] text-strike">
          {feeError}
        </p>
      ) : null}
    </main>
  );
}
