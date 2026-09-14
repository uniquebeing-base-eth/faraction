CREATE OR REPLACE FUNCTION public.sync_player_stats(
  p_wallet TEXT, p_handle TEXT, p_fid INTEGER, p_fp INTEGER, p_wins INTEGER, p_losses INTEGER
) RETURNS TABLE(fp BIGINT, tp BIGINT, wins INTEGER, losses INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet TEXT := lower(p_wallet);
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;

  INSERT INTO public.players (wallet, handle, fid, fp, wins, losses)
  VALUES (v_wallet, nullif(left(coalesce(p_handle,''),64),''), p_fid,
          GREATEST(COALESCE(p_fp,0),0), GREATEST(COALESCE(p_wins,0),0), GREATEST(COALESCE(p_losses,0),0))
  ON CONFLICT (wallet) DO UPDATE
    SET handle = coalesce(nullif(left(coalesce(p_handle,''),64),''), public.players.handle),
        fid = coalesce(p_fid, public.players.fid),
        fp = GREATEST(public.players.fp, GREATEST(COALESCE(p_fp,0),0)),
        wins = GREATEST(public.players.wins, GREATEST(COALESCE(p_wins,0),0)),
        losses = GREATEST(public.players.losses, GREATEST(COALESCE(p_losses,0),0)),
        updated_at = now();

  RETURN QUERY SELECT p.fp, p.tp, p.wins, p.losses FROM public.players p WHERE p.wallet = v_wallet;
END; $$;

CREATE OR REPLACE FUNCTION public.list_card_unlocks(p_wallet TEXT)
RETURNS TABLE(card_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT pay.sku AS card_id
    FROM public.payments pay
   WHERE pay.kind = 'card'
     AND pay.status = 'confirmed'
     AND (pay.beneficiary = lower(p_wallet) OR pay.payer = lower(p_wallet))
   LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.sync_player_stats(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_card_unlocks(TEXT) TO anon, authenticated, service_role;