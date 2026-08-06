import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(1).max(60),
  limit: z.number().int().min(1).max(20).optional(),
});

const challengeSchema = z.object({
  matchId: z.string().min(3).max(64),
  fromHandle: z.string().min(1).max(120),
  toUsername: z.string().min(1).max(60),
  toFid: z.number().int().positive(),
});

/** Search Farcaster users (and existing FarAction players) by handle or name. */
export const searchUsers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => searchSchema.parse(d))
  .handler(async ({ data }) => {
    const { searchFarcasterUsers } = await import("./neynar.server");
    try {
      return { users: await searchFarcasterUsers(data.query, data.limit ?? 8), error: null };
    } catch (e) {
      console.error("Neynar search error", e);
      return { users: [], error: "Farcaster directory unavailable right now." };
    }
  });

/** Register a challenge and return the cast text + invite link to broadcast. */
export const createChallenge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => challengeSchema.parse(d))
  .handler(async ({ data }) => {
    const { inviteUrl } = await import("./config");
    const url = inviteUrl(data.matchId);
    return {
      matchId: data.matchId,
      inviteUrl: url,
      castText: `@${data.toUsername} I'm challenging you to a FarAction 1 vs 1 (${data.matchId}). Accept the bout ⚔️`,
      composeUrl: `https://warpcast.com/~/compose?text=${encodeURIComponent(
        `@${data.toUsername} I'm challenging you to a FarAction 1 vs 1 (${data.matchId}). Accept the bout ⚔️`,
      )}&embeds[]=${encodeURIComponent(url)}`,
      sentAt: Date.now(),
    };
  });
