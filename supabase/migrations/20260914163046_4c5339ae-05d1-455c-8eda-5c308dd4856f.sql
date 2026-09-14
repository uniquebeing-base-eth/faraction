ALTER TABLE public.players ADD COLUMN IF NOT EXISTS tp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS notif_bonus_at TIMESTAMPTZ;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pfp_url TEXT;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS tournament_id UUID;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS winner_wallet TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS settle_tx TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_config (key, value)
VALUES ('admin_key', '3c935fe4aa29075c093ffb916405af678f734611993f8ab859e7170db7474e82')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_fids (
  fid INTEGER PRIMARY KEY,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_fids TO service_role;
ALTER TABLE public.admin_fids ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_fids (fid, label) VALUES (849116, 'owner') ON CONFLICT (fid) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assert_admin(p_admin_key TEXT, p_fid INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key TEXT;
BEGIN
  SELECT value INTO v_key FROM public.app_config WHERE key = 'admin_key';
  IF v_key IS NULL OR p_admin_key IS DISTINCT FROM v_key THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_fids WHERE fid = p_fid) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin_fid(p_fid INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_fids WHERE fid = p_fid);
$$;

CREATE TABLE IF NOT EXISTS public.fighter_energy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  fighter_id TEXT NOT NULL,
  bonus_energy INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet, fighter_id)
);
GRANT SELECT ON public.fighter_energy TO anon, authenticated;
GRANT ALL ON public.fighter_energy TO service_role;
ALTER TABLE public.fighter_energy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fighter energy is public" ON public.fighter_energy FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER fighter_energy_touch BEFORE UPDATE ON public.fighter_energy
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.energy_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  item_id TEXT NOT NULL,
  fighter_id TEXT NOT NULL,
  energy INTEGER NOT NULL,
  amount_facts NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.energy_purchases TO anon, authenticated;
GRANT ALL ON public.energy_purchases TO service_role;
ALTER TABLE public.energy_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Energy purchases are public" ON public.energy_purchases FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_energy_purchase(
  p_wallet TEXT, p_item_id TEXT, p_fighter_id TEXT, p_energy INTEGER,
  p_amount NUMERIC, p_tx_hash TEXT
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet TEXT := lower(p_wallet); v_bonus INTEGER;
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_energy IS NULL OR p_energy < 1 OR p_energy > 5 THEN RAISE EXCEPTION 'Invalid energy amount'; END IF;

  IF EXISTS (SELECT 1 FROM public.energy_purchases WHERE tx_hash = p_tx_hash) THEN
    SELECT bonus_energy INTO v_bonus FROM public.fighter_energy
      WHERE wallet = v_wallet AND fighter_id = left(p_fighter_id, 32);
    RETURN COALESCE(v_bonus, 0);
  END IF;

  INSERT INTO public.players (wallet) VALUES (v_wallet) ON CONFLICT (wallet) DO NOTHING;

  INSERT INTO public.energy_purchases (wallet, item_id, fighter_id, energy, amount_facts, tx_hash)
  VALUES (v_wallet, left(p_item_id, 64), left(p_fighter_id, 32), p_energy, GREATEST(COALESCE(p_amount, 0), 0), p_tx_hash);

  INSERT INTO public.fighter_energy (wallet, fighter_id, bonus_energy)
  VALUES (v_wallet, left(p_fighter_id, 32), p_energy)
  ON CONFLICT (wallet, fighter_id) DO UPDATE
    SET bonus_energy = public.fighter_energy.bonus_energy + p_energy, updated_at = now()
  RETURNING bonus_energy INTO v_bonus;

  RETURN v_bonus;
END; $$;

