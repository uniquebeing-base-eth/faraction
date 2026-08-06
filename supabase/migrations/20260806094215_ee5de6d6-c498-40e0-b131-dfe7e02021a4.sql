ALTER TABLE public.players ADD COLUMN IF NOT EXISTS fp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pass_expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.activate_season_pass(p_wallet TEXT, p_days INTEGER)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_expires TIMESTAMPTZ;
BEGIN
  INSERT INTO public.players (wallet, pass_expires_at)
  VALUES (lower(p_wallet), now() + make_interval(days => GREATEST(p_days, 1)))
  ON CONFLICT (wallet) DO UPDATE
    SET pass_expires_at = GREATEST(COALESCE(public.players.pass_expires_at, now()), now())
                          + make_interval(days => GREATEST(p_days, 1)),
        updated_at = now()
  RETURNING pass_expires_at INTO v_expires;
  RETURN v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ranked_result(
  p_wallet TEXT,
  p_handle TEXT,
  p_fp INTEGER,
  p_won BOOLEAN
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_fp BIGINT;
BEGIN
  INSERT INTO public.players (wallet, handle, fp, wins, losses)
  VALUES (lower(p_wallet), NULLIF(p_handle, ''), GREATEST(p_fp, 0),
          CASE WHEN p_won THEN 1 ELSE 0 END, CASE WHEN p_won THEN 0 ELSE 1 END)
  ON CONFLICT (wallet) DO UPDATE
    SET fp = public.players.fp + GREATEST(p_fp, 0),
        handle = COALESCE(NULLIF(p_handle, ''), public.players.handle),
        wins = public.players.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
        losses = public.players.losses + CASE WHEN p_won THEN 0 ELSE 1 END,
        updated_at = now()
  RETURNING fp INTO v_fp;
  RETURN v_fp;
END;
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_ranked(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (wallet TEXT, handle TEXT, fp BIGINT, wins INTEGER, losses INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.wallet, p.handle, p.fp, p.wins, p.losses
  FROM public.players p
  WHERE p.pass_expires_at IS NOT NULL
    AND p.pass_expires_at > now()
  ORDER BY p.fp DESC, p.wins DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_ranked(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_ranked_result(TEXT, TEXT, INTEGER, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_season_pass(TEXT, INTEGER) TO anon, authenticated, service_role;