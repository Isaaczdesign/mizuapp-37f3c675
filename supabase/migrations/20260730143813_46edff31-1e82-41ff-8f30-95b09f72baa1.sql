-- 1. Funções de gatilho: nunca devem ser chamadas diretamente pela API
REVOKE ALL ON FUNCTION public.log_order_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_order_items_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_shift_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_status_timestamps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_tenant_change() FROM PUBLIC, anon, authenticated;

-- 2. Rotinas administrativas: fora do alcance de visitantes anônimos
REVOKE ALL ON FUNCTION public.cancel_expired_pending_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_expired_pending_payments() TO service_role;

REVOKE ALL ON FUNCTION public.generate_restaurant_short_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_restaurant_short_code() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_data_access(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_data_access(text, text, jsonb) TO authenticated, service_role;

-- 3. get_current_shift: vazava totais de caixa de qualquer restaurante
CREATE OR REPLACE FUNCTION public.get_current_shift(_restaurant_id uuid)
RETURNS SETOF public.work_shifts
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF public.get_user_restaurant_id(auth.uid()) IS DISTINCT FROM _restaurant_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN QUERY
    SELECT * FROM public.work_shifts ws
     WHERE ws.restaurant_id = _restaurant_id
       AND ws.status IN ('open','service_closed')
     ORDER BY ws.opened_at DESC
     LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_current_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_shift(uuid) TO authenticated, service_role;