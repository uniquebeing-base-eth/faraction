import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Screen } from "@/components/Screen";
import { CardTile } from "@/components/CardTile";
import { CARDS, type Card } from "@/lib/game/gameData";
import { usePlayer , displayHandle } from "@/lib/game/store";
import { useTokenBalances } from "@/lib/onchain/balances";
import { purchaseCard } from "@/lib/payment-flows";

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
      <p className="label-xs">Premium inventory</p>
      <div className="fa-scroll mt-3 grid max-h-[calc(100%-2rem)] grid-cols-4 gap-3 pr-1">
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
    </Screen>
  );
}
