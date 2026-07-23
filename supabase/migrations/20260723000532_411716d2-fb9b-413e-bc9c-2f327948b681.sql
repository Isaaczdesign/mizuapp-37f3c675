
DROP FUNCTION IF EXISTS public.get_public_restaurant_by_slug(text);
CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(_slug text)
RETURNS TABLE(
  id uuid, name text, slug text, logo_url text, banner_url text, description text,
  primary_color text, pickup_enabled boolean, dine_in_enabled boolean, delivery_enabled boolean,
  delivery_fee numeric, payment_methods jsonb, pickup_dine_in_note text, owner_phone text,
  is_active boolean, operating_hours jsonb, mp_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.name, r.slug, r.logo_url, r.banner_url, r.description, r.primary_color,
         r.pickup_enabled, r.dine_in_enabled, r.delivery_enabled, r.delivery_fee,
         r.payment_methods, r.pickup_dine_in_note, r.owner_phone, r.is_active,
         s.operating_hours,
         COALESCE(r.mp_enabled, false) AS mp_enabled
  FROM public.restaurants r
  LEFT JOIN public.settings s ON s.restaurant_id = r.id
  WHERE r.slug = _slug AND r.is_active = true
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_slug(text) TO anon, authenticated;
