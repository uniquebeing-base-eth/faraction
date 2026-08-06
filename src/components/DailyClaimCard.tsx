/**
 * Daily FACTS claim, settled onchain.
 *
 * Reads the wallet's claimable balance from the reward distributor, claims it
 * on Base, then records the claim server-side so a wallet can only claim once
 * per UTC day.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Gift } from "lucide-react";
import { formatUnits } from "viem";
import { useWallet } from "@/lib/onchain/wallet";
import { claimAllRewards, readTotalRewardClaimable } from "@/lib/onchain/actions";
import { FACTS_DECIMALS } from "@/lib/onchain/contracts";
import { dailyClaimStatus, recordDailyClaim } from "@/lib/daily.functions";
import { pushActivity } from "@/lib/activity";
import { sfx } from "@/lib/sound";
import { shareCast } from "@/lib/share";
import { PROD_ORIGIN } from "@/lib/config";
import { Share2 } from "lucide-react";

/** 500 FACTS, once every 24 hours. */
const DAILY_CLAIM_FACTS = 500;

function countdown(target: string | null, now: number): string | null {
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function DailyClaimCard({ onClaimed }: { onClaimed?: (amount: number) => void }) {
  const { address, connect, connecting } = useWallet();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = useQuery({
    queryKey: ["daily-claim", address],
    enabled: Boolean(address),
    queryFn: () => dailyClaimStatus({ data: { wallet: address! } }),
  });

  const claimable = useQuery({
    queryKey: ["reward-claimable", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const { total, campaigns } = await readTotalRewardClaimable(address!);
      return { total: Number(formatUnits(total, FACTS_DECIMALS)), campaigns: campaigns.length };
    },
  });

  const claim = useMutation({
    mutationFn: async () => {
      const result = await claimAllRewards();
      return recordDailyClaim({
        data: {
          wallet: result.account,
          amount: result.amount,
          txHash: result.hash,
          campaignIds: result.campaigns.map((c) => c.toString()),
        },
      });
    },
    onSuccess: (res) => {
      sfx.coin();
      pushActivity("claim", `Claimed ${Math.round(res.amount).toLocaleString()} FACTS`);
      onClaimed?.(res.amount);
      queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
      queryClient.invalidateQueries({ queryKey: ["reward-claimable"] });
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

  const remaining = countdown(status.data?.nextClaimAt ?? null, now);
  const onCooldown = Boolean(remaining) || status.data?.canClaim === false;
  const amount = claimable.data?.total ?? 0;
  const disabled = claim.isPending || onCooldown || amount <= 0;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border/70 bg-card/40 p-3">
        <p className="label-xs">Daily bounty · {DAILY_CLAIM_FACTS.toLocaleString()} FACTS / 24h</p>
        <p className="font-display text-xl font-bold text-facts">
          {claimable.isLoading ? "…" : `${Math.round(amount).toLocaleString()} FACTS`}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {onCooldown
            ? `Next claim in ${remaining ?? "00:00:00"} · ${status.data?.streak ?? 1} day streak`
            : "Paid by the FarAction reward distributor on Base. One claim every 24 hours."}
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
        {onCooldown
          ? `NEXT CLAIM IN ${remaining ?? "00:00:00"}`
          : amount > 0
            ? `CLAIM ${Math.round(amount).toLocaleString()} FACTS`
            : "NO FACTS ALLOCATED YET"}
      </button>
      {claim.isSuccess ? (
        <button
          type="button"
          onClick={() =>
            void shareCast(
              `Claimed ${Math.round(claim.data.amount).toLocaleString()} $FACTS from the FarAction daily bounty on Base ⚔️`,
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
