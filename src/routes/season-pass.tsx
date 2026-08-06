import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap, Check, Lock, Loader2 } from "lucide-react";
import { Screen } from "@/components/Screen";
import { usePlayer, passIsActive, passMsLeft , displayHandle } from "@/lib/game/store";
import { PASS_PLANS, PASS_UNLOCKS, PASS_FREE_WITHOUT, type PassPlanId } from "@/lib/game/pass";
import { useFactsPrice, usdToFacts, formatFactsAmount, formatUsdPrice } from "@/lib/facts-price";
import { purchaseSeasonPass } from "@/lib/payment-flows";
import { pushActivity } from "@/lib/activity";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/season-pass")({
  head: () => ({
    meta: [
      { title: "Season Pass — FarAction" },
      {
        name: "description",
        content:
          "Unlock Ranked Mode, the Season Leaderboard and the 100,000,000 $FACTS reward pool. Pay with USDC or FACTS at the live market price.",
      },
      { property: "og:title", content: "Season Pass — FarAction" },
      {
        property: "og:description",
        content: "Ranked access on Base from 0.25 USDC. Pay in USDC or FACTS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeasonPass,
});

function SeasonPass() {
  const { player, update } = usePlayer();
  const [plan, setPlan] = useState<PassPlanId>("30d");
  const [currency, setCurrency] = useState<"USDC" | "FACTS">("USDC");
  const { price, quote } = useFactsPrice();

  const active = passIsActive(player);
  const selected = PASS_PLANS.find((p) => p.id === plan)!;
  const factsDue = usdToFacts(selected.priceUsdc, price);
  const daysLeft = Math.ceil(passMsLeft(player) / 86_400_000);

  const purchase = useMutation({
    mutationFn: () =>
      purchaseSeasonPass({
        plan,
        payer: displayHandle(player),
        token: currency,
        priceUsdc: selected.priceUsdc,
        amountFacts: factsDue,
      }),
    onSuccess: (res) => {
      sfx.coin();
      update({
        seasonPass: {
          plan: res.plan.id,
          activatedAt: Date.now(),
          paidWith: currency,
          amountPaid: res.receipt.amount,
        },
      });
      pushActivity("pass", `${displayHandle(player)} purchased a Season Pass`);
    },
  });

  const priceLabel = (usd: number) =>
    currency === "USDC"
      ? `${usd.toFixed(2)} USDC`
      : price
        ? `${formatFactsAmount(usd / price)} FACTS`
        : "…";

  return (
    <Screen
      title="Season Pass"
      back="/"
      eyebrow="Station · Access"
      heading="Unlock Ranked Play"
      blurb="A Season Pass is required for Ranked Matches, the Season Leaderboard and the 100,000,000 $FACTS reward pool. Settles on Base in USDC or FACTS."
      aside={
        <div className="space-y-3">
          <div className="panel space-y-2 p-4">
            <p className="label-xs text-facts">
              <Zap className="mr-1 inline size-3" /> Pass unlocks
            </p>
            <ul className="space-y-1.5">
              {PASS_UNLOCKS.map((perk) => (
                <li key={perk} className="flex gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-facts" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel space-y-2 p-4">
            <p className="label-xs">Always free — no pass needed</p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {PASS_FREE_WITHOUT.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Without a pass you can still earn normal match rewards, but you cannot enter Ranked
              Mode or receive Season leaderboard rewards.
            </p>
          </div>
        </div>
      }
    >
      <div className="fa-scroll flex h-full flex-col overflow-y-auto pr-1">
        {active ? (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-facts/60 bg-facts/10 p-3">
            <Check className="size-4 text-facts" />
            <p className="text-xs text-facts">
              Pass active · {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining · Ranked unlocked
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {(["USDC", "FACTS"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                sfx.tap();
                setCurrency(c);
              }}
              className={`rounded-lg border py-2.5 font-display text-xs ${
                currency === c
                  ? c === "USDC"
                    ? "border-usdc bg-usdc/10 text-usdc"
                    : "border-facts bg-facts/10 text-facts"
                  : "border-border text-muted-foreground"
              }`}
            >
              PAY WITH {c}
            </button>
          ))}
        </div>

        {currency === "FACTS" ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            FACTS pricing is calculated in real time from the live market price
            {quote ? ` (${formatUsdPrice(quote.price)} per FACTS)` : ""} — the FACTS you pay always
            equals the USDC value.
          </p>
        ) : null}

        <p className="label-xs mt-6">Choose your pass</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {PASS_PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                sfx.select();
                setPlan(p.id);
              }}
              className={`relative rounded-lg border p-4 text-center transition-transform active:scale-95 ${
                plan === p.id ? "glow border-facts bg-facts/10" : "border-border"
              }`}
            >
              {p.popular ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-facts px-1.5 py-0.5 font-display text-[8px] text-background">
                  POPULAR
                </span>
              ) : null}
              <p className="font-display text-base font-bold">{priceLabel(p.priceUsdc)}</p>
              {currency === "FACTS" ? (
                <p className="text-[10px] text-muted-foreground">≈ {p.priceUsdc.toFixed(2)} USDC</p>
              ) : null}
              <p className="label-xs mt-1">{p.label}</p>
              <p className="text-[10px] text-muted-foreground">{p.note}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={purchase.isPending || (currency === "FACTS" && !factsDue)}
          onClick={() => purchase.mutate()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-facts bg-facts/15 py-3 font-display text-sm font-bold text-facts transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {purchase.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Lock className="size-4" />
          )}
          {active
            ? `EXTEND — PAY ${priceLabel(selected.priceUsdc)}`
            : `PAY ${priceLabel(selected.priceUsdc)} → ACTIVATE ${selected.label} PASS`}
        </button>
        {purchase.isError ? (
          <p className="mt-2 text-center text-[11px] text-strike">
            {purchase.error instanceof Error
              ? purchase.error.message
              : "Payment failed. Please try again."}
          </p>
        ) : null}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Settles onchain on Base — USDC goes to the FarAction treasury, FACTS routes through the
          payment gateway. Every purchase is verified server-side against the transaction.
        </p>
      </div>
    </Screen>
  );
}
