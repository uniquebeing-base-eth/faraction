import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const wallet = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "A Base wallet address is required");

const statusSchema = z.object({ wallet });

const recordSchema = z.object({
  wallet,
  amount: z.number().nonnegative().max(1_000_000_000_000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  campaignIds: z.array(z.string().max(32)).max(64).default([]),
});

/** Whether this wallet has already claimed today, plus its claim streak. */
export const dailyClaimStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data }) => {
    const { getDailyClaimStatus } = await import("./daily.server");
    return getDailyClaimStatus(data.wallet);
  });

/** Record a verified onchain daily claim (one per wallet per UTC day). */
export const recordDailyClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recordSchema.parse(d))
  .handler(async ({ data }) => {
    const { saveDailyClaim } = await import("./daily.server");
    return saveDailyClaim(data);
  });
