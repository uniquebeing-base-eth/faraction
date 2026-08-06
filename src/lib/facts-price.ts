import { useQuery } from "@tanstack/react-query";
import { getFactsQuote } from "./facts-price.functions";
import type { FactsQuote } from "./facts-price.server";

export type { FactsQuote };

export const factsQuoteQuery = {
  queryKey: ["facts-quote"] as const,
  queryFn: () => getFactsQuote(),
  refetchInterval: 30_000,
  staleTime: 15_000,
};

/** Live FACTS market quote, refreshed every 30s across the whole app. */
export function useFactsPrice() {
  const q = useQuery(factsQuoteQuery);
  return {
    quote: q.data ?? null,
    price: q.data?.price ?? null,
    change24h: q.data?.change24h ?? null,
    isLoading: q.isLoading,
  };
}

/** Convert a USD amount into FACTS at the live market price. */
export function usdToFacts(usd: number, price: number | null): number | null {
  if (!price || price <= 0) return null;
  return usd / price;
}

/** Convert FACTS into USD at the live market price. */
export function factsToUsd(facts: number, price: number | null): number | null {
  if (!price || price <= 0) return null;
  return facts * price;
}

/** Display helper: 53.8 FACTS, 1,240 FACTS, 2.4M FACTS. */
export function formatFactsAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return Math.round(n).toLocaleString();
  return n.toFixed(1);
}

export function formatUsdPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(3)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.000001) return `$${price.toFixed(8).replace(/0+$/, "")}`;
  // Sub-micro-cent prices: keep 3 significant digits (e.g. $0.000000185).
  const decimals = Math.min(18, Math.ceil(-Math.log10(price)) + 2);
  return `$${price.toFixed(decimals).replace(/0+$/, "")}`;
}
