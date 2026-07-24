CREATE OR REPLACE FUNCTION public.get_active_orders_by_whatsapp(_restaurant_id uuid, _whatsapp text)
RETURNS TABLE(tracking_token text, status text, order_type text, total numeric, created_at timestamp with time zone, restaurant_slug text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_digits text;
BEGIN
  v_digits := regexp_replace(COALESCE(_whatsapp, ''), '\D', '', 'g');
  IF length(v_digits) < 8 THEN
    RAISE EXCEPTION 'Número de WhatsApp inválido';
  END IF;

  RETURN QUERY
  SELECT o.tracking_token::text, o.status::text, o.order_type::text, o.total, o.created_at, r.slug
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.restaurant_id = _restaurant_id
    AND regexp_replace(COALESCE(c.whatsapp, ''), '\D', '', 'g') = v_digits
    AND o.created_at > now() - interval '24 hours'
    AND o.status::text NOT IN ('completed', 'delivered', 'canceled', 'cancelled')
  ORDER BY o.created_at DESC
  LIMIT 5;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_active_orders_by_whatsapp(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_active_orders_by_whatsapp(uuid, text) TO anon, authenticated, service_role;