CREATE OR REPLACE FUNCTION public.list_fighter_energy(p_wallet TEXT)
RETURNS TABLE(fighter_id TEXT, bonus_energy INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.fighter_id, f.bonus_energy FROM public.fighter_energy f
   WHERE f.wallet = lower(p_wallet) LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.award_notification_bonus(p_wallet TEXT, p_handle TEXT, p_fid INTEGER)
RETURNS TABLE(fp BIGINT, awarded BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet TEXT := lower(p_wallet); v_existing TIMESTAMPTZ; v_fp BIGINT;
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;

  INSERT INTO public.players (wallet, handle, fid)
  VALUES (v_wallet, nullif(left(coalesce(p_handle,''),64),''), p_fid)
  ON CONFLICT (wallet) DO UPDATE
    SET handle = coalesce(nullif(left(coalesce(p_handle,''),64),''), public.players.handle),
        fid = coalesce(p_fid, public.players.fid);

  SELECT notif_bonus_at INTO v_existing FROM public.players WHERE wallet = v_wallet;
  IF v_existing IS NOT NULL THEN
    SELECT public.players.fp INTO v_fp FROM public.players WHERE wallet = v_wallet;
    RETURN QUERY SELECT v_fp, false;
    RETURN;
  END IF;

  UPDATE public.players
     SET fp = public.players.fp + 1000, notif_bonus_at = now(), updated_at = now()
   WHERE wallet = v_wallet
  RETURNING public.players.fp INTO v_fp;

  RETURN QUERY SELECT v_fp, true;
END; $$;

CREATE TABLE IF NOT EXISTS public.notification_log (
  event_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_notification_slot(p_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_log (event_key) VALUES (left(p_key, 200));
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END; $$;

CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  banner_url TEXT,
  registration_opens_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registration_closes_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
  ends_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '2 hours',
  winner_count INTEGER NOT NULL DEFAULT 3,
  tp_per_win INTEGER NOT NULL DEFAULT 100,
  tp_per_loss INTEGER NOT NULL DEFAULT 10,
  prize_pool NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_fid INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments are public" ON public.tournaments FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER tournaments_touch BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  handle TEXT,
  fid INTEGER,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, wallet)
);
GRANT SELECT ON public.tournament_participants TO anon, authenticated;
GRANT ALL ON public.tournament_participants TO service_role;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants are public" ON public.tournament_participants FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER tournament_participants_touch BEFORE UPDATE ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.tournament_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  handle TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'match',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_points TO anon, authenticated;
GRANT ALL ON public.tournament_points TO service_role;
ALTER TABLE public.tournament_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournament points are public" ON public.tournament_points FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  handle TEXT,
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  prize NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, wallet)
);
GRANT SELECT ON public.tournament_results TO anon, authenticated;
GRANT ALL ON public.tournament_results TO service_role;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournament results are public" ON public.tournament_results FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_battle_result(
  p_wallet TEXT, p_handle TEXT, p_fp INTEGER, p_won BOOLEAN,
  p_ranked BOOLEAN, p_tournament_id UUID, p_tp INTEGER
) RETURNS TABLE(fp BIGINT, tp BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet TEXT := lower(p_wallet); v_tp INTEGER := GREATEST(COALESCE(p_tp,0),0);
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;

  IF p_tournament_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tournament_participants tp
     WHERE tp.tournament_id = p_tournament_id AND tp.wallet = v_wallet
  ) THEN
    v_tp := 0;
  END IF;

  INSERT INTO public.players (wallet, handle, fp, tp, wins, losses)
  VALUES (v_wallet, nullif(left(coalesce(p_handle,''),64),''), GREATEST(COALESCE(p_fp,0),0), v_tp,
          CASE WHEN p_won THEN 1 ELSE 0 END, CASE WHEN p_won THEN 0 ELSE 1 END)
  ON CONFLICT (wallet) DO UPDATE
    SET fp = public.players.fp + GREATEST(COALESCE(p_fp,0),0),
        tp = public.players.tp + v_tp,
        handle = coalesce(nullif(left(coalesce(p_handle,''),64),''), public.players.handle),
        wins = public.players.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
        losses = public.players.losses + CASE WHEN p_won THEN 0 ELSE 1 END,
        updated_at = now();

  IF p_tournament_id IS NOT NULL AND v_tp > 0 THEN
    INSERT INTO public.tournament_points (tournament_id, wallet, handle, points, reason)
    VALUES (p_tournament_id, v_wallet, nullif(left(coalesce(p_handle,''),64),''), v_tp,
            CASE WHEN p_won THEN 'match_win' ELSE 'match_loss' END);

    UPDATE public.tournament_participants
       SET points = points + v_tp,
           wins = wins + CASE WHEN p_won THEN 1 ELSE 0 END,
           losses = losses + CASE WHEN p_won THEN 0 ELSE 1 END,
           updated_at = now()
     WHERE tournament_id = p_tournament_id AND wallet = v_wallet;
  END IF;

  RETURN QUERY SELECT p.fp, p.tp FROM public.players p WHERE p.wallet = v_wallet;
END; $$;

