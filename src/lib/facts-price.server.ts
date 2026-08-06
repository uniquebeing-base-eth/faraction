/**
 * FACTS market data — fetched from the Dexscreener pair feed on Base.
 * Server-only so the app has a single, cacheable source of truth.
 */
import { FACTS_CHAIN, FACTS_TOKEN_ADDRESS } from "./config";

export interface FactsQuote {
  /** USD price of 1 FACTS. */
  price: number;
  /** 24h price change in percent (null when the feed omits it). */
  change24h: number | null;
  /** 24h volume in USD. */
  volume24h: number | null;
  liquidityUsd: number | null;
  updatedAt: number;
  /** True when the live feed failed and a fallback price is being used. */
  stale: boolean;
}

/** Conservative fallback so the UI never breaks if the feed is unreachable. */
export const FALLBACK_PRICE = 0.000000185;

interface DexPair {
  priceUsd?: string;
  chainId?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

export async function fetchFactsQuote(): Promise<FactsQuote> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${FACTS_TOKEN_ADDRESS}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`Dexscreener responded ${res.status}`);
    const json = (await res.json()) as { pair?: DexPair; pairs?: DexPair[] };
    const candidates = (json.pairs ?? (json.pair ? [json.pair] : [])).filter(
      (p) => (!p.chainId || p.chainId === FACTS_CHAIN) && Number(p.priceUsd) > 0,
    );
    // Deepest liquidity pool is the most reliable quote for the token.
    const pair = candidates.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const price = Number(pair?.priceUsd);
    if (!pair || !Number.isFinite(price) || price <= 0) throw new Error("No price in feed");
    return {
      price,
      change24h: typeof pair.priceChange?.h24 === "number" ? pair.priceChange.h24 : null,
      volume24h: typeof pair.volume?.h24 === "number" ? pair.volume.h24 : null,
      liquidityUsd: typeof pair.liquidity?.usd === "number" ? pair.liquidity.usd : null,
      updatedAt: Date.now(),
      stale: false,
    };
  } catch {
    return {
      price: FALLBACK_PRICE,
      change24h: null,
      volume24h: null,
      liquidityUsd: null,
      updatedAt: Date.now(),
      stale: true,
    };
  }
}
