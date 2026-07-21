CREATE OR REPLACE FUNCTION public.is_public_restaurant_active(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = _restaurant_id
      AND r.is_active = true
  )
$function$;

REVOKE ALL ON FUNCTION public.is_public_restaurant_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_restaurant_active(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can view categories of active restaurants" ON public.menu_categories;
CREATE POLICY "Public can view categories of active restaurants"
ON public.menu_categories
FOR SELECT
TO anon, authenticated
USING (public.is_public_restaurant_active(restaurant_id));

DROP POLICY IF EXISTS "Public can view items of active restaurants" ON public.menu_items;
CREATE POLICY "Public can view items of active restaurants"
ON public.menu_items
FOR SELECT
TO anon, authenticated
USING (is_active = true AND public.is_public_restaurant_active(restaurant_id));

DROP POLICY IF EXISTS "Public can view variations of active restaurants" ON public.menu_item_variations;
CREATE POLICY "Public can view variations of active restaurants"
ON public.menu_item_variations
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = menu_item_variations.menu_item_id
      AND mi.is_active = true
      AND public.is_public_restaurant_active(mi.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Public can view addons of active restaurants" ON public.menu_item_addons;
CREATE POLICY "Public can view addons of active restaurants"
ON public.menu_item_addons
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = menu_item_addons.menu_item_id
      AND mi.is_active = true
      AND public.is_public_restaurant_active(mi.restaurant_id)
  )
);