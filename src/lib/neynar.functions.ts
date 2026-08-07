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
  // A Farcaster user found without a fid (FarAction-only player) can still be
  // challenged — they just get the cast instead of a push notification.
  toFid: z.number().int().nonnegative().nullish(),
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
    const { stripAt } = await import("./neynar.server");
    // Short, readable invite: the match row already holds every detail.
    const url = inviteUrl(data.matchId);
    const to = stripAt(data.toUsername);
    const text = `@${to} I'm challenging you to a FarAction 1 vs 1 (${data.matchId}). Accept the bout ⚔️`;

    // Direct push through Neynar when we know who to ping.
    const notification =
      data.toFid && data.toFid > 0
        ? await (async () => {
            const { sendMiniAppNotification } = await import("./notifications.server");
            return sendMiniAppNotification({
              fids: [data.toFid as number],
              title: "New challenge ⚔️",
              body: `${data.fromHandle} challenged you to a 1 vs 1. Match ${data.matchId}.`,
              targetUrl: url,
              notificationId: `challenge-${data.matchId}-${data.toFid}`,
            }).catch((e) => {
              console.error("Challenge notification failed", e);
              return { sent: 0 };
            });
          })()
        : { sent: 0 };

    return {
      matchId: data.matchId,
      inviteUrl: url,
      castText: text,
      composeUrl: `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
        text,
      )}&embeds[]=${encodeURIComponent(url)}`,
      sentAt: Date.now(),
      notificationSent: notification.sent > 0,
    };
  });

/** Notify the host that someone has joined their match. */
export const notifyHostOfJoin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notifyJoinSchema.parse(d))
  .handler(async ({ data }) => {
    const { matchUrl } = await import("./config");
    const { sendMiniAppNotification } = await import("./notifications.server");

    return await sendMiniAppNotification({
      fids: [data.hostFid],
      title: "Opponent joined ⚔️",
      body: `${data.joinerHandle} has joined match ${data.matchId}. Get ready!`,
      targetUrl: matchUrl(data.matchId),
      notificationId: `join-${data.matchId}-${data.hostFid}`,
    }).catch((e) => {
      console.error("Join notification failed", e);
      return { sent: 0 };
    });
  });
