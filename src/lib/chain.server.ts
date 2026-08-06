/**
 * Server-side chain mirror. Every write is verified against a real Base
 * transaction receipt before it is persisted, then fanned out into the
 * payments / matches / claims tables.
 */
import { getReceipt } from "./base-rpc.server";
import { getSupabasePublic } from "./supabase-public.server";
import {
  MATCH_VAULT_ADDRESS,
  PAYMENT_GATEWAY_ADDRESS,
  REWARD_DISTRIBUTOR_ADDRESS,
} from "./onchain/contracts";

const ADDRESS_OF: Record<string, string> = {
  FactsPaymentGateway: PAYMENT_GATEWAY_ADDRESS,
  StakedMatchVault: MATCH_VAULT_ADDRESS,
  FactsRewardDistributor: REWARD_DISTRIBUTOR_ADDRESS,
};

type EventInput = {
  contract: string;
  eventName: string;
  txHash: string;
  wallet: string;
  args: Record<string, unknown>;
};

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function saveChainEvent(input: EventInput) {
  const supabase = getSupabasePublic();
  const address = ADDRESS_OF[input.contract]!;

  const receipt = await getReceipt(input.txHash as `0x${string}`);
  if (receipt.status !== "success") throw new Error("Transaction reverted onchain");
  const touchesContract = receipt.logs.some(
    (log) => log.address.toLowerCase() === address.toLowerCase(),
  );
  if (!touchesContract) throw new Error("Transaction does not touch this contract");

  const wallet = input.wallet.toLowerCase();
  const fail = (label: string, error: { message: string } | null) => {
    if (error) throw new Error(`${label}: ${error.message}`);
  };

  fail(
    "Could not record the onchain event",
    (
      await supabase.rpc("record_chain_event", {
        p_contract: input.contract,
        p_address: address,
        p_event_name: input.eventName,
        p_tx_hash: input.txHash,
        p_block: Number(receipt.blockNumber),
        p_wallet: wallet,
        p_args: input.args as never,
      })
    ).error,
  );

  const args = input.args;

  if (input.eventName === "PaymentReceived") {
    fail(
      "Could not record the payment",
      (
        await supabase.rpc("record_payment_receipt", {
          p_kind: String(args["kind"] ?? "store"),
          p_sku: String(args["sku"] ?? "unknown"),
          p_payment_ref: String(args["paymentRef"] ?? input.txHash),
          p_payer: wallet,
          p_beneficiary: String(args["beneficiary"] ?? wallet).toLowerCase(),
          p_token: String(args["token"] ?? "FACTS"),
          p_amount: num(args["amount"]),
          p_usd_value: (args["usdValue"] == null ? null : num(args["usdValue"])) as number,
          p_tx_hash: input.txHash,
        })
      ).error,
    );
  }

  if (input.eventName === "MatchCreated") {
    fail(
      "Could not record the match",
      (
        await supabase.rpc("upsert_staked_match", {
          p_match_id: String(args["matchId"]),
          p_match_key: String(args["matchKey"] ?? args["matchId"]),
          p_creator: wallet,
          p_asset: String(args["asset"] ?? "USDC"),
          p_stake: num(args["stake"]),
          p_tx_hash: input.txHash,
        })
      ).error,
    );
  }

  if (input.eventName === "MatchJoined") {
    fail(
      "Could not join the match",
      (
        await supabase.rpc("join_staked_match", {
          p_match_id: String(args["matchId"]),
          p_wallet: wallet,
          p_tx_hash: input.txHash,
        })
      ).error,
    );
  }

  if (input.eventName === "WinningsClaimed" || input.eventName === "RewardClaimed") {
    fail(
      "Could not record the reward claim",
      (
        await supabase.rpc("record_reward_claim", {
          p_source:
            input.eventName === "WinningsClaimed" ? "StakedMatchVault" : "FactsRewardDistributor",
          p_asset: String(args["asset"] ?? "FACTS"),
          p_wallet: wallet,
          p_amount: num(args["amount"]),
          p_tx_hash: input.txHash,
        })
      ).error,
    );
  }

  await supabase.rpc("upsert_wallet_profile", { p_wallet: wallet });

  return { ok: true, txHash: input.txHash, block: Number(receipt.blockNumber) };
}

export async function fetchChainActivity() {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("onchain_events")
    .select("contract,event_name,tx_hash,wallet,args,created_at")
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

export async function fetchOpenMatches() {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("staked_matches")
    .select("match_id,match_key,creator,asset,stake,status,created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

/** Verifies a reward-distributor claim tx and returns its sender + block. */
export async function verifyRewardClaimTx(txHash: string) {
  const receipt = await getReceipt(txHash as `0x${string}`);
  if (receipt.status !== "success") throw new Error("Claim transaction reverted onchain");
  const touches = receipt.logs.some(
    (log) => log.address.toLowerCase() === REWARD_DISTRIBUTOR_ADDRESS.toLowerCase(),
  );
  if (!touches) throw new Error("Transaction does not touch the reward distributor");
  return { from: receipt.from.toLowerCase(), blockNumber: Number(receipt.blockNumber) };
}

/**
 * Season standings: Ranked Facts Points only, and only for wallets holding an
 * active Season Pass. Everyone else is invisible on the leaderboard.
 */
export async function fetchLeaderboard(limit = 50) {
  const supabase = getSupabasePublic();
  const { data } = await supabase.rpc("leaderboard_ranked", { p_limit: limit });
  return (data ?? []).map((p) => ({
    wallet: p.wallet,
    name: p.handle ?? `${p.wallet.slice(0, 6)}…${p.wallet.slice(-4)}`,
    fp: Number(p.fp ?? 0),
    wins: Number(p.wins ?? 0),
    losses: Number(p.losses ?? 0),
  }));
}

/** Verified House Boss payouts — USDC claimed out of the match vault. */
export async function fetchHouseWinners(limit = 10) {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("reward_claims")
    .select("wallet,amount,tx_hash,created_at")
    .eq("source", "StakedMatchVault")
    .eq("asset", "USDC")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r, i) => ({
    rank: i + 1,
    name: `${r.wallet.slice(0, 6)}…${r.wallet.slice(-4)}`,
    code: (r.tx_hash ?? "").slice(0, 12).toUpperCase(),
    reward: Number(r.amount ?? 0),
    date: new Date(r.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));
}

/** Handles of every registered FarAction player. */
export async function fetchPlayerHandles(): Promise<string[]> {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("players")
    .select("handle")
    .not("handle", "is", null)
    .limit(500);
  return (data ?? []).map((p) => (p.handle ?? "").toLowerCase()).filter(Boolean);
}
