/**
 * Daily $FACTS claim, backed by the points reward contract on Base.
 *
 * Players earn Facts Points in battle; the contract pays 500 $FACTS per 1,000
 * FP and enforces its own 24 hour cooldown. Each claim needs a signature from
 * the backend signer over `getMessageHash(user, "FACTS", points)`, which is
 * produced here and never in the browser.
 */
import { baseRpc } from "./base-rpc.server";
import { getSupabasePublic } from "./supabase-public.server";
import { signerAccount } from "./signer.server";
import { FACTS_CLAIM_ABI, FACTS_CLAIM_ADDRESS, FACTS_CLAIM_SYMBOL } from "./onchain/contracts";

/** $FACTS paid per 1,000 Facts Points. */
export const FACTS_PER_1000_FP = 500;

export interface ClaimQuote {
  wallet: string;
  points: number;
  /** $FACTS the contract will pay for those points. */
  reward: number;
  canClaim: boolean;
  secondsUntilNextClaim: number;
  /** Backend signature the wallet passes to `claimReward`. */
  signature: string | null;
  contractBalance: number;
  reason: string | null;
}

/** Facts Points on record for a wallet. */
export async function pointsForWallet(wallet: string): Promise<number> {
  const { data } = await getSupabasePublic().rpc("get_player", { p_wallet: wallet.toLowerCase() });
  const row = (data ?? [])[0];
  return Math.max(0, Number(row?.fp ?? 0));
}

export async function buildClaimQuote(walletRaw: string): Promise<ClaimQuote> {
  const wallet = walletRaw.toLowerCase() as `0x${string}`;
  const rpc = baseRpc();
  const points = await pointsForWallet(wallet);

  const [canClaim, waitFor, reward, balance] = await Promise.all([
    rpc.readContract({
      address: FACTS_CLAIM_ADDRESS,
      abi: FACTS_CLAIM_ABI,
      functionName: "canClaimToday",
      args: [wallet, FACTS_CLAIM_SYMBOL],
    }) as Promise<boolean>,
    rpc.readContract({
      address: FACTS_CLAIM_ADDRESS,
      abi: FACTS_CLAIM_ABI,
      functionName: "getTimeUntilNextClaim",
      args: [wallet, FACTS_CLAIM_SYMBOL],
    }) as Promise<bigint>,
    rpc.readContract({
      address: FACTS_CLAIM_ADDRESS,
      abi: FACTS_CLAIM_ABI,
      functionName: "calculateReward",
      args: [FACTS_CLAIM_SYMBOL, BigInt(points)],
    }) as Promise<bigint>,
    rpc.readContract({
      address: FACTS_CLAIM_ADDRESS,
      abi: FACTS_CLAIM_ABI,
      functionName: "getContractBalance",
      args: [FACTS_CLAIM_SYMBOL],
    }) as Promise<bigint>,
  ]);

  const rewardFacts = Number(reward) / 1e18;
  const balanceFacts = Number(balance) / 1e18;

  let reason: string | null = null;
  if (points <= 0) reason = "Win battles to earn Facts Points before claiming.";
  else if (!canClaim) reason = "Your next claim unlocks 24 hours after the last one.";
  else if (rewardFacts <= 0) reason = "You need at least 1,000 FP for a payout.";
  else if (balanceFacts < rewardFacts) reason = "The reward pool is being topped up — try later.";

  let signature: string | null = null;
  if (!reason) {
    const hash = (await rpc.readContract({
      address: FACTS_CLAIM_ADDRESS,
      abi: FACTS_CLAIM_ABI,
      functionName: "getMessageHash",
      args: [wallet, FACTS_CLAIM_SYMBOL, BigInt(points)],
    })) as `0x${string}`;
    // The contract wraps the hash with the standard Ethereum prefix before
    // recovering the signer, which is exactly what `signMessage({ raw })` does.
    signature = await signerAccount().signMessage!({ message: { raw: hash } });
  }

  return {
    wallet,
    points,
    reward: rewardFacts,
    canClaim: canClaim && !reason,
    secondsUntilNextClaim: Number(waitFor),
    signature,
    contractBalance: balanceFacts,
    reason,
  };
}

/** Award the one-time +1,000 FP bonus for turning notifications on. */
export async function grantNotificationBonus(input: {
  wallet: string;
  handle: string;
  fid: number | null;
}) {
  const { data, error } = await getSupabasePublic().rpc("award_notification_bonus", {
    p_wallet: input.wallet.toLowerCase(),
    p_handle: input.handle,
    p_fid: input.fid ?? 0,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return { fp: Number(row?.fp ?? 0), awarded: Boolean(row?.awarded) };
}