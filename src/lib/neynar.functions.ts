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

const notifyJoinSchema = z.object({
  matchId: z.string().min(3).max(64),
  joinerHandle: z.string().min(1).max(120),
  hostFid: z.number().int().positive(),
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
    
    // Attempt to send a direct push notification via the Mini App SDK / Neynar
    const { sendMiniAppNotification } = await import("./notifications.server");
    const notification = await sendMiniAppNotification({
      fids: [data.toFid],
      title: "New Challenge ⚔️",
      body: `${data.fromHandle} challenged you to a 1 vs 1 FarAction battle.`,
      targetUrl: url,
      notificationId: `challenge-${data.matchId}-${data.toFid}`,
    }).catch(() => ({ sent: 0 }));

    return {
      matchId: data.matchId,
      inviteUrl: url,
      castText: `@${data.toUsername} I'm challenging you to a FarAction 1 vs 1 (${data.matchId}). Accept the bout ⚔️`,
      composeUrl: `https://warpcast.com/~/compose?text=${encodeURIComponent(
        `@${data.toUsername} I'm challenging you to a FarAction 1 vs 1 (${data.matchId}). Accept the bout ⚔️`,
      )}&embeds[]=${encodeURIComponent(url)}`,
      sentAt: Date.now(),
      notificationSent: notification.sent > 0,
    };
  });

/** Notify the host that someone has joined their match. */
export const notifyHostOfJoin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notifyJoinSchema.parse(d))
  .handler(async ({ data }) => {
    const { inviteUrl } = await import("./config");
    const { sendMiniAppNotification } = await import("./notifications.server");
    
    // Point the host to the lobby for that match
    const url = `${inviteUrl(data.matchId).replace("/invite/", "/match/")}`;
    
    return await sendMiniAppNotification({
      fids: [data.hostFid],
      title: "Opponent Joined! ⚔️",
      body: `${data.joinerHandle} has joined your match ${data.matchId}. Get ready!`,
      targetUrl: url,
      notificationId: `join-${data.matchId}-${data.hostFid}`,
    }).catch(() => ({ sent: 0 }));
  });
