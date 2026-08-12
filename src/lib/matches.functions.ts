import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^FAR\d{5,10}$/, "Match codes look like FAR1234567");

const createSchema = z.object({
  matchId: codeSchema,
  mode: z.enum(["ranked", "house", "1v1"]),
  staked: z.boolean(),
  token: z.enum(["FACTS", "USDC"]),
  stake: z.number().min(0).max(1e12),
  difficulty: z.number().int().min(0).max(2),
  hostHandle: z.string().min(1).max(64),
  hostFid: z.number().int().positive().nullish(),
  hostWallet: z.string().max(64).nullish(),
  hostFighterId: z.string().min(1).max(32),
  invitedUsername: z.string().max(64).nullish(),
  invitedFid: z.number().int().positive().nullish(),
});

const joinSchema = z.object({
  matchId: codeSchema,
  handle: z.string().min(1).max(64),
  fid: z.number().int().positive().nullish(),
  wallet: z.string().max(64).nullish(),
  fighterId: z.string().min(1).max(32),
});

/** Persist a new match and announce open Ranked bouts to every opted-in player. */
export const createMatchRecord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const { dbCreateMatch } = await import("./matches.server");
    const row = await dbCreateMatch(data);

    if (data.mode === "ranked") {
      const { sendMiniAppNotification } = await import("./notifications.server");
      const { matchUrl } = await import("./config");
      await sendMiniAppNotification({
        title: "Ranked match open ⚔️",
        body: `${data.hostHandle} opened Ranked match ${data.matchId}. First to tap in fights.`,
        targetUrl: matchUrl(data.matchId),
        notificationId: `ranked-open-${data.matchId}`,
      }).catch((e) => console.error("Ranked broadcast failed", e));
    }
    return row;
  });

/** Join an existing match by code and ping the host. */
export const joinMatchRecord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => joinSchema.parse(d))
  .handler(async ({ data }) => {
    const { dbJoinMatch } = await import("./matches.server");
    const row = await dbJoinMatch(data);

    if (row.host_fid) {
      const { sendMiniAppNotification } = await import("./notifications.server");
      const { matchUrl } = await import("./config");
      await sendMiniAppNotification({
        fids: [row.host_fid],
        title: "Opponent joined ⚔️",
        body: `${data.handle} accepted ${row.match_id}. Head to the lobby and start the bout.`,
        targetUrl: matchUrl(row.match_id),
        notificationId: `join-${row.match_id}`,
      }).catch((e) => console.error("Join notification failed", e));
    }
    return row;
  });

/** Resolve a match code — the single source of truth behind every invite link. */
export const fetchMatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ matchId: codeSchema }).parse(d))
  .handler(async ({ data }) => {
    const { dbGetMatch } = await import("./matches.server");
    return await dbGetMatch(data.matchId);
  });

/** Ranked bouts waiting for an opponent. */
export const listOpenRankedMatches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { dbListOpenRanked } = await import("./matches.server");
    return await dbListOpenRanked(data.limit ?? 30);
  });

/** Active matches for this player, so a reopened app restores the bout. */
export const listMyMatches = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { dbListMyMatches } = await import("./matches.server");
    return await dbListMyMatches(data.handle);
  });

/** Record that one side paid the entry fee; both paid flips the match to ready. */
export const markMatchPaid = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ matchId: codeSchema, role: z.enum(["host", "joiner"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { dbSetMatchPaid } = await import("./matches.server");
    const row = await dbSetMatchPaid(data.matchId, data.role);

    if (row.status === "ready") {
      const fids = [row.host_fid, row.joiner_fid].filter((f): f is number => Boolean(f));
      if (fids.length) {
        const { sendMiniAppNotification } = await import("./notifications.server");
        const { matchUrl } = await import("./config");
        await sendMiniAppNotification({
          fids,
          title: "Battle starting 🔥",
          body: `${row.match_id} is fully staked. Lock your deck and fight.`,
          targetUrl: matchUrl(row.match_id),
          notificationId: `start-${row.match_id}`,
        }).catch((e) => console.error("Match start notification failed", e));
      }
    }
    return row;
  });

/** Save a player's fighter + deck and mark them ready for the shared 1v1 bout. */
export const revealMatchSlot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        matchId: codeSchema,
        role: z.enum(["host", "joiner"]),
        slot: z.number().int().min(0).max(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { dbRevealSlot } = await import("./matches.server");
    return await dbRevealSlot(data);
  });

