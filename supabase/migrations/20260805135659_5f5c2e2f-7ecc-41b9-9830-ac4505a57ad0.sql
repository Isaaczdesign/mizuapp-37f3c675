CREATE OR REPLACE FUNCTION public.get_public_coupons(_restaurant_id uuid)
RETURNS TABLE(id uuid, code text, description text, discount_type text, discount_value numeric, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, c.expires_at
  FROM public.coupons c
  JOIN public.restaurants r ON r.id = c.restaurant_id
  WHERE c.restaurant_id = _restaurant_id
    AND r.is_active = true
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR COALESCE(c.uses_count, 0) < c.max_uses)
  ORDER BY c.created_at DESC
  LIMIT 20
$$;

GRANT EXECUTE ON FUNCTION public.get_public_coupons(uuid) TO anon, authenticated;