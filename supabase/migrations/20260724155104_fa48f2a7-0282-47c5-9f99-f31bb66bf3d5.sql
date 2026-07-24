
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS short_code text;
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_short_code_key ON public.restaurants (short_code) WHERE short_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_slug_available(_slug text, _restaurant_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE lower(slug) = lower(_slug) AND (_restaurant_id IS NULL OR id <> _restaurant_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.resolve_short_code(_code text)
RETURNS TABLE(slug text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.slug FROM public.restaurants r
  WHERE lower(r.short_code) = lower(_code) AND r.is_active = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.generate_restaurant_short_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rid uuid; v_existing text; v_code text; v_attempts int := 0;
  v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
BEGIN
  v_rid := public.get_user_restaurant_id(auth.uid());
  IF v_rid IS NULL THEN RAISE EXCEPTION 'No restaurant for current user'; END IF;
  IF NOT public.has_role(auth.uid(), 'owner') THEN RAISE EXCEPTION 'Only owners can generate short codes'; END IF;
  SELECT short_code INTO v_existing FROM public.restaurants WHERE id = v_rid;
  IF v_existing IS NOT NULL AND length(v_existing) > 0 THEN RETURN v_existing; END IF;
  LOOP
    v_attempts := v_attempts + 1; v_code := '';
    FOR i IN 1..5 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      UPDATE public.restaurants SET short_code = v_code WHERE id = v_rid;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 15 THEN RAISE EXCEPTION 'Could not generate unique short code'; END IF;
    END;
  END LOOP;
  RETURN v_code;
END;
$$;

DROP FUNCTION IF EXISTS public.get_public_restaurant_by_slug(text);
CREATE FUNCTION public.get_public_restaurant_by_slug(_slug text)
RETURNS TABLE(
  id uuid, name text, slug text, logo_url text, banner_url text, description text,
  primary_color text, pickup_enabled boolean, dine_in_enabled boolean, delivery_enabled boolean,
  delivery_fee numeric, payment_methods jsonb, pickup_dine_in_note text, owner_phone text,
  is_active boolean, operating_hours jsonb, mp_enabled boolean, accepting_orders boolean,
  closed_message text, short_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.slug, r.logo_url, r.banner_url, r.description, r.primary_color,
         r.pickup_enabled, r.dine_in_enabled, r.delivery_enabled, r.delivery_fee,
         r.payment_methods, r.pickup_dine_in_note, r.owner_phone, r.is_active,
         s.operating_hours,
         COALESCE(r.mp_enabled, false) AS mp_enabled,
         COALESCE(r.accepting_orders, true) AS accepting_orders,
         r.closed_message, r.short_code
  FROM public.restaurants r
  LEFT JOIN public.settings s ON s.restaurant_id = r.id
  WHERE r.slug = _slug AND r.is_active = true LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.check_slug_available(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_restaurant_short_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_short_code(text) TO anon, authenticated;
