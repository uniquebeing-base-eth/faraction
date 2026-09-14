import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Zap } from "lucide-react";
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
  const [featured, setFeatured] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [energyFighter, setEnergyFighter] = useState(player.fighterId || CHARACTERS[0]!.id);
  const cardsTrayRef = useRef<HTMLDivElement | null>(null);
  const energyTrayRef = useRef<HTMLDivElement | null>(null);
  const premium = CARDS.filter((c) => c.isPremium);
  const owned = premium.filter((c) => player.unlockedCards.includes(c.id)).length;

  const scrollTray = (
    trayRef: { current: HTMLDivElement | null },
    direction: "prev" | "next",
  ) => {
    const tray = trayRef.current;
    if (!tray) return;
    const offset = Math.max(tray.clientWidth * 0.72, 220);
    tray.scrollBy({ left: direction === "next" ? offset : -offset, behavior: "smooth" });
  };

  useEffect(() => {
    if (premium.length < 2) return;
    const id = window.setInterval(() => {
      setFeatured((value) => (value + 1) % premium.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [premium.length]);

  const activeFeature = premium[featured] ?? premium[0]!;
  const moveFeatured = (direction: "prev" | "next") => {
    setFeatured((value) => {
      if (direction === "prev") return (value - 1 + premium.length) % premium.length;
      return (value + 1) % premium.length;
    });
  };

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
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
        <div className="rounded-[26px] border border-fuchsia-400/25 bg-[linear-gradient(180deg,rgba(29,17,41,0.82),rgba(9,12,19,0.9))] p-4 shadow-[0_0_28px_rgba(168,85,247,0.14)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-xs text-fuchsia-300">Featured drop</p>
              <h2 className="mt-2 font-display text-[30px] uppercase leading-none tracking-[-0.08em] text-white">
                {activeFeature.name}
              </h2>
            </div>
            <div className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1.5 text-[9px] font-display uppercase tracking-[0.26em] text-fuchsia-100">
              {activeFeature.type.toUpperCase()}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label="Previous featured card"
              onClick={() => moveFeatured("prev")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-100 transition-transform hover:scale-105"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next featured card"
              onClick={() => moveFeatured("next")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-100 transition-transform hover:scale-105"
            >
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="relative overflow-hidden rounded-[24px] border border-fuchsia-400/30 bg-[radial-gradient(circle_at_top,rgba(192,114,255,0.22),transparent_38%),linear-gradient(135deg,#120b1d,#0d1019_50%,#10131d)] p-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(34,211,238,0.18),transparent_20%),radial-gradient(circle_at_15%_70%,rgba(168,85,247,0.20),transparent_30%)]" />
              <div className="absolute bottom-0 right-0 h-36 w-36 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <img
                src={activeFeature.image}
                alt={activeFeature.name}
                className="relative z-10 ml-auto h-40 w-40 object-contain drop-shadow-[0_0_30px_rgba(192,114,255,0.4)]"
              />
              <div className="relative z-10 mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="font-display text-[11px] uppercase tracking-[0.24em] text-white/60">Drop</p>
                  <p className="mt-1 max-w-[22ch] text-xs text-white/75">{activeFeature.effect}</p>
                </div>
                <div className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 font-display text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                  {(activeFeature.price ?? 0).toLocaleString()} FACTS
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[20px] border border-white/10 bg-white/4 p-3">
                <div className="flex items-center gap-2 text-fuchsia-200">
                  <Sparkles className="size-4" />
                  <p className="font-display text-[10px] uppercase tracking-[0.22em]">Market pulse</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="font-display text-lg leading-none text-white">{premium.length}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/60">cards</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="font-display text-lg leading-none text-white">{owned}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/60">owned</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="font-display text-lg leading-none text-white">{(wallet.facts || 0).toFixed(0)}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/60">facts</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-fuchsia-400/20 bg-fuchsia-500/8 p-3">
                <div className="flex items-center gap-2 text-fuchsia-100">
                  <Zap className="size-4" />
                  <p className="font-display text-[10px] uppercase tracking-[0.22em]">Best value</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-xl uppercase tracking-[0.08em] text-white">{premium[0]?.name ?? "N/A"}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/55">High-impact utility</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeatured(0)}
                    className="rounded-full border border-fuchsia-300/40 bg-black/20 px-3 py-1.5 text-[9px] font-display uppercase tracking-[0.2em] text-fuchsia-100"
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["cards", "energy"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.18em] transition-all ${
                tab === t
                  ? "border-fuchsia-300 bg-fuchsia-500/15 text-fuchsia-200 shadow-[0_0_18px_rgba(192,114,255,0.22)]"
                  : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              {t === "cards" ? "Premium Cards" : "Energy Boosts"}
            </button>
          ))}
        </div>

        {tab === "energy" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="text-xs leading-snug text-slate-300">
              Energy boosts are one-off purchases that permanently raise a single fighter&apos;s
              energy pool, so it can hold higher-cost cards.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEnergyFighter(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
                    energyFighter === c.id
                      ? "border-fuchsia-300 bg-fuchsia-500/15 text-fuchsia-100"
                      : "border-white/10 bg-black/20 text-slate-300"
                  }`}
                >
                  {c.name}
                  {bonusFor(c.id) ? ` +${bonusFor(c.id)}` : ""}
                </button>
              ))}
            </div>
            <p className="label-xs mt-3 text-fuchsia-200">
              {selectedFighter.name} · base {calcEnergyPool(selectedFighter)} energy ·{" "}
              {bonusFor(selectedFighter.id)} bonus
            </p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="font-display text-[10px] uppercase tracking-[0.18em] text-slate-300">Boost pack</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous energy boost"
                  onClick={() => scrollTray(energyTrayRef, "prev")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-100 transition-transform hover:scale-105"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next energy boost"
                  onClick={() => scrollTray(energyTrayRef, "next")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-100 transition-transform hover:scale-105"
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>

            <div
              ref={energyTrayRef}
              className="tray-scroll mt-3 flex min-h-0 gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {ENERGY_ITEMS.map((item) => {
                const pending = buying === item.id && buyEnergy.isPending;
                return (
                  <div key={item.id} className="w-[150px] shrink-0 snap-start space-y-1.5 rounded-[20px] border border-white/10 bg-white/3 p-2.5">
                    <img
                      src={item.image}
                      alt={`${item.name} — +${item.energy} energy`}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl border border-white/10 object-cover shadow-[0_0_24px_rgba(168,85,247,0.14)]"
                    />
                    <p className="text-center font-display text-[11px] uppercase tracking-[0.08em] text-slate-200">
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
                      className="flex w-full items-center justify-center gap-1 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/10 py-1.5 font-display text-[10px] uppercase tracking-[0.12em] text-fuchsia-200 disabled:opacity-40"
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-display text-[10px] uppercase tracking-[0.18em] text-slate-300">Featured drops</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous premium card"
                  onClick={() => scrollTray(cardsTrayRef, "prev")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-100 transition-transform hover:scale-105"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next premium card"
                  onClick={() => scrollTray(cardsTrayRef, "next")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-100 transition-transform hover:scale-105"
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>

            <div
              ref={cardsTrayRef}
              className="tray-scroll flex min-h-0 gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => {
                if (touchStartX === null) return;
                const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
                if (delta > 50) moveFeatured("prev");
                if (delta < -50) moveFeatured("next");
                setTouchStartX(null);
              }}
            >
              {premium.map((card, index) => {
                const isOwned = player.unlockedCards.includes(card.id);
                const isFeatured = index === featured;
                const pending = buying === card.id && buy.isPending;
                return (
                  <div
                    key={card.id}
                    className={`w-[240px] shrink-0 snap-start space-y-2 rounded-[26px] border p-2.5 transition-all duration-300 ${
                      isFeatured
                        ? "border-fuchsia-300 bg-fuchsia-500/10 shadow-[0_0_22px_rgba(192,114,255,0.2)]"
                        : "border-white/10 bg-white/3"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFeatured(index)}
                      className="block w-full text-left"
                    >
                      <CardTile card={card} selected={isOwned || isFeatured} compact />
                    </button>
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/10 py-2 font-display text-[10px] uppercase tracking-[0.14em] text-fuchsia-200 disabled:opacity-40"
                    >
                      {pending ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
                      {isOwned ? "Owned" : `${(card.price ?? 0).toLocaleString()} FACTS`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
