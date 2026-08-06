/**
 * Client-side payment flows. Each one broadcasts a real transaction on Base
 * from the player's wallet, then hands the tx hash to the server, which
 * verifies it against the chain before issuing a receipt.
 */
import { MATCH_ENTRY_FEE_USDC } from "@/lib/config";
import { payUsdcToTreasury, payWithFacts } from "@/lib/onchain/actions";
import {
  payCardUnlock,
  payMatchEntryFee,
  paySeasonPass,
  verifyPayment,
} from "@/lib/payments.functions";

import type { PassPlanId } from "@/lib/game/pass";

/** Pay the flat entry fee for a match and return the verified receipt. */
export async function chargeEntryFee(options: {
  matchId: string;
  mode: "ranked" | "house" | "1v1";
  payer: string;
}) {
  const tx = await payUsdcToTreasury({
    amountUsdc: MATCH_ENTRY_FEE_USDC,
    memo: `entry:${options.matchId}`,
  });
  const receipt = await payMatchEntryFee({
    data: {
      matchId: options.matchId,
      mode: options.mode,
      payer: options.payer,
      wallet: tx.account,
      txHash: tx.hash,
    },
  });
  const check = await verifyPayment({
    data: { kind: "entry-fee", reference: options.matchId },
  });
  if (!check.verified) throw new Error("Entry fee could not be verified onchain.");
  return receipt;
}

/** Buy a Season Pass with USDC (treasury) or FACTS (payment gateway). */
export async function purchaseSeasonPass(options: {
  plan: PassPlanId;
  payer: string;
  token: "USDC" | "FACTS";
  priceUsdc: number;
  amountFacts: number | null;
}) {
  let txHash: string;
  let wallet: string;

  if (options.token === "USDC") {
    const tx = await payUsdcToTreasury({
      amountUsdc: options.priceUsdc,
      memo: `season-pass:${options.plan}`,
    });
    txHash = tx.hash;
    wallet = tx.account;
  } else {
    if (!options.amountFacts) throw new Error("FACTS price is still loading — try again.");
    const { getWalletClient } = await import("@/lib/onchain/wallet");
    const { account } = await getWalletClient();
    const tx = await payWithFacts({
      sku: `season-pass:${options.plan}`,
      kind: "season-pass",
      amountFacts: options.amountFacts,
      usdValue: options.priceUsdc,
    });
    txHash = tx.hash;
    wallet = account;
  }

  return paySeasonPass({
    data: { plan: options.plan, payer: options.payer, wallet, token: options.token, txHash },
  });
}

/** Unlock a premium card by paying its FACTS price through the gateway. */
export async function purchaseCard(options: {
  cardId: string;
  payer: string;
  amountFacts: number;
}) {
  const { getWalletClient } = await import("@/lib/onchain/wallet");
  const { account } = await getWalletClient();
  const tx = await payWithFacts({
    sku: `card:${options.cardId}`,
    kind: "store",
    amountFacts: options.amountFacts,
  });
  const receipt = await payCardUnlock({
    data: {
      cardId: options.cardId,
      payer: options.payer,
      wallet: account,
      amountFacts: options.amountFacts,
      txHash: tx.hash,
    },
  });
  const check = await verifyPayment({
    data: { kind: "card-unlock", reference: `${account.toLowerCase()}:${options.cardId}` },
  });
  if (!check.verified) throw new Error("The card payment could not be verified onchain.");
  return receipt;
}
