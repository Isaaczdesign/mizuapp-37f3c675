
-- 1) Restaurants: drop broad anon SELECT policy; expose safe view instead
DROP POLICY IF EXISTS "Public can lookup restaurant" ON public.restaurants;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- 2) Restaurant tables: drop broad anon SELECT policy; use scoped RPC by token
DROP POLICY IF EXISTS "Public can view table by id" ON public.restaurant_tables;

CREATE OR REPLACE FUNCTION public.get_table_by_token(_token text)
RETURNS TABLE(id uuid, restaurant_id uuid, number integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.restaurant_id, t.number
  FROM public.restaurant_tables t
  JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.token = _token AND t.is_active = true AND r.is_active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_table_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_by_token(text) TO anon, authenticated;

-- 3) Customers: enforce rate limiting inside find_or_create_customer
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _restaurant_id uuid, _name text, _whatsapp text, _consent boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _active boolean;
  _allowed boolean;
BEGIN
  IF _whatsapp IS NULL OR length(regexp_replace(_whatsapp, '\D', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'Invalid whatsapp number';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  SELECT is_active INTO _active FROM public.restaurants WHERE id = _restaurant_id;
  IF _active IS NOT TRUE THEN
    RAISE EXCEPTION 'Restaurant not active';
  END IF;

  -- Rate limit: max 10 find-or-create per whatsapp per 5 minutes
  SELECT public.check_rate_limit(
    'find_or_create_customer',
    _restaurant_id::text || ':' || regexp_replace(_whatsapp, '\D', '', 'g'),
    10, 300
  ) INTO _allowed;
  IF NOT _allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;

  SELECT id INTO _id FROM public.customers
    WHERE restaurant_id = _restaurant_id AND whatsapp = _whatsapp
    LIMIT 1;
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  INSERT INTO public.customers (restaurant_id, name, whatsapp, consent_marketing)
    VALUES (_restaurant_id, _name, _whatsapp, _consent)
    RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 4) Storage: menu-images — remove broad listing SELECT and scope writes by restaurant folder
DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete menu images" ON storage.objects;

-- The bucket is public, so files remain accessible via public URLs (CDN) without a SELECT policy.
-- Writes must be scoped to the user's own restaurant folder: <restaurant_id>/...
CREATE POLICY "Members can upload to own restaurant folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1]::uuid = public.get_user_restaurant_id(auth.uid())
);

CREATE POLICY "Members can update own restaurant files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1]::uuid = public.get_user_restaurant_id(auth.uid())
)
WITH CHECK (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1]::uuid = public.get_user_restaurant_id(auth.uid())
);

CREATE POLICY "Members can delete own restaurant files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1]::uuid = public.get_user_restaurant_id(auth.uid())
);

-- 5) Revoke EXECUTE on SECURITY DEFINER functions that should not be public
REVOKE EXECUTE ON FUNCTION public.get_user_restaurant_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Keep public-callable functions available
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(uuid, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;
