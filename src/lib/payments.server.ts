/**
 * Payment verification layer — live onchain settlement.
 *
 * Entry fees and Season Pass purchases are broadcast from the player's wallet
 * on Base (USDC transfer to the treasury, or FACTS through the payment
 * gateway). This module verifies the broadcast transaction against the chain
 * and persists the receipt, so a match can only start after real payment.
 */
import { decodeEventLog, type Address } from "viem";
import { getReceipt } from "./base-rpc.server";
import { MATCH_ENTRY_FEE_USDC, TREASURY_WALLET, USDC_ADDRESS } from "./config";
import { PAYMENT_GATEWAY_ADDRESS, USDC_DECIMALS } from "./onchain/contracts";
import { getSupabasePublic } from "./supabase-public.server";


const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

export type PaymentKind = "entry-fee" | "season-pass" | "card-unlock";
export type PayToken = "USDC" | "FACTS";

export interface Receipt {
  id: string;
  kind: PaymentKind;
  reference: string;
  payer: string;
  token: PayToken;
  amount: number;
  usdValue: number | null;
  treasury: string;
  txHash: string;
  paidAt: number;
}

/** Validates an entry-fee request before it is recorded. */
export function assertValidEntryFee(amountUsd: number) {
  if (Math.abs(amountUsd - MATCH_ENTRY_FEE_USDC) > 1e-9) {
    throw new Error(`Entry fee must be exactly ${MATCH_ENTRY_FEE_USDC} USDC`);
  }
}

/**
 * Confirms a USDC transfer to the treasury inside a mined transaction and
 * returns the transferred amount (in USDC).
 */
export async function verifyUsdcToTreasury(txHash: string, minAmount: number) {
  const receipt = await getReceipt(txHash as `0x${string}`);
  if (receipt.status !== "success") throw new Error("Transaction reverted onchain");

  let paid = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics });
      const to = (decoded.args as { to: Address }).to.toLowerCase();
      if (to !== TREASURY_WALLET.toLowerCase()) continue;
      paid += (decoded.args as { value: bigint }).value;
    } catch {
      // Not a Transfer log — ignore.
    }
  }

  const amount = Number(paid) / 10 ** USDC_DECIMALS;
  // 0.5% tolerance covers rounding on the client side.
  if (amount + 1e-9 < minAmount * 0.995) {
    throw new Error(
      `Transaction does not pay the treasury: expected ${minAmount} USDC, found ${amount}`,
    );
  }
  return { amount, blockNumber: Number(receipt.blockNumber), from: receipt.from.toLowerCase() };
}

/** Confirms a FACTS payment routed through the onchain payment gateway. */
export async function verifyGatewayPayment(txHash: string) {
  const receipt = await getReceipt(txHash as `0x${string}`);
  if (receipt.status !== "success") throw new Error("Transaction reverted onchain");
  const touchesGateway = receipt.logs.some(
    (log) => log.address.toLowerCase() === PAYMENT_GATEWAY_ADDRESS.toLowerCase(),
  );
  if (!touchesGateway) throw new Error("Transaction does not touch the payment gateway");
  return { blockNumber: Number(receipt.blockNumber), from: receipt.from.toLowerCase() };
}

/** Persists a verified receipt. */
export async function recordPayment(input: {
  kind: PaymentKind;
  reference: string;
  payer: string;
  wallet: string;
  token: PayToken;
  amount: number;
  usdValue: number | null;
  txHash: string;
}): Promise<Receipt> {
  const supabase = getSupabasePublic();
  const wallet = input.wallet.toLowerCase();

  await supabase.rpc("upsert_wallet_profile", { p_wallet: wallet, p_handle: input.payer });

  const { data: rows, error } = await supabase.rpc("record_payment_receipt", {
    p_kind: input.kind,
    p_sku: input.kind,
    p_payment_ref: input.reference,
    p_payer: wallet,
    p_beneficiary: wallet,
    p_token: input.token,
    p_amount: input.amount,
    p_usd_value: input.usdValue as number,
    p_tx_hash: input.txHash,
  });
  const data = rows?.[0];
  if (error) throw new Error(`Could not store the payment receipt: ${error.message}`);
  if (!data) throw new Error("Could not store the payment receipt");

  return {
    id: data.id,
    kind: input.kind,
    reference: input.reference,
    payer: input.payer,
    token: input.token,
    amount: input.amount,
    usdValue: input.usdValue,
    treasury: TREASURY_WALLET,
    txHash: input.txHash,
    paidAt: new Date(data.created_at).getTime(),
  };
}

/** Extends the wallet's Season Pass window (leaderboard eligibility). */
export async function activateSeasonPass(wallet: string, days: number) {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("activate_season_pass", {
    p_wallet: wallet.toLowerCase(),
    p_days: days,
  });
  if (error) throw new Error(`Could not activate the Season Pass: ${error.message}`);
  return { expiresAt: data as string | null };
}

export async function findPayment(kind: PaymentKind, reference: string): Promise<Receipt | null> {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("payments")
    .select("id,kind,payment_ref,payer,token,amount,usd_value,tx_hash,status,created_at")
    .eq("kind", kind)
    .eq("payment_ref", reference)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    kind: data.kind as PaymentKind,
    reference: data.payment_ref,
    payer: data.payer,
    token: data.token as PayToken,
    amount: Number(data.amount),
    usdValue: data.usd_value == null ? null : Number(data.usd_value),
    treasury: TREASURY_WALLET,
    txHash: data.tx_hash ?? "",
    paidAt: new Date(data.created_at).getTime(),
  };
}
