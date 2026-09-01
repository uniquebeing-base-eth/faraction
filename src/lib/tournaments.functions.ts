/**
 * Tournaments and leaderboards.
 *
 * Reads are public; registration and standings run through security-definer
 * routines so a client can never write points directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Global (all-time) FP standings across every player. */
export const globalLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("leaderboard_global", {
      p_limit: data.limit ?? 50,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      wallet: String(r.wallet),
      handle: r.handle ?? "",
      pfpUrl: r.pfp_url ?? null,
      fp: Number(r.fp ?? 0),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
    }));
  });

/** Tournaments, newest first. */
export const listTournaments = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("list_tournaments", {
      p_limit: data.limit ?? 20,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Standings inside one tournament. */
export const tournamentStandings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ tournamentId: z.string().uuid(), limit: z.number().int().min(1).max(100).optional() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: rows, error } = await getSupabasePublic().rpc("tournament_standings", {
      p_tournament_id: data.tournamentId,
      p_limit: data.limit ?? 50,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      wallet: String(r.wallet),
      handle: r.handle ?? "",
      points: Number(r.points ?? 0),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
    }));
  });

/** Join a tournament while registration is open. */
export const registerForTournament = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tournamentId: z.string().uuid(),
        wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        handle: z.string().max(64).default(""),
        fid: z.number().int().positive().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { getSupabasePublic } = await import("./supabase-public.server");
    const { data: row, error } = await getSupabasePublic().rpc("tournament_register", {
      p_tournament_id: data.tournamentId,
      p_wallet: data.wallet.toLowerCase(),
      p_handle: data.handle,
      p_fid: (data.fid ?? null) as unknown as number,
    });
    if (error) throw new Error(error.message);
    return row;
  });
