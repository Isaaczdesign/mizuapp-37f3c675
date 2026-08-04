ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number integer;

ALTER TABLE public.orders DISABLE TRIGGER trg_orders_validate_type;
ALTER TABLE public.orders DISABLE TRIGGER orders_update_customer_stats;
ALTER TABLE public.orders DISABLE TRIGGER trg_orders_audit;
ALTER TABLE public.orders DISABLE TRIGGER trg_set_order_status_timestamps;
ALTER TABLE public.orders DISABLE TRIGGER update_orders_updated_at;

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY restaurant_id ORDER BY created_at, id) AS rn
  FROM public.orders
)
UPDATE public.orders o SET order_number = n.rn
FROM numbered n WHERE n.id = o.id AND o.order_number IS NULL;

ALTER TABLE public.orders ENABLE TRIGGER trg_orders_validate_type;
ALTER TABLE public.orders ENABLE TRIGGER orders_update_customer_stats;
ALTER TABLE public.orders ENABLE TRIGGER trg_orders_audit;
ALTER TABLE public.orders ENABLE TRIGGER trg_set_order_status_timestamps;
ALTER TABLE public.orders ENABLE TRIGGER update_orders_updated_at;

CREATE UNIQUE INDEX IF NOT EXISTS orders_restaurant_number_idx
  ON public.orders (restaurant_id, order_number);

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('order_number:' || NEW.restaurant_id::text));
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO NEW.order_number
      FROM public.orders WHERE restaurant_id = NEW.restaurant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_number ON public.orders;
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

DROP FUNCTION IF EXISTS public.get_public_order(uuid);
CREATE FUNCTION public.get_public_order(_token uuid)
RETURNS TABLE(id uuid, order_number integer, status text, order_type text, total numeric, notes text, created_at timestamp with time zone, delivery_eta timestamp with time zone, delivery_address jsonb, restaurant_address text, restaurant_slug text, restaurant_name text, restaurant_phone text, items jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.check_rate_limit('public_order_read', public.client_ip(), 240, 300) THEN
    RAISE EXCEPTION 'Muitas consultas. Aguarde alguns instantes e tente novamente.';
  END IF;

  RETURN QUERY
  SELECT o.id, o.order_number, o.status::text, o.order_type::text, o.total, o.notes, o.created_at, o.delivery_eta, o.delivery_address,
    r.address AS restaurant_address,
    r.slug AS restaurant_slug,
    r.name AS restaurant_name,
    r.owner_phone AS restaurant_phone,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'notes', oi.notes))
      FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
  FROM public.orders o
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.tracking_token = _token;
END;
$$;