REVOKE EXECUTE ON FUNCTION public.get_restaurant_plan_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.restaurant_has_feature(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_feature(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_plan() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_restaurant_plan_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_has_feature(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_feature(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_plan() TO authenticated, service_role;