/** Close the current round for both players and reset the reveal counters. */
export const advanceMatchRound = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        matchId: codeSchema,
        hostWins: z.number().int().min(0).max(3),
        joinerWins: z.number().int().min(0).max(3),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { dbAdvanceRound } = await import("./matches.server");
    return await dbAdvanceRound(data);
  });

/** Pick the shared battle environment. */
export const setMatchArena = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        matchId: codeSchema,
        arena: z.enum(["nexus", "mountain", "volcano", "city", "forest", "void"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { dbSetMatchArena } = await import("./matches.server");
    return await dbSetMatchArena(data.matchId, data.arena);
  });

export const setMatchLoadout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        matchId: codeSchema,
        role: z.enum(["host", "joiner"]),
        fighterId: z.string().min(1).max(32),
        deck: z.array(z.string().min(1).max(64)),
        ready: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { dbSetMatchLoadout } = await import("./matches.server");
    return await dbSetMatchLoadout(data);
  });

/** Cancel or complete a match. */
export const updateMatchStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        matchId: codeSchema,
        status: z.enum(["open", "locked", "ready", "playing", "complete", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { dbSetMatchStatus } = await import("./matches.server");
    const row = await dbSetMatchStatus(data.matchId, data.status);

    // Close the loop: both fighters hear about the result (and their rewards)
    // even if they left the app mid-bout.
    if (data.status === "complete" || data.status === "cancelled") {
      const fids = [row.host_fid, row.joiner_fid].filter((f): f is number => Boolean(f));
      if (fids.length) {
        const { sendMiniAppNotification } = await import("./notifications.server");
        const { matchUrl } = await import("./config");
        const complete = data.status === "complete";
        await sendMiniAppNotification({
          fids,
          title: complete ? "Bout settled 🏆" : "Match cancelled",
          body: complete
            ? `${row.match_id} is over. Open FarAction to see the result and claim rewards.`
            : `${row.match_id} was cancelled. Any stake stays claimable in the arena.`,
          targetUrl: matchUrl(row.match_id),
          notificationId: `${data.status}-${row.match_id}`,
        }).catch((e) => console.error("Match result notification failed", e));
      }
    }
    // If this was a staked match, attempt backend settlement via the vault.
    if (data.status === "complete" && row.staked) {
      try {
        // Prevent duplicate settlement if already settled in DB.
        if (row.settled_at) {
          console.log(`Match ${row.match_id} already settled, skipping vault call.`);
        } else {
          const { signerWallet } = await import("./signer.server");
          const { publicClient } = await import("./onchain/wallet");
          const { MATCH_VAULT_ABI, MATCH_VAULT_ADDRESS } = await import("./onchain/contracts");
          const { toBytes32, waitForReceiptSoft } = await import("./onchain/actions");

          // Determine recorded winner wallet from the match rows (host vs joiner wins).
          const hostWins = Number(row.host_round_wins ?? 0);
          const joinerWins = Number(row.joiner_round_wins ?? 0);
          const winnerWallet = hostWins > joinerWins ? row.host_wallet : row.joiner_wallet;
          if (!winnerWallet) throw new Error("Cannot settle: winner wallet not recorded");

          const matchIdBytes = toBytes32(row.match_id);

          const { client, account } = signerWallet();

          // Simulate then send the settleMatch write from the backend signer.
          const { request } = await publicClient.simulateContract({
            address: MATCH_VAULT_ADDRESS,
            abi: MATCH_VAULT_ABI as any,
            functionName: "settleMatch",
            args: [matchIdBytes, winnerWallet],
            account: account.address,
          });
          const hash = await client.writeContract({ ...request, chain: client.chain });

          const { confirmed } = await waitForReceiptSoft(hash, "settleMatch");
          if (!confirmed) throw new Error("Settlement transaction not confirmed yet; aborting DB update.");

          // Persist the settle tx and mark winner/settled in the DB.
          const { getSupabasePublic } = await import("./supabase-public.server");
          const supabase = getSupabasePublic();
          const { error } = await supabase.rpc("settle_match_result", {
            p_match_id: row.match_id,
            p_winner_wallet: winnerWallet,
            p_settle_tx: hash,
          });
          if (error) throw error;
          console.log(`Staked match ${row.match_id} settled onchain: ${hash}`);
        }
      } catch (err) {
        console.error("Staked match settlement failed:", err);
      }
    }
    return row;
  });
