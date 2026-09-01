/**
 * Daily $FACTS claim, paid for Facts Points.
 *
 * The server quotes the payout (500 $FACTS per 1,000 FP) and signs it; the
 * wallet broadcasts the claim to the points reward contract on Base, and the
 * confirmed claim is mirrored back into the ledger.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Gift, Share2 } from "lucide-react";
import { useWallet } from "@/lib/onchain/wallet";
import { claimFactsForPoints } from "@/lib/onchain/actions";
import { factsClaimQuote, recordFactsClaim } from "@/lib/rewards.functions";
import { pushActivity } from "@/lib/activity";
import { sfx } from "@/lib/sound";
import { shareCast } from "@/lib/share";
import { PROD_ORIGIN } from "@/lib/config";

/** $FACTS paid per 1,000 Facts Points. */
const FACTS_PER_1000_FP = 500;

function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function DailyClaimCard({ onClaimed }: { onClaimed?: (amount: number) => void }) {
  const { address, connect, connecting } = useWallet();
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const quote = useQuery({
    queryKey: ["facts-claim-quote", address],
    enabled: Boolean(address),
    refetchInterval: 60_000,
    queryFn: () => factsClaimQuote({ data: { wallet: address! } }),
  });

  const claim = useMutation({
    mutationFn: async () => {
      const q = quote.data;
      if (!q?.signature) throw new Error(q?.reason ?? "This claim is not available yet.");
      const tx = await claimFactsForPoints({ points: q.points, signature: q.signature });
      await recordFactsClaim({
        data: { wallet: tx.account, amount: q.reward, txHash: tx.hash },
      }).catch(() => undefined);
      return { amount: q.reward, hash: tx.hash };
    },
    onSuccess: (res) => {
      sfx.coin();
      pushActivity("claim", `Claimed ${Math.round(res.amount).toLocaleString()} FACTS`);
      onClaimed?.(res.amount);
      void queryClient.invalidateQueries({ queryKey: ["facts-claim-quote"] });
    },
  });

  if (!address) {
    return (
      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="w-full rounded-lg border border-facts bg-facts/15 py-3 font-display text-sm font-bold text-facts disabled:opacity-40"
      >
        {connecting ? "CONNECTING…" : "CONNECT WALLET TO CLAIM"}
      </button>
    );
  }

  const q = quote.data;
  const waiting = (q?.secondsUntilNextClaim ?? 0) > 0;
  // `tick` keeps the countdown ticking between refetches.
  const remaining = countdown((q?.secondsUntilNextClaim ?? 0) - (tick % 60));
  const reward = q?.reward ?? 0;
  const disabled = claim.isPending || !q?.canClaim || !q?.signature;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border/70 bg-card/40 p-3">
        <p className="label-xs">
          Daily bounty · {FACTS_PER_1000_FP} FACTS per 1,000 FP
        </p>
        <p className="font-display text-xl font-bold text-facts">
          {quote.isLoading ? "…" : `${Math.round(reward).toLocaleString()} FACTS`}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {quote.isLoading
            ? "Reading your Facts Points…"
            : waiting
              ? `Next claim in ${remaining} · ${(q?.points ?? 0).toLocaleString()} FP banked`
              : (q?.reason ??
                `${(q?.points ?? 0).toLocaleString()} FP ready to convert. Paid onchain on Base.`)}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => claim.mutate()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-facts bg-facts/15 py-3 font-display text-sm font-bold text-facts disabled:opacity-40"
      >
        {claim.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Gift className="size-4" />
        )}
        {waiting
          ? `NEXT CLAIM IN ${remaining}`
          : reward > 0 && q?.canClaim
            ? `CLAIM ${Math.round(reward).toLocaleString()} FACTS`
            : "WIN BATTLES TO EARN FP"}
      </button>
      {claim.isSuccess ? (
        <button
          type="button"
          onClick={() =>
            void shareCast(
              `Claimed ${Math.round(claim.data.amount).toLocaleString()} $FACTS from my FarAction Facts Points on Base ⚔️`,
              PROD_ORIGIN,
            )
          }
          className="fa-btn-ghost w-full"
        >
          <Share2 className="size-4" /> Share claim to Farcaster
        </button>
      ) : null}
      {claim.isError ? (
        <p className="text-[11px] text-strike">
          {claim.error instanceof Error ? claim.error.message : "Claim failed. Try again."}
        </p>
      ) : null}
    </div>
  );
}
