CREATE OR REPLACE FUNCTION public.list_card_unlocks(p_wallet text)
RETURNS TABLE(card_id text, tx_hash text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT split_part(p.payment_ref, ':', 2) AS card_id, p.tx_hash, p.created_at
    FROM public.payments p
   WHERE p.kind = 'card-unlock'
     AND lower(p.payer) = lower(p_wallet)
   ORDER BY p.created_at DESC
   LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.list_card_unlocks(text) TO anon, authenticated, service_role;