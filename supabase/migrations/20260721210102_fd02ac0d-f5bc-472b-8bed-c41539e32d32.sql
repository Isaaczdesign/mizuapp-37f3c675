GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT SELECT ON public.menu_item_variations TO anon, authenticated;
GRANT SELECT ON public.menu_item_addons TO anon, authenticated;

GRANT ALL ON public.menu_categories TO service_role;
GRANT ALL ON public.menu_items TO service_role;
GRANT ALL ON public.menu_item_variations TO service_role;
GRANT ALL ON public.menu_item_addons TO service_role;