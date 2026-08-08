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
