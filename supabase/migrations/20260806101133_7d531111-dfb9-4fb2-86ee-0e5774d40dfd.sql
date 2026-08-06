CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL UNIQUE,
  handle text,
  fid integer,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  facts_earned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onchain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract text NOT NULL,
  address text NOT NULL,
  event_name text NOT NULL,
  tx_hash text NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  block_number bigint,
  wallet text,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tx_hash, log_index)
);
CREATE INDEX onchain_events_wallet_idx ON public.onchain_events (wallet);
CREATE INDEX onchain_events_created_idx ON public.onchain_events (created_at DESC);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  sku text NOT NULL,
  payment_ref text NOT NULL,
  payer text NOT NULL,
  beneficiary text NOT NULL,
  token text NOT NULL DEFAULT 'FACTS',
  amount numeric NOT NULL,
  usd_value numeric,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, payment_ref)
);
CREATE INDEX payments_payer_idx ON public.payments (payer);

CREATE TABLE public.staked_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL UNIQUE,
  match_key text NOT NULL,
  creator text NOT NULL,
  opponent text,
  winner text,
  asset text NOT NULL DEFAULT 'USDC',
  stake numeric NOT NULL,
  status text NOT NULL DEFAULT 'open',
  create_tx text,
  join_tx text,
  settle_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staked_matches_status_idx ON public.staked_matches (status);

CREATE TABLE public.reward_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id bigint NOT NULL,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  rank integer,
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, wallet)
);

CREATE TABLE public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  campaign_id bigint,
  asset text NOT NULL DEFAULT 'FACTS',
  wallet text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_claims_wallet_idx ON public.reward_claims (wallet);

CREATE TABLE public.notification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fid integer NOT NULL,
  token text NOT NULL,
  url text NOT NULL,
  username text,
  wallet text,
  enabled boolean NOT NULL DEFAULT true,
  last_event text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notification_tokens_fid_token_key ON public.notification_tokens (fid, token);
CREATE INDEX notification_tokens_fid_idx ON public.notification_tokens (fid);

CREATE TABLE public.daily_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  claim_day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  amount numeric NOT NULL DEFAULT 0,
  tx_hash text,
  campaign_ids text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet, claim_day)
);
CREATE INDEX daily_claims_wallet_idx ON public.daily_claims (wallet);

CREATE TABLE public.pending_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  source text NOT NULL,
  label text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_rewards_wallet_idx ON public.pending_rewards (wallet, status);

GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.onchain_events TO anon, authenticated;
GRANT SELECT ON public.payments TO anon, authenticated;
GRANT SELECT ON public.staked_matches TO anon, authenticated;
GRANT SELECT ON public.reward_allocations TO anon, authenticated;
GRANT SELECT ON public.reward_claims TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.onchain_events TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.staked_matches TO service_role;
GRANT ALL ON public.reward_allocations TO service_role;
GRANT ALL ON public.reward_claims TO service_role;
GRANT ALL ON public.notification_tokens TO service_role;
GRANT ALL ON public.daily_claims TO service_role;
GRANT ALL ON public.pending_rewards TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onchain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staked_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are public" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Events are public" ON public.onchain_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Payments are public" ON public.payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Matches are public" ON public.staked_matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allocations are public" ON public.reward_allocations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Claims are public" ON public.reward_claims FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER players_touch BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER staked_matches_touch BEFORE UPDATE ON public.staked_matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER notification_tokens_touch BEFORE UPDATE ON public.notification_tokens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER pending_rewards_touch BEFORE UPDATE ON public.pending_rewards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_wallet_profile(p_wallet text, p_handle text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_wallet IS NULL OR p_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN
    RAISE EXCEPTION 'Invalid wallet address';
  END IF;
  INSERT INTO public.players (wallet, handle)
  VALUES (lower(p_wallet), nullif(left(coalesce(p_handle, ''), 64), ''))
  ON CONFLICT (wallet) DO UPDATE
    SET handle = coalesce(nullif(left(coalesce(p_handle, ''), 64), ''), public.players.handle);
END; $$;

CREATE OR REPLACE FUNCTION public.record_chain_event(
  p_contract text, p_address text, p_event_name text, p_tx_hash text,
  p_block bigint, p_wallet text, p_args jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_contract NOT IN ('FactsPaymentGateway','StakedMatchVault','FactsRewardDistributor') THEN
    RAISE EXCEPTION 'Unknown contract';
  END IF;
  INSERT INTO public.onchain_events (contract, address, event_name, tx_hash, log_index, block_number, wallet, args)
  VALUES (p_contract, lower(p_address), left(p_event_name, 64), p_tx_hash, 0, p_block, lower(p_wallet), coalesce(p_args, '{}'::jsonb))
  ON CONFLICT (tx_hash, log_index) DO UPDATE
    SET args = excluded.args, block_number = excluded.block_number;
END; $$;

CREATE OR REPLACE FUNCTION public.record_payment_receipt(
  p_kind text, p_sku text, p_payment_ref text, p_payer text, p_beneficiary text,
  p_token text, p_amount numeric, p_usd_value numeric, p_tx_hash text
) RETURNS TABLE (id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tx_hash IS NULL OR p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_payer !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid payer address'; END IF;
  IF p_token NOT IN ('USDC','FACTS') THEN RAISE EXCEPTION 'Unsupported token'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 1e12 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  RETURN QUERY
  INSERT INTO public.payments (kind, sku, payment_ref, payer, beneficiary, token, amount, usd_value, tx_hash, status)
  VALUES (left(p_kind, 32), left(p_sku, 64), left(p_payment_ref, 128), lower(p_payer), lower(coalesce(p_beneficiary, p_payer)),
          p_token, p_amount, p_usd_value, p_tx_hash, 'confirmed')
  ON CONFLICT (kind, payment_ref) DO UPDATE
    SET tx_hash = excluded.tx_hash, status = 'confirmed', amount = excluded.amount, usd_value = excluded.usd_value
  RETURNING public.payments.id, public.payments.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_staked_match(
  p_match_id text, p_match_key text, p_creator text, p_asset text, p_stake numeric, p_tx_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_stake IS NULL OR p_stake < 0 THEN RAISE EXCEPTION 'Invalid stake'; END IF;
  INSERT INTO public.staked_matches (match_id, match_key, creator, asset, stake, status, create_tx)
  VALUES (left(p_match_id, 128), left(coalesce(p_match_key, p_match_id), 128), lower(p_creator),
          coalesce(p_asset, 'USDC'), p_stake, 'open', p_tx_hash)
  ON CONFLICT (match_id) DO UPDATE
    SET create_tx = excluded.create_tx, stake = excluded.stake, asset = excluded.asset;
END; $$;

CREATE OR REPLACE FUNCTION public.join_staked_match(p_match_id text, p_wallet text, p_tx_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  UPDATE public.staked_matches
     SET opponent = lower(p_wallet), status = 'locked', join_tx = p_tx_hash
   WHERE match_id = p_match_id AND status = 'open';
END; $$;

CREATE OR REPLACE FUNCTION public.record_reward_claim(
  p_source text, p_asset text, p_wallet text, p_amount numeric, p_tx_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_source NOT IN ('StakedMatchVault','FactsRewardDistributor') THEN RAISE EXCEPTION 'Unknown reward source'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 1e12 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF EXISTS (SELECT 1 FROM public.reward_claims WHERE tx_hash = p_tx_hash) THEN RETURN; END IF;
  INSERT INTO public.reward_claims (source, asset, wallet, amount, tx_hash, status)
  VALUES (p_source, coalesce(p_asset, 'FACTS'), lower(p_wallet), p_amount, p_tx_hash, 'confirmed');
END; $$;

CREATE OR REPLACE FUNCTION public.list_daily_claims(p_wallet text)
RETURNS TABLE (claim_day date, amount numeric, tx_hash text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.claim_day, d.amount, d.tx_hash, d.created_at
    FROM public.daily_claims d
   WHERE d.wallet = lower(p_wallet)
   ORDER BY d.claim_day DESC
   LIMIT 60;
$$;

CREATE OR REPLACE FUNCTION public.record_daily_claim(
  p_wallet text, p_amount numeric, p_tx_hash text, p_campaign_ids text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet text := lower(p_wallet);
  v_last timestamptz;
BEGIN
  IF v_wallet !~ '^0x[0-9a-fA-F]{40}$' THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;
  IF p_tx_hash !~ '^0x[0-9a-fA-F]{64}$' THEN RAISE EXCEPTION 'Invalid transaction hash'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 500 THEN RAISE EXCEPTION 'Invalid daily claim amount'; END IF;

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

CREATE OR REPLACE FUNCTION public.save_notification_token(
  p_fid integer, p_token text, p_url text, p_event text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_fid IS NULL OR p_fid <= 0 THEN RAISE EXCEPTION 'Invalid fid'; END IF;
  IF coalesce(p_token, '') = '' OR p_url !~ '^https://' THEN RAISE EXCEPTION 'Invalid notification token'; END IF;
  INSERT INTO public.notification_tokens (fid, token, url, enabled, last_event)
  VALUES (p_fid, p_token, p_url, true, left(coalesce(p_event, ''), 64))
  ON CONFLICT (fid, token) DO UPDATE
    SET url = excluded.url, enabled = true, last_event = excluded.last_event, updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.disable_notification_tokens(p_fid integer, p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notification_tokens
     SET enabled = false, last_event = left(coalesce(p_event, ''), 64), updated_at = now()
   WHERE fid = p_fid;
END; $$;

CREATE OR REPLACE FUNCTION public.list_notification_fids()
RETURNS TABLE (fid integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT n.fid FROM public.notification_tokens n WHERE n.enabled LIMIT 5000;
$$;

REVOKE ALL ON FUNCTION public.upsert_wallet_profile(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_chain_event(text, text, text, text, bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_payment_receipt(text, text, text, text, text, text, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_staked_match(text, text, text, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_staked_match(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_reward_claim(text, text, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_daily_claims(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_daily_claim(text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_notification_token(integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disable_notification_tokens(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_notification_fids() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_wallet_profile(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_chain_event(text, text, text, text, bigint, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_payment_receipt(text, text, text, text, text, text, numeric, numeric, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_staked_match(text, text, text, text, numeric, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_staked_match(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_reward_claim(text, text, text, numeric, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_daily_claims(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_daily_claim(text, numeric, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_notification_token(integer, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.disable_notification_tokens(integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_notification_fids() TO anon, authenticated, service_role;

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