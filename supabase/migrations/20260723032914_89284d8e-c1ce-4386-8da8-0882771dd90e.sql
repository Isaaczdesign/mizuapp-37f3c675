
ALTER TABLE public.orders ALTER COLUMN payment_status DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_public_order(
  _restaurant_id uuid, _customer_id uuid, _total numeric, _notes text,
  _order_type text, _payment_method text, _payment_change_for numeric,
  _table_id uuid, _delivery_fee numeric, _delivery_address jsonb, _items jsonb
)
RETURNS TABLE(order_id uuid, tracking_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_tracking_token uuid;
  v_item jsonb;
  v_active boolean;
  v_payment_status text;
BEGIN
  SELECT r.is_active INTO v_active FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF v_active IS NULL OR v_active = false THEN
    RAISE EXCEPTION 'Restaurante indisponível';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.restaurant_id = _restaurant_id) THEN
    RAISE EXCEPTION 'Cliente inválido';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens';
  END IF;

  v_payment_status := CASE WHEN _payment_method = 'pix' THEN 'pending' ELSE NULL END;

  INSERT INTO public.orders (
    restaurant_id, customer_id, total, notes, order_type, payment_method,
    payment_change_for, table_id, delivery_fee, delivery_address, status, payment_status
  ) VALUES (
    _restaurant_id, _customer_id, _total, _notes, _order_type, _payment_method,
    _payment_change_for,
    CASE WHEN _order_type = 'dine_in' THEN _table_id ELSE NULL END,
    COALESCE(_delivery_fee, 0),
    CASE WHEN _order_type = 'delivery' THEN _delivery_address ELSE NULL END,
    'new', v_payment_status
  )
  RETURNING public.orders.id, public.orders.tracking_token INTO v_order_id, v_tracking_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, notes)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'menu_item_id', '')::uuid,
      v_item->>'name',
      GREATEST((v_item->>'quantity')::int, 1),
      (v_item->>'unit_price')::numeric,
      NULLIF(v_item->>'notes', '')
    );
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_tracking_token::text;
END;
$function$;

UPDATE public.orders SET payment_status = NULL
WHERE payment_status = 'pending'
  AND payment_method IS DISTINCT FROM 'pix'
  AND (
    order_type = 'pickup'
    OR (order_type = 'dine_in' AND table_id IS NOT NULL)
    OR (order_type = 'delivery' AND delivery_address IS NOT NULL AND delivery_address::text <> '{}')
  );
