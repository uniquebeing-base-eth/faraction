import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const txHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "A Base transaction hash is required");
const wallet = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "A Base wallet address is required");

const entrySchema = z.object({
  matchId: z.string().min(3).max(64),
  mode: z.enum(["ranked", "house", "1v1"]),
  payer: z.string().min(1).max(120),
  wallet,
  txHash,
});

const passSchema = z.object({
  plan: z.enum(["15d", "30d", "50d"]),
  payer: z.string().min(1).max(120),
  wallet,
  token: z.enum(["USDC", "FACTS"]),
  txHash,
});

const cardSchema = z.object({
  cardId: z.string().min(1).max(64),
  payer: z.string().min(1).max(120),
  wallet,
  amountFacts: z.number().positive(),
  txHash,
});

const verifySchema = z.object({
  kind: z.enum(["entry-fee", "season-pass", "card-unlock"]),
  reference: z.string().min(1).max(128),
});


/**
 * Confirm the flat 0.01 USDC entry fee. The transfer is broadcast from the
 * player's wallet; this verifies it landed in the treasury and stores the
 * receipt that gates the match.
 */
export const payMatchEntryFee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entrySchema.parse(d))
  .handler(async ({ data }) => {
    const { MATCH_ENTRY_FEE_USDC } = await import("./config");
    const { assertValidEntryFee, recordPayment, verifyUsdcToTreasury } =
      await import("./payments.server");
    assertValidEntryFee(MATCH_ENTRY_FEE_USDC);
    const onchain = await verifyUsdcToTreasury(data.txHash, MATCH_ENTRY_FEE_USDC);
    return recordPayment({
      kind: "entry-fee",
      reference: data.matchId,
      payer: data.payer,
      wallet: data.wallet,
      token: "USDC",
      amount: onchain.amount,
      usdValue: onchain.amount,
      txHash: data.txHash,
    });
  });

/** Confirm a Season Pass purchase paid in USDC (treasury) or FACTS (gateway). */
export const paySeasonPass = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => passSchema.parse(d))
  .handler(async ({ data }) => {
    const { planById } = await import("./game/pass");
    const { recordPayment, verifyGatewayPayment, verifyUsdcToTreasury } =
      await import("./payments.server");
    const { fetchFactsQuote } = await import("./facts-price.server");
    const plan = planById(data.plan);
    const quote = await fetchFactsQuote();

    let amount: number;
    if (data.token === "USDC") {
      const onchain = await verifyUsdcToTreasury(data.txHash, plan.priceUsdc);
      amount = onchain.amount;
    } else {
      await verifyGatewayPayment(data.txHash);
      amount = +(plan.priceUsdc / quote.price).toFixed(4);
    }

    const receipt = await recordPayment({
      kind: "season-pass",
      reference: `${data.wallet.toLowerCase()}:${plan.id}:${data.txHash}`,
      payer: data.payer,
      wallet: data.wallet,
      token: data.token,
      amount,
      usdValue: plan.priceUsdc,
      txHash: data.txHash,
    });
    // Season Pass eligibility for the leaderboard is stored server-side so the
    // ranking cannot be faked from the browser.
    const { activateSeasonPass } = await import("./payments.server");
    await activateSeasonPass(data.wallet, plan.days);

    return { receipt, plan, quotePrice: quote.price };
  });

/** Backend gate: a match may only begin once its payment is verified. */
export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data }) => {
    const { findPayment } = await import("./payments.server");
    const receipt = await findPayment(data.kind, data.reference);
    return { verified: Boolean(receipt), receipt };
  });

/** Confirm a premium card unlock paid in FACTS through the payment gateway. */
export const payCardUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cardSchema.parse(d))
  .handler(async ({ data }) => {
    const { recordPayment, verifyGatewayPayment } = await import("./payments.server");
    const { fetchFactsQuote } = await import("./facts-price.server");
    await verifyGatewayPayment(data.txHash);
    const quote = await fetchFactsQuote();
    return recordPayment({
      kind: "card-unlock",
      reference: `${data.wallet.toLowerCase()}:${data.cardId}`,
      payer: data.payer,
      wallet: data.wallet,
      token: "FACTS",
      amount: data.amountFacts,
      usdValue: +(data.amountFacts * quote.price).toFixed(4),
      txHash: data.txHash,
    });
  });

/** Every premium card this wallet has paid for, straight from stored receipts. */
export const listCardUnlocks = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ wallet }).parse(d))
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("list_card_unlocks", {
      p_wallet: data.wallet.toLowerCase(),
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => String(r.card_id)).filter(Boolean);
  });
