import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const eventSchema = z.object({
  contract: z.enum(["FactsPaymentGateway", "StakedMatchVault", "FactsRewardDistributor"]),
  eventName: z.string().min(2).max(64),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  args: z.record(z.string(), z.unknown()).default({}),
});

/** Verify a broadcast tx on Base and mirror it into the database. */
export const recordChainEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => eventSchema.parse(d))
  .handler(async ({ data }) => {
    const { saveChainEvent } = await import("./chain.server");
    return saveChainEvent(data);
  });

/** Recent onchain activity across all three contracts. */
export const listChainActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchChainActivity } = await import("./chain.server");
  return fetchChainActivity();
});

/** Staked matches that are still waiting for an opponent. */
export const listOpenStakedMatches = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchOpenMatches } = await import("./chain.server");
  return fetchOpenMatches();
});

/** Season standings from the database — real players only. */
export const listLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchLeaderboard } = await import("./chain.server");
  return fetchLeaderboard(50);
});

/** Verified House Boss winners from onchain USDC payouts. */
export const listHouseWinners = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchHouseWinners } = await import("./chain.server");
  return fetchHouseWinners(10);
});
