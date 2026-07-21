DROP POLICY IF EXISTS "Members can manage categories" ON public.menu_categories;
CREATE POLICY "Members can manage categories"
ON public.menu_categories
FOR ALL
TO authenticated
USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can manage items" ON public.menu_items;
CREATE POLICY "Members can manage items"
ON public.menu_items
FOR ALL
TO authenticated
USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can manage variations" ON public.menu_item_variations;
CREATE POLICY "Members can manage variations"
ON public.menu_item_variations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = menu_item_variations.menu_item_id
      AND mi.restaurant_id = public.get_user_restaurant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = menu_item_variations.menu_item_id
      AND mi.restaurant_id = public.get_user_restaurant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Members can manage addons" ON public.menu_item_addons;
CREATE POLICY "Members can manage addons"
ON public.menu_item_addons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = menu_item_addons.menu_item_id
      AND mi.restaurant_id = public.get_user_restaurant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = menu_item_addons.menu_item_id
      AND mi.restaurant_id = public.get_user_restaurant_id(auth.uid())
  )
);