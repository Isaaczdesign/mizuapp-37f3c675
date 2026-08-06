CREATE OR REPLACE FUNCTION public.get_restaurant_public_state(_slug text)
RETURNS TABLE(name text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.name, r.is_active
  FROM public.restaurants r
  WHERE lower(r.slug) = lower(_slug)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_public_state(text) TO anon, authenticated;