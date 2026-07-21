CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(_slug text)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  logo_url text,
  banner_url text,
  description text,
  primary_color text,
  pickup_enabled boolean,
  dine_in_enabled boolean,
  payment_methods jsonb,
  pickup_dine_in_note text,
  owner_phone text,
  is_active boolean,
  operating_hours jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    r.id,
    r.name,
    r.slug,
    r.logo_url,
    r.banner_url,
    r.description,
    r.primary_color,
    r.pickup_enabled,
    r.dine_in_enabled,
    r.payment_methods,
    r.pickup_dine_in_note,
    r.owner_phone,
    r.is_active,
    s.operating_hours
  FROM public.restaurants r
  LEFT JOIN public.settings s ON s.restaurant_id = r.id
  WHERE r.slug = _slug
    AND r.is_active = true
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_public_restaurant_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_slug(text) TO anon, authenticated, service_role;