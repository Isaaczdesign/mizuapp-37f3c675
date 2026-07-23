
-- Drop broad anonymous SELECT policies that leaked cross-tenant data via 30s time window
DROP POLICY IF EXISTS "Anon can read just-created customer" ON public.customers;
DROP POLICY IF EXISTS "Anon can read just-created order" ON public.orders;
DROP POLICY IF EXISTS "Anon can read items of just-created order" ON public.order_items;

-- Secure RPC to create an order + items atomically, returning only the tracking token
CREATE OR REPLACE FUNCTION public.create_public_order(
  _restaurant_id uuid,
  _customer_id uuid,
  _total numeric,
  _notes text,
  _order_type text,
  _payment_method text,
  _payment_change_for numeric,
  _table_id uuid,
  _delivery_fee numeric,
  _delivery_address jsonb,
  _items jsonb
) RETURNS TABLE(order_id uuid, tracking_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_token text;
  v_item jsonb;
  v_active boolean;
BEGIN
  -- Validate restaurant exists and is active
  SELECT is_active INTO v_active FROM public.restaurants WHERE id = _restaurant_id;
  IF v_active IS NULL OR v_active = false THEN
    RAISE EXCEPTION 'Restaurante indisponível';
  END IF;

  -- Validate customer belongs to same restaurant
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id AND restaurant_id = _restaurant_id) THEN
    RAISE EXCEPTION 'Cliente inválido';
  END IF;

  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens';
  END IF;

  INSERT INTO public.orders (
    restaurant_id, customer_id, total, notes, order_type, payment_method,
    payment_change_for, table_id, delivery_fee, delivery_address, status
  ) VALUES (
    _restaurant_id, _customer_id, _total, _notes, _order_type, _payment_method,
    _payment_change_for, _table_id, COALESCE(_delivery_fee, 0), _delivery_address, 'pending'
  )
  RETURNING id, tracking_token INTO v_order_id, v_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, notes)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'menu_item_id','')::uuid,
      v_item->>'name',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      NULLIF(v_item->>'notes','')
    );
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, uuid, numeric, text, text, text, numeric, uuid, numeric, jsonb, jsonb) TO anon, authenticated;
