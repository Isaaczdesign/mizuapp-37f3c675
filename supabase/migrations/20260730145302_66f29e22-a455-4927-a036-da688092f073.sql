REVOKE ALL ON public.restaurant_tables FROM anon;
REVOKE ALL ON public.menu_import_jobs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_import_jobs TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
GRANT ALL ON public.menu_import_jobs TO service_role;