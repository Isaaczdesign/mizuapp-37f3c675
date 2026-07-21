GRANT EXECUTE ON FUNCTION public.get_user_restaurant_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;