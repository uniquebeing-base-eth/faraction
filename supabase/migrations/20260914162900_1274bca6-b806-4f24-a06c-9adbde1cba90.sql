CREATE TABLE public.matches (
  id uuid primary key default gen_random_uuid(),
  match_id text not null unique,
  mode text not null default '1v1',
  staked boolean not null default false,
  token text not null default 'FACTS',
  stake numeric not null default 0,
  difficulty integer not null default 1,
  host_handle text not null,
  host_fid integer,
  host_wallet text,
  host_fighter_id text not null default 'kaira',
  joiner_handle text,
  joiner_fid integer,
  joiner_wallet text,
  joiner_fighter_id text,
  invited_username text,
  invited_fid integer,
  status text not null default 'open',
  host_paid boolean not null default false,
  joiner_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are public" ON public.matches FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX matches_open_ranked_idx ON public.matches (mode, status, created_at DESC);
CREATE INDEX matches_host_idx ON public.matches (host_handle, created_at DESC);
CREATE INDEX matches_joiner_idx ON public.matches (joiner_handle, created_at DESC);

CREATE TRIGGER matches_touch BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.create_match(
  p_match_id text, p_mode text, p_staked boolean, p_token text, p_stake numeric,
  p_difficulty integer, p_host_handle text, p_host_fid integer, p_host_wallet text,
  p_host_fighter_id text, p_invited_username text, p_invited_fid integer
) RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.matches;
BEGIN
  IF p_match_id !~ '^FAR[0-9]{5,10}$' THEN RAISE EXCEPTION 'Invalid match code'; END IF;
  IF p_mode NOT IN ('ranked','house','1v1') THEN RAISE EXCEPTION 'Unknown match mode'; END IF;
  IF p_token NOT IN ('USDC','FACTS') THEN RAISE EXCEPTION 'Unsupported token'; END IF;
  IF p_stake IS NULL OR p_stake < 0 OR p_stake > 1e12 THEN RAISE EXCEPTION 'Invalid stake'; END IF;

  INSERT INTO public.matches (
    match_id, mode, staked, token, stake, difficulty, host_handle, host_fid, host_wallet,
    host_fighter_id, invited_username, invited_fid, status
  ) VALUES (
    upper(p_match_id), p_mode, coalesce(p_staked,false), p_token, p_stake,
    least(greatest(coalesce(p_difficulty,1),0),2), left(p_host_handle,64), p_host_fid,
    lower(nullif(p_host_wallet,'')), left(coalesce(p_host_fighter_id,'kaira'),32),
    nullif(left(coalesce(p_invited_username,''),64),''), p_invited_fid,
    CASE WHEN p_mode = 'house' THEN 'locked' ELSE 'open' END
  )
  ON CONFLICT (match_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.join_match(
  p_match_id text, p_handle text, p_fid integer, p_wallet text, p_fighter_id text
) RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.matches;
BEGIN
  SELECT * INTO v_row FROM public.matches WHERE match_id = upper(p_match_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_row.status NOT IN ('open','locked') THEN RAISE EXCEPTION 'This match is no longer open'; END IF;
  IF v_row.joiner_handle IS NOT NULL AND lower(v_row.joiner_handle) <> lower(left(p_handle,64)) THEN
    RAISE EXCEPTION 'This match already has an opponent';
  END IF;

  UPDATE public.matches SET
    joiner_handle = left(p_handle,64),
    joiner_fid = p_fid,
    joiner_wallet = lower(nullif(p_wallet,'')),
    joiner_fighter_id = left(coalesce(p_fighter_id,'kaira'),32),
    status = 'locked'
  WHERE match_id = upper(p_match_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.get_match(p_match_id text)
RETURNS public.matches
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.matches WHERE match_id = upper(p_match_id);
$$;

CREATE OR REPLACE FUNCTION public.list_open_ranked_matches(p_limit integer DEFAULT 30)
RETURNS SETOF public.matches
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.matches
  WHERE mode = 'ranked' AND status = 'open' AND joiner_handle IS NULL
    AND created_at > now() - interval '24 hours'
  ORDER BY created_at DESC
  LIMIT greatest(coalesce(p_limit,30),1);
$$;

CREATE OR REPLACE FUNCTION public.list_my_matches(p_handle text)
RETURNS SETOF public.matches
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.matches
  WHERE (lower(host_handle) = lower(p_handle) OR lower(coalesce(joiner_handle,'')) = lower(p_handle))
    AND status IN ('open','locked','ready')
    AND created_at > now() - interval '48 hours'
  ORDER BY created_at DESC
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.set_match_status(p_match_id text, p_status text)
RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.matches;
BEGIN
  IF p_status NOT IN ('open','locked','ready','playing','complete','cancelled') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;
  UPDATE public.matches SET status = p_status WHERE match_id = upper(p_match_id) RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  RETURN v_row;
END; $$;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS host_deck jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS joiner_deck jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS host_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS joiner_ready boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_match_loadout(
  p_match_id text,
  p_role text,
  p_fighter_id text,
  p_deck jsonb,
  p_ready boolean
) RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.matches;
BEGIN
  IF p_role NOT IN ('host','joiner') THEN
    RAISE EXCEPTION 'Unknown role';
  END IF;

  UPDATE public.matches
  SET
    host_fighter_id = CASE WHEN p_role = 'host' THEN left(coalesce(p_fighter_id, 'kaira'), 32) ELSE host_fighter_id END,
    joiner_fighter_id = CASE WHEN p_role = 'joiner' THEN left(coalesce(p_fighter_id, 'kaira'), 32) ELSE joiner_fighter_id END,
    host_deck = CASE WHEN p_role = 'host' THEN coalesce(p_deck, '[]'::jsonb) ELSE host_deck END,
    joiner_deck = CASE WHEN p_role = 'joiner' THEN coalesce(p_deck, '[]'::jsonb) ELSE joiner_deck END,
    host_ready = CASE WHEN p_role = 'host' THEN coalesce(p_ready, false) ELSE host_ready END,
    joiner_ready = CASE WHEN p_role = 'joiner' THEN coalesce(p_ready, false) ELSE joiner_ready END,
    status = CASE
      WHEN p_role = 'host' AND coalesce(p_ready, false) AND coalesce(joiner_ready, false) AND host_paid AND (mode = 'house' OR joiner_paid) THEN 'ready'
      WHEN p_role = 'joiner' AND coalesce(p_ready, false) AND coalesce(host_ready, false) AND joiner_paid AND (mode = 'house' OR host_paid) THEN 'ready'
      ELSE status
    END
  WHERE match_id = upper(p_match_id)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_row.host_ready AND v_row.joiner_ready AND v_row.host_paid AND (v_row.mode = 'house' OR v_row.joiner_paid) THEN
    UPDATE public.matches
    SET status = 'ready'
    WHERE match_id = v_row.match_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.set_match_paid(p_match_id text, p_role text)
RETURNS public.matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.matches;
BEGIN
  IF p_role NOT IN ('host','joiner') THEN RAISE EXCEPTION 'Unknown role'; END IF;
  UPDATE public.matches SET
    host_paid = CASE WHEN p_role = 'host' THEN true ELSE host_paid END,
    joiner_paid = CASE WHEN p_role = 'joiner' THEN true ELSE joiner_paid END
  WHERE match_id = upper(p_match_id)
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF v_row.host_paid AND (v_row.mode = 'house' OR v_row.joiner_paid) AND v_row.host_ready AND v_row.joiner_ready THEN
    UPDATE public.matches SET status = 'ready' WHERE match_id = v_row.match_id RETURNING * INTO v_row;
  END IF;

  IF v_row.host_paid AND (v_row.mode = 'house' OR v_row.joiner_paid) AND v_row.status <> 'ready' THEN
    UPDATE public.matches SET status = 'locked' WHERE match_id = v_row.match_id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END; $$;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS host_revealed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joiner_revealed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_round_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joiner_round_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena text NOT NULL DEFAULT 'nexus';

CREATE OR REPLACE FUNCTION public.reveal_match_slot(p_match_id text, p_role text, p_slot integer)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.matches;
BEGIN
  IF p_role NOT IN ('host','joiner') THEN RAISE EXCEPTION 'Unknown role'; END IF;
  IF p_slot IS NULL OR p_slot < 0 OR p_slot > 5 THEN RAISE EXCEPTION 'Invalid slot'; END IF;

  UPDATE public.matches SET
    host_revealed = CASE WHEN p_role = 'host' THEN GREATEST(host_revealed, p_slot) ELSE host_revealed END,
    joiner_revealed = CASE WHEN p_role = 'joiner' THEN GREATEST(joiner_revealed, p_slot) ELSE joiner_revealed END,
    status = CASE WHEN status = 'ready' THEN 'playing' ELSE status END
  WHERE match_id = upper(p_match_id)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.advance_match_round(p_match_id text, p_host_wins integer, p_joiner_wins integer)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.matches;
BEGIN
  UPDATE public.matches SET
    round = LEAST(round + 1, 3),
    host_revealed = 0,
    joiner_revealed = 0,
    host_round_wins = GREATEST(COALESCE(p_host_wins, 0), host_round_wins),
    joiner_round_wins = GREATEST(COALESCE(p_joiner_wins, 0), joiner_round_wins)
  WHERE match_id = upper(p_match_id)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.set_match_arena(p_match_id text, p_arena text)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.matches;
BEGIN
  IF p_arena NOT IN ('nexus','mountain','volcano','city','forest','void') THEN
    RAISE EXCEPTION 'Unknown arena';
  END IF;
  UPDATE public.matches SET arena = p_arena WHERE match_id = upper(p_match_id)
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  RETURN v_row;
END; $$;