CREATE OR REPLACE FUNCTION public.sync_player_stats(
  p_wallet text,
  p_handle text,
  p_fid integer,
  p_fp integer,
  p_wins integer,
  p_losses integer
)
RETURNS TABLE(fp bigint, tp bigint, wins integer, losses integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_wallet TEXT := lower(p_wallet);
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;

  INSERT INTO public.players (wallet, handle, fid, fp, wins, losses)
  VALUES (v_wallet, nullif(left(coalesce(p_handle,''),64),''), p_fid,
          GREATEST(COALESCE(p_fp,0),0), GREATEST(COALESCE(p_wins,0),0), GREATEST(COALESCE(p_losses,0),0))
  ON CONFLICT (wallet) DO UPDATE
    SET fp = public.players.fp + GREATEST(COALESCE(p_fp,0),0),
        wins = public.players.wins + GREATEST(COALESCE(p_wins,0),0),
        losses = public.players.losses + GREATEST(COALESCE(p_losses,0),0),
        handle = coalesce(nullif(left(coalesce(p_handle,''),64),''), public.players.handle),
        fid = coalesce(p_fid, public.players.fid),
        updated_at = now();

  RETURN QUERY SELECT pl.fp, pl.tp, pl.wins, pl.losses FROM public.players pl WHERE pl.wallet = v_wallet;
END;
$function$;