CREATE OR REPLACE FUNCTION public.leaderboard_global(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(wallet TEXT, handle TEXT, pfp_url TEXT, fp BIGINT, wins INTEGER, losses INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.wallet, p.handle, p.pfp_url, p.fp, p.wins, p.losses
    FROM public.players p
   WHERE p.fp > 0
   ORDER BY p.fp DESC, p.wins DESC
   LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

CREATE OR REPLACE FUNCTION public.settle_match_result(
  p_match_id TEXT, p_winner_wallet TEXT, p_settle_tx TEXT
) RETURNS matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.matches;
BEGIN
  UPDATE public.matches
     SET winner_wallet = lower(nullif(p_winner_wallet, '')),
         settle_tx = nullif(p_settle_tx, ''),
         settled_at = now(),
         status = 'complete'
   WHERE match_id = upper(p_match_id)
     AND settled_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.matches WHERE match_id = upper(p_match_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  END IF;

  UPDATE public.staked_matches
     SET winner = lower(nullif(p_winner_wallet,'')), status = 'settled', settle_tx = nullif(p_settle_tx,'')
   WHERE match_key = upper(p_match_id) OR match_id = upper(p_match_id);

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.tournament_register(
  p_tournament_id UUID, p_wallet TEXT, p_handle TEXT, p_fid INTEGER
) RETURNS tournament_participants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.tournament_participants; v_t public.tournaments; v_wallet TEXT := lower(p_wallet);
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Connect a Base wallet to register'; END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF v_t.status NOT IN ('registration','live') THEN RAISE EXCEPTION 'Registration is not open'; END IF;
  IF now() > v_t.registration_closes_at THEN RAISE EXCEPTION 'Registration has closed'; END IF;

  INSERT INTO public.players (wallet, handle, fid)
  VALUES (v_wallet, nullif(left(coalesce(p_handle,''),64),''), p_fid)
  ON CONFLICT (wallet) DO UPDATE
    SET handle = coalesce(nullif(left(coalesce(p_handle,''),64),''), public.players.handle),
        fid = coalesce(p_fid, public.players.fid);

  INSERT INTO public.tournament_participants (tournament_id, wallet, handle, fid)
  VALUES (p_tournament_id, v_wallet, nullif(left(coalesce(p_handle,''),64),''), p_fid)
  ON CONFLICT (tournament_id, wallet) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.list_tournaments(p_limit INTEGER DEFAULT 20)
RETURNS SETOF tournaments LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.tournaments
   WHERE status <> 'draft'
   ORDER BY starts_at DESC
   LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

CREATE OR REPLACE FUNCTION public.tournament_standings(p_tournament_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(wallet TEXT, handle TEXT, points INTEGER, wins INTEGER, losses INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tp.wallet, tp.handle, tp.points, tp.wins, tp.losses
    FROM public.tournament_participants tp
   WHERE tp.tournament_id = p_tournament_id
   ORDER BY tp.points DESC, tp.wins DESC
   LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_tournament(
  p_admin_key TEXT, p_fid INTEGER, p_id UUID, p_title TEXT, p_description TEXT,
  p_banner_url TEXT, p_reg_opens TIMESTAMPTZ, p_reg_closes TIMESTAMPTZ,
  p_starts TIMESTAMPTZ, p_ends TIMESTAMPTZ, p_winner_count INTEGER,
  p_tp_win INTEGER, p_tp_loss INTEGER, p_prize NUMERIC, p_status TEXT
) RETURNS tournaments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.tournaments;
BEGIN
  PERFORM public.assert_admin(p_admin_key, p_fid);
  IF p_status NOT IN ('draft','registration','live','completed','cancelled') THEN
    RAISE EXCEPTION 'Unknown tournament status';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.tournaments (
      title, description, banner_url, registration_opens_at, registration_closes_at,
      starts_at, ends_at, winner_count, tp_per_win, tp_per_loss, prize_pool, status, created_by_fid
    ) VALUES (
      left(p_title, 120), coalesce(left(p_description, 2000), ''), nullif(p_banner_url, ''),
      p_reg_opens, p_reg_closes, p_starts, p_ends,
      GREATEST(COALESCE(p_winner_count,3),1), GREATEST(COALESCE(p_tp_win,100),0),
      GREATEST(COALESCE(p_tp_loss,10),0), GREATEST(COALESCE(p_prize,0),0), p_status, p_fid
    ) RETURNING * INTO v_row;
  ELSE
    UPDATE public.tournaments SET
      title = left(p_title, 120),
      description = coalesce(left(p_description, 2000), ''),
      banner_url = nullif(p_banner_url, ''),
      registration_opens_at = p_reg_opens,
      registration_closes_at = p_reg_closes,
      starts_at = p_starts,
      ends_at = p_ends,
      winner_count = GREATEST(COALESCE(p_winner_count,3),1),
      tp_per_win = GREATEST(COALESCE(p_tp_win,100),0),
      tp_per_loss = GREATEST(COALESCE(p_tp_loss,10),0),
      prize_pool = GREATEST(COALESCE(p_prize,0),0),
      status = p_status
    WHERE id = p_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_tournament_status(
  p_admin_key TEXT, p_fid INTEGER, p_id UUID, p_status TEXT
) RETURNS tournaments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.tournaments;
BEGIN
  PERFORM public.assert_admin(p_admin_key, p_fid);
  IF p_status NOT IN ('draft','registration','live','completed','cancelled') THEN
    RAISE EXCEPTION 'Unknown tournament status';
  END IF;
  UPDATE public.tournaments SET status = p_status WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;

  IF p_status = 'completed' THEN
    DELETE FROM public.tournament_results WHERE tournament_id = p_id;
    INSERT INTO public.tournament_results (tournament_id, wallet, handle, rank, points, prize)
    SELECT p_id, s.wallet, s.handle, s.rn,
           s.points,
           CASE WHEN v_row.winner_count > 0 AND s.rn <= v_row.winner_count
                THEN round(v_row.prize_pool / v_row.winner_count, 6) ELSE 0 END
      FROM (
        SELECT tp.wallet, tp.handle, tp.points,
               row_number() OVER (ORDER BY tp.points DESC, tp.wins DESC) AS rn
          FROM public.tournament_participants tp
         WHERE tp.tournament_id = p_id
      ) s
     WHERE s.rn <= GREATEST(v_row.winner_count, 25);
  END IF;

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_tournament_points(
  p_admin_key TEXT, p_fid INTEGER, p_tournament_id UUID, p_wallet TEXT, p_points INTEGER, p_reason TEXT
) RETURNS tournament_participants LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.tournament_participants; v_wallet TEXT := lower(p_wallet);
BEGIN
  PERFORM public.assert_admin(p_admin_key, p_fid);
  UPDATE public.tournament_participants
     SET points = GREATEST(points + COALESCE(p_points, 0), 0), updated_at = now()
   WHERE tournament_id = p_tournament_id AND wallet = v_wallet
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;

  INSERT INTO public.tournament_points (tournament_id, wallet, handle, points, reason)
  VALUES (p_tournament_id, v_wallet, v_row.handle, COALESCE(p_points,0), left(coalesce(p_reason,'admin'), 64));

  UPDATE public.players
     SET tp = GREATEST(tp + COALESCE(p_points,0), 0), updated_at = now()
   WHERE wallet = v_wallet;

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_tournaments(p_admin_key TEXT, p_fid INTEGER)
RETURNS SETOF tournaments LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin(p_admin_key, p_fid);
  RETURN QUERY SELECT * FROM public.tournaments ORDER BY created_at DESC LIMIT 100;
END; $$;

CREATE OR REPLACE FUNCTION public.record_daily_claim(p_wallet text, p_amount numeric, p_tx_hash text, p_campaign_ids text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet text := lower(p_wallet);
  v_last timestamptz;
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 1e9 THEN RAISE EXCEPTION 'Invalid daily claim amount'; END IF;

  SELECT max(created_at) INTO v_last FROM public.daily_claims WHERE wallet = v_wallet;
  IF v_last IS NOT NULL AND v_last > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'You have already claimed in the last 24 hours.';
  END IF;

  INSERT INTO public.players (wallet) VALUES (v_wallet) ON CONFLICT (wallet) DO NOTHING;

  INSERT INTO public.daily_claims (wallet, claim_day, amount, tx_hash, campaign_ids)
  VALUES (v_wallet, (now() AT TIME ZONE 'utc')::date, p_amount, p_tx_hash, left(coalesce(p_campaign_ids, ''), 256));

  INSERT INTO public.reward_claims (source, asset, wallet, amount, tx_hash, status)
  VALUES ('FactsRewardDistributor', 'FACTS', v_wallet, p_amount, p_tx_hash, 'confirmed');
END; $$;

CREATE OR REPLACE FUNCTION public.get_player(p_wallet TEXT)
RETURNS TABLE(wallet TEXT, handle TEXT, fp BIGINT, tp BIGINT, wins INTEGER, losses INTEGER, notif_bonus BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.wallet, p.handle, p.fp, p.tp, p.wins, p.losses, (p.notif_bonus_at IS NOT NULL)
    FROM public.players p WHERE p.wallet = lower(p_wallet);
$$;