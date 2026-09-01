/**
 * Daily $FACTS rewards, paid from Facts Points.
 *
 * The quote is built server-side (it carries the backend signature the claim
 * contract verifies) and the claim itself is broadcast by the player's wallet.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const walletSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "A Base wallet address is required");

/** Points balance, payout, cooldown and the signature needed to claim. */
export const factsClaimQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ wallet: walletSchema }).parse(d))
  .handler(async ({ data }) => {
    const { buildClaimQuote } = await import("./rewards.server");
    return buildClaimQuote(data.wallet);
  });

/** Mirror a confirmed onchain claim into the ledger. */
export const recordFactsClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        wallet: walletSchema,
        amount: z.number().nonnegative().max(1e12),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { error } = await getSupabasePublic().rpc("record_reward_claim", {
      p_source: "daily-points",
      p_asset: "FACTS",
      p_wallet: data.wallet.toLowerCase(),
      p_amount: data.amount,
      p_tx_hash: data.txHash,
    });
    if (error) throw new Error(error.message);

    const { buildClaimQuote } = await import("./rewards.server");
    return buildClaimQuote(data.wallet);
  });

/** One-time +1,000 FP for switching Farcaster notifications on. */
export const claimNotificationBonus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        wallet: walletSchema,
        handle: z.string().max(64).default(""),
        fid: z.number().int().positive().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { grantNotificationBonus } = await import("./rewards.server");
    return grantNotificationBonus({
      wallet: data.wallet,
      handle: data.handle,
      fid: data.fid ?? null,
    });
  });
