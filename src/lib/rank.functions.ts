import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const resultSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  handle: z.string().max(64).default(""),
  fp: z.number().int().min(0).max(100_000),
  won: z.boolean(),
});

/**
 * Record a Ranked match result. Only Ranked FP counts toward the Season
 * leaderboard, so casual results never reach this endpoint.
 */
export const recordRankedResult = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resultSchema.parse(d))
  .handler(async ({ data }) => {
    const { saveRankedResult } = await import("./rank.server");
    return saveRankedResult(data);
  });
