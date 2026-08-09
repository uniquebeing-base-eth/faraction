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