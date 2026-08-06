/**
 * FarAction runtime configuration — single source of truth for domains,
 * treasury routing and token feeds. Change it here, everywhere follows.
 */

/** Production origin. All shareable links must use this, never localhost. */
export const PROD_ORIGIN = "https://faraction.signalify.xyz";

/** Treasury wallet on Base that receives entry fees and pass payments. */
export const TREASURY_WALLET = "0xd6b69e58d44e523eb58645f1b78425c96dfa648c";

/** USDC on Base. */
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** FACTS token contract on Base — powers the live Dexscreener price feed. */
export const FACTS_TOKEN_ADDRESS = "0xb38760f61668ace43d8ee2e137d092841b23eb07";
export const FACTS_CHAIN = "base";

/** Flat entry fee (USDC) charged before any competitive match starts. */
export const MATCH_ENTRY_FEE_USDC = 0.01;

/** Live payments: every entry fee and pass purchase settles onchain on Base. */
export const PAYMENTS_DEMO_MODE = false;

export function inviteUrl(matchId: string): string {
  return `${PROD_ORIGIN}/invite/${matchId}`;
}

export function matchUrl(matchId: string): string {
  return `${PROD_ORIGIN}/match/${matchId}`;
}
