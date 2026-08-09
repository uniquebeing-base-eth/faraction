/**
 * Match persistence.
 *
 * Every match — Ranked, House Boss and 1 vs 1 — is written to the database as
 * soon as it is created, so an invite code resolves for anyone, Ranked bouts
 * can be listed as "open", and a player who closes the app finds the bout
 * still waiting when they come back.
 *
 * Writes go through `SECURITY DEFINER` routines, so the publishable key is
 * enough and no service-role key is ever needed.
 */
import { getSupabasePublic } from "./supabase-public.server";
import type { Tables } from "@/integrations/supabase/types";

export type MatchRow = Tables<"matches">;

export async function dbCreateMatch(input: {
  matchId: string;
  mode: string;
  staked: boolean;
  token: string;
  stake: number;
  difficulty: number;
  hostHandle: string;
  hostFid?: number | null | undefined;
  hostWallet?: string | null | undefined;
  hostFighterId: string;
  invitedUsername?: string | null | undefined;
  invitedFid?: number | null | undefined;
}): Promise<MatchRow> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("create_match", {
    p_match_id: input.matchId,
    p_mode: input.mode,
    p_staked: input.staked,
    p_token: input.token,
    p_stake: input.stake,
    p_difficulty: input.difficulty,
    p_host_handle: input.hostHandle,
    p_host_fid: input.hostFid ?? null,
    p_host_wallet: input.hostWallet ?? null,
    p_host_fighter_id: input.hostFighterId,
    p_invited_username: input.invitedUsername ?? null,
    p_invited_fid: input.invitedFid ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

export async function dbJoinMatch(input: {
  matchId: string;
  handle: string;
  fid?: number | null | undefined;
  wallet?: string | null | undefined;
  fighterId: string;
}): Promise<MatchRow> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("join_match", {
    p_match_id: input.matchId,
    p_handle: input.handle,
    p_fid: input.fid ?? null,
    p_wallet: input.wallet ?? null,
    p_fighter_id: input.fighterId,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

export async function dbGetMatch(matchId: string): Promise<MatchRow | null> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("get_match", { p_match_id: matchId });
  if (error) throw new Error(error.message);
  const row = data as unknown as MatchRow | null;
  return row?.match_id ? row : null;
}

export async function dbListOpenRanked(limit = 30): Promise<MatchRow[]> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("list_open_ranked_matches", { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MatchRow[];
}

export async function dbListMyMatches(handle: string): Promise<MatchRow[]> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("list_my_matches", { p_handle: handle });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MatchRow[];
}

export async function dbSetMatchPaid(matchId: string, role: "host" | "joiner"): Promise<MatchRow> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("set_match_paid", {
    p_match_id: matchId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

export async function dbSetMatchLoadout(input: {
  matchId: string;
  role: "host" | "joiner";
  fighterId: string;
  deck: string[];
  ready: boolean;
}): Promise<MatchRow> {
  const supabase = getSupabasePublic() as any;
  const { data, error } = await supabase.rpc("set_match_loadout", {
    p_match_id: input.matchId,
    p_role: input.role,
    p_fighter_id: input.fighterId,
    p_deck: input.deck,
    p_ready: input.ready,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

export async function dbSetMatchStatus(matchId: string, status: string): Promise<MatchRow> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("set_match_status", {
    p_match_id: matchId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

/**
 * Turn-by-turn 1 vs 1 sync. Each player reveals only their own card; the slot
 * resolves once both counters reach it, so the bout is genuinely shared.
 */
export async function dbRevealSlot(input: {
  matchId: string;
  role: "host" | "joiner";
  slot: number;
}): Promise<MatchRow> {
  const supabase = getSupabasePublic() as any;
  const { data, error } = await supabase.rpc("reveal_match_slot", {
    p_match_id: input.matchId,
    p_role: input.role,
    p_slot: input.slot,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

/** Close the current round and reset both reveal counters. */
export async function dbAdvanceRound(input: {
  matchId: string;
  hostWins: number;
  joinerWins: number;
}): Promise<MatchRow> {
  const supabase = getSupabasePublic() as any;
  const { data, error } = await supabase.rpc("advance_match_round", {
    p_match_id: input.matchId,
    p_host_wins: input.hostWins,
    p_joiner_wins: input.joinerWins,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

/** Pick the battle environment both players will see. */
export async function dbSetMatchArena(matchId: string, arena: string): Promise<MatchRow> {
  const supabase = getSupabasePublic() as any;
  const { data, error } = await supabase.rpc("set_match_arena", {
    p_match_id: matchId,
    p_arena: arena,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MatchRow;
}

