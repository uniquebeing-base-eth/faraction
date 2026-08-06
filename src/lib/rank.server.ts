/**
 * Ranked results. Facts Points (FP) earned in Ranked matches are the only
 * score the Season leaderboard reads, and the leaderboard itself only lists
 * wallets holding an active Season Pass.
 */
import { getSupabasePublic } from "./supabase-public.server";

export async function saveRankedResult(input: {
  wallet: string;
  handle: string;
  fp: number;
  won: boolean;
}) {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase.rpc("record_ranked_result", {
    p_wallet: input.wallet.toLowerCase(),
    p_handle: input.handle,
    p_fp: input.fp,
    p_won: input.won,
  });
  if (error) throw new Error(error.message);
  return { fp: Number(data ?? 0) };
}
