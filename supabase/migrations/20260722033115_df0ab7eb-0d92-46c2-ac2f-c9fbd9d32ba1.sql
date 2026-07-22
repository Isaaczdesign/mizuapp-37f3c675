
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered';

DROP FUNCTION IF EXISTS public.get_public_order(uuid);
CREATE OR REPLACE FUNCTION public.get_public_order(_token uuid)
 RETURNS TABLE(id uuid, status text, order_type text, total numeric, notes text, created_at timestamp with time zone, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.status::text, o.order_type::text, o.total, o.notes, o.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'notes', oi.notes))
      FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
  FROM public.orders o WHERE o.tracking_token = _token
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;

UPDATE public.restaurants SET delivery_enabled = true, delivery_fee = CASE WHEN COALESCE(delivery_fee,0) = 0 THEN 8 ELSE delivery_fee END
WHERE slug LIKE 'sushi-do-isaac%';
