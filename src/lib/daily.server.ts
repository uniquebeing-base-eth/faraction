/**
 * Daily claim ledger. The FACTS payout itself happens onchain through the
 * reward distributor; this records one claim per wallet per UTC day and is the
 * source of truth for the "already claimed today" gate.
 */
import { getSupabasePublic } from "./supabase-public.server";

export interface DailyClaimStatus {
  day: string;
  claimed: boolean;
  amount: number;
  txHash: string | null;
  streak: number;
  /** ISO timestamp of the last claim, if any. */
  lastClaimAt: string | null;
  /** ISO timestamp when the next 500 FACTS claim unlocks. */
  nextClaimAt: string | null;
  canClaim: boolean;
}

/** Fixed daily reward, in FACTS, and the cooldown between claims. */
export const DAILY_CLAIM_FACTS = 500;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function getDailyClaimStatus(walletRaw: string): Promise<DailyClaimStatus> {
  const supabase = getSupabasePublic();
  const wallet = walletRaw.toLowerCase();
  const day = utcDay();

  const { data } = await supabase.rpc("list_daily_claims", { p_wallet: wallet });

  const rows = data ?? [];
  const today = rows.find((r) => r.claim_day === day) ?? null;

  // Consecutive days ending today (or yesterday, so the streak survives until
  // the player claims again).
  let streak = 0;
  const cursor = new Date(`${day}T00:00:00.000Z`);
  if (!today) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const key = utcDay(cursor);
    if (!rows.some((r) => r.claim_day === key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // The gate is a rolling 24 hours from the last claim, not a calendar day.
  const last = rows
    .map((r) => (r.created_at ? new Date(r.created_at).getTime() : 0))
    .sort((a, b) => b - a)[0];
  const lastClaimAt = last ? new Date(last).toISOString() : null;
  const nextAt = last ? last + DAILY_COOLDOWN_MS : 0;

  return {
    day,
    claimed: Boolean(today),
    amount: today ? Number(today.amount) : 0,
    txHash: today?.tx_hash ?? null,
    streak,
    lastClaimAt,
    nextClaimAt: nextAt ? new Date(nextAt).toISOString() : null,
    canClaim: Date.now() >= nextAt,
  };
}

/** Records a verified onchain daily claim. Fails if today is already claimed. */
export async function saveDailyClaim(input: {
  wallet: string;
  amount: number;
  txHash: string;
  campaignIds: string[];
}) {
  const supabase = getSupabasePublic();
  const { verifyRewardClaimTx } = await import("./chain.server");
  const wallet = input.wallet.toLowerCase();

  const current = await getDailyClaimStatus(wallet);
  if (!current.canClaim) {
    throw new Error("Your next FACTS claim unlocks 24 hours after the last one.");
  }

  const onchain = await verifyRewardClaimTx(input.txHash);
  if (onchain.from !== wallet) {
    throw new Error("The claim transaction was not sent from this wallet");
  }

  // The cooldown, the daily cap and the reward-claim mirror are all enforced
  // inside the database routine, so a tampered client cannot bypass them.
  const { error } = await supabase.rpc("record_daily_claim", {
    p_wallet: wallet,
    p_amount: input.amount,
    p_tx_hash: input.txHash,
    p_campaign_ids: input.campaignIds.join(","),
  });
  if (error) throw new Error(error.message);

  return getDailyClaimStatus(wallet);
}
