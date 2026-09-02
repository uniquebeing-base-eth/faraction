import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Screen } from "@/components/Screen";
import { CardTile } from "@/components/CardTile";
import { CARDS, CHARACTERS, type Card } from "@/lib/game/gameData";
import { calcEnergyPool } from "@/lib/game/combatEngine";
import { ENERGY_ITEMS, type EnergyItem } from "@/lib/game/energy";
import { listFighterEnergy } from "@/lib/energy.functions";
import { usePlayer , displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";
import { purchaseCard, purchaseEnergyBoost } from "@/lib/payment-flows";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Black Market — FarAction" },
      {
        name: "description",
        content: "Spend FACTS on premium FarAction cards and expand your onchain loadout.",
      },
      { property: "og:title", content: "Black Market — FarAction" },
      { property: "og:description", content: "Spend FACTS on premium cards for your loadout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Market,
});

function Market() {
  const { player, update } = usePlayer();
  const wallet = useTokenBalances();
  const [msg, setMsg] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [tab, setTab] = useState<"cards" | "energy">("cards");
  const [energyFighter, setEnergyFighter] = useState(player.fighterId || CHARACTERS[0]!.id);
  const premium = CARDS.filter((c) => c.isPremium);
  const owned = premium.filter((c) => player.unlockedCards.includes(c.id)).length;

  const buy = useMutation({
    mutationFn: async (card: Card) => {
      await purchaseCard({
        cardId: card.id,
        payer: displayHandle(player),
        amountFacts: card.price ?? 0,
      });
      return card;
    },
    onSuccess: (card) => {
      update((p) => ({ unlockedCards: [...p.unlockedCards, card.id] }));
      setMsg(`${card.name} unlocked onchain.`);
      void wallet.refetch();
      setBuying(null);
    },
    onError: (e) => {
      setMsg(e instanceof Error ? e.message : "The purchase could not be completed.");
      setBuying(null);
    },
  });

  const address = wallet.address ?? null;
  const energy = useQuery({
    queryKey: ["fighter-energy", address],
    enabled: Boolean(address),
    queryFn: () => listFighterEnergy({ data: { wallet: address! } }),
  });
  const bonusFor = (id: string) =>
    energy.data?.find((b) => b.fighterId === id)?.bonusEnergy ?? 0;

  const buyEnergy = useMutation({
    mutationFn: async (item: EnergyItem) =>
      purchaseEnergyBoost({
        itemId: item.id,
        fighterId: energyFighter,
        energy: item.energy,
        amountFacts: item.price,
      }),
    onSuccess: (res) => {
      setMsg(`+${res.bonusEnergy} total bonus energy on this fighter.`);
      void energy.refetch();
      void wallet.refetch();
      setBuying(null);
    },
    onError: (e) => {
      setMsg(e instanceof Error ? e.message : "The purchase could not be completed.");
      setBuying(null);
    },
  });

  const selectedFighter =
    CHARACTERS.find((c) => c.id === energyFighter) ?? CHARACTERS[0]!;

  return (
    <Screen
      title="Black Market"
      eyebrow="Station · Contraband"
      heading="Black Market"
      blurb="Premium cards priced in FACTS, paid onchain from your Base wallet. Unlocked cards join your pool permanently."
      aside={
        <div className="space-y-2">
          <div className="panel flex items-center justify-between p-3">
            <span className="label-xs">Wallet FACTS</span>
            <span className="font-display text-lg font-bold text-facts">
              {wallet.connected
                ? wallet.isLoading
                  ? "…"
                  : Math.floor(wallet.facts).toLocaleString()
                : "—"}
            </span>
          </div>
          <div className="panel flex items-center justify-between p-3">
            <span className="label-xs">Collected</span>
            <span className="font-display text-lg font-bold">
              {owned} / {premium.length}
            </span>
          </div>
          {msg ? <p className="text-xs text-accent">{msg}</p> : null}
        </div>
      }
    >
      <div className="flex items-center gap-2">
        {(["cards", "energy"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md border px-3 py-1.5 font-display text-xs ${
              tab === t
                ? "border-facts bg-facts/15 text-facts"
                : "border-border/70 text-muted-foreground"
            }`}
          >
            {t === "cards" ? "PREMIUM CARDS" : "ENERGY BOOSTS"}
          </button>
        ))}
      </div>

      {tab === "energy" ? (
        <div className="fa-scroll mt-3 max-h-[calc(100%-3rem)] pr-1">
          <p className="text-xs leading-snug text-muted-foreground">
            Energy boosts are one-off purchases that permanently raise a single fighter&apos;s
            energy pool, so it can hold higher-cost cards.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEnergyFighter(c.id)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  energyFighter === c.id
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                {c.name}
                {bonusFor(c.id) ? ` +${bonusFor(c.id)}` : ""}
              </button>
            ))}
          </div>
          <p className="label-xs mt-3">
            {selectedFighter.name} · base {calcEnergyPool(selectedFighter)} energy ·{" "}
            {bonusFor(selectedFighter.id)} bonus
          </p>
          <div className="mt-3 grid grid-cols-5 gap-3">
            {ENERGY_ITEMS.map((item) => {
              const pending = buying === item.id && buyEnergy.isPending;
              return (
                <div key={item.id} className="space-y-1.5">
                  <img
                    src={item.image}
                    alt={`${item.name} — +${item.energy} energy`}
                    loading="lazy"
                    className="aspect-square w-full rounded-md border border-border/70 object-cover"
                  />
                  <p className="text-center font-display text-[11px]">
                    {item.name} · +{item.energy}
                  </p>
                  <button
                    type="button"
                    disabled={buyEnergy.isPending}
                    onClick={async () => {
                      setMsg(null);
                      if (!wallet.connected) {
                        try {
                          await wallet.connect();
                        } catch {
                          setMsg("Connect a Base wallet to buy energy.");
                          return;
                        }
                      }
                      if (wallet.facts < item.price) {
                        setMsg(`Not enough FACTS in your wallet for ${item.name}.`);
                        return;
                      }
                      setBuying(item.id);
                      buyEnergy.mutate(item);
                    }}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-facts/50 bg-facts/10 py-1.5 font-display text-[10px] text-facts disabled:opacity-40"
                  >
                    {pending ? <Loader2 className="size-3 animate-spin" /> : null}
                    {(item.price / 1_000_000).toLocaleString()}M FACTS
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="fa-scroll mt-3 grid max-h-[calc(100%-3rem)] grid-cols-4 gap-3 pr-1">
        {premium.map((card) => {
          const isOwned = player.unlockedCards.includes(card.id);
          const pending = buying === card.id && buy.isPending;
          return (
            <div key={card.id} className="space-y-1.5">
              <CardTile card={card} selected={isOwned} />
              <button
                type="button"
                disabled={isOwned || buy.isPending}
                onClick={async () => {
                  setMsg(null);
                  if (!wallet.connected) {
                    try {
                      await wallet.connect();
                    } catch {
                      setMsg("Connect a Base wallet to buy cards.");
                      return;
                    }
                  }
                  if (wallet.facts < (card.price ?? 0)) {
                    setMsg(`Not enough FACTS in your wallet for ${card.name}.`);
                    return;
                  }
                  setBuying(card.id);
                  buy.mutate(card);
                }}
                className="flex w-full items-center justify-center gap-1 rounded-md border border-facts/50 bg-facts/10 py-1.5 font-display text-[10px] text-facts disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : null}
                {isOwned ? "OWNED" : `${(card.price ?? 0).toLocaleString()} FACTS`}
              </button>
            </div>
          );
        })}
      </div>
      )}
    </Screen>
  );
}
