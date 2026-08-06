/**
 * The server's Base RPC client — the endpoint of record for confirming
 * transactions.
 *
 * The browser polls receipts through the player's own network egress, and in a
 * Farcaster client many users share one IP, so the free public nodes rate
 * limit them constantly. The server must not share that fate:
 *
 * - a keyed endpoint (`BASE_RPC_URL`, e.g. Alchemy/QuickNode/Ankr) goes first
 *   whenever it is configured;
 * - public nodes sit behind it inside a viem `fallback`, so a throttled node is
 *   transparently retried on the next one;
 * - reads are batched, collapsing many calls into a single HTTP request;
 * - retries back off exponentially on 429.
 */
import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { base } from "viem/chains";

/** Public Base nodes, used only as fallbacks behind a keyed endpoint. */
const PUBLIC_BASE_RPCS = ["https://base.llamarpc.com", "https://mainnet.base.org"];

let cached: PublicClient | null = null;

export function baseRpc(): PublicClient {
  if (cached) return cached;

  // Read env inside the call, never at module scope — injection happens at
  // request time in the worker runtime.
  const keyed = process.env["BASE_RPC_URL"];
  const urls = [keyed, ...PUBLIC_BASE_RPCS].filter(Boolean) as string[];

  cached = createPublicClient({
    chain: base,
    transport: fallback(
      urls.map((url) => http(url, { batch: { wait: 16 }, retryCount: 3, retryDelay: 800 })),
      { rank: false },
    ),
  }) as PublicClient;

  return cached;
}

/**
 * Fetch a receipt, waiting for the transaction to be mined when it is still
 * pending.
 *
 * The client hands us a hash the moment it has one — frequently before its own
 * rate-limited poll ever saw a receipt. "Not found yet" therefore means "wait",
 * not "failed"; only a `reverted` status is a real failure, and that is the
 * caller's check.
 */
export async function getReceipt(txHash: `0x${string}`) {
  const rpc = baseRpc();
  try {
    return await rpc.getTransactionReceipt({ hash: txHash });
  } catch {
    return await rpc.waitForTransactionReceipt({
      hash: txHash,
      pollingInterval: 4_000,
      retryCount: 10,
      retryDelay: 1_000,
      confirmations: 1,
      timeout: 120_000,
    });
  }
}
