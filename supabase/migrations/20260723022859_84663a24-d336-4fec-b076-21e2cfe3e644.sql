DROP FUNCTION IF EXISTS public.get_public_order(uuid);
CREATE OR REPLACE FUNCTION public.get_public_order(_token uuid)
 RETURNS TABLE(id uuid, status text, order_type text, total numeric, notes text, created_at timestamp with time zone, delivery_eta timestamp with time zone, delivery_address jsonb, restaurant_address text, restaurant_slug text, items jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.status::text, o.order_type::text, o.total, o.notes, o.created_at, o.delivery_eta, o.delivery_address,
    r.address AS restaurant_address,
    r.slug AS restaurant_slug,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'notes', oi.notes))
      FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
  FROM public.orders o
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.tracking_token = _token
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;