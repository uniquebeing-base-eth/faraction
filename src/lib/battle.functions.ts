/**
 * Battle results.
 *
 * Every finished bout — House, Ranked or 1 vs 1 — is written to the database
 * here, so wins, losses, FP and tournament points survive a reinstall and the
 * leaderboards stay honest. Result notifications go out from the same call.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  handle: z.string().max(64).default(""),
  fp: z.number().int().min(0).max(1_000_000),
  won: z.boolean(),
  ranked: z.boolean().default(false),
  tournamentId: z.string().uuid().nullish(),
  tp: z.number().int().min(0).max(100_000).default(0),
  matchId: z.string().max(32).nullish(),
  opponentHandle: z.string().max(64).nullish(),
  opponentFid: z.number().int().positive().nullish(),
  fid: z.number().int().positive().nullish(),
  payout: z.string().max(64).nullish(),
});

export const recordBattleOutcome = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("record_battle_result", {
      p_wallet: data.wallet.toLowerCase(),
      p_handle: data.handle,
      p_fp: data.fp,
      p_won: data.won,
      p_ranked: data.ranked,
      p_tournament_id: (data.tournamentId ?? null) as unknown as string,
      p_tp: data.tp,
    });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];

    if (data.matchId && (data.fid || data.opponentFid)) {
      const { notifyResult } = await import("./notify.server");
      const me = data.handle.replace(/^@+/, "") || "a fighter";
      const them = (data.opponentHandle ?? "opponent").replace(/^@+/, "");
      await notifyResult({
        matchId: data.matchId,
        winnerFid: (data.won ? data.fid : data.opponentFid) ?? null,
        loserFid: (data.won ? data.opponentFid : data.fid) ?? null,
        winnerHandle: data.won ? me : them,
        loserHandle: data.won ? them : me,
        payout: data.payout ?? null,
      }).catch((e) => console.error("Result notification failed", e));
    }

    return { fp: Number(row?.fp ?? 0), tp: Number(row?.tp ?? 0) };
  });

/** Stored record for a wallet — the source of truth for FP, wins and losses. */
export const fetchPlayerProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("get_player", {
      p_wallet: data.wallet.toLowerCase(),
    });
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0];
    return {
      handle: row?.handle ?? "",
      fp: Number(row?.fp ?? 0),
      tp: Number(row?.tp ?? 0),
      wins: Number(row?.wins ?? 0),
      losses: Number(row?.losses ?? 0),
    };
  });
