
-- Public validation function for coupons
CREATE OR REPLACE FUNCTION public.validate_public_coupon(_restaurant_id uuid, _code text)
RETURNS TABLE(id uuid, code text, description text, discount_type text, discount_value numeric, is_valid boolean, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, false, 'Informe um código'::text;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.coupons
    WHERE restaurant_id = _restaurant_id AND upper(code) = upper(btrim(_code))
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, false, 'Cupom não encontrado'::text;
    RETURN;
  END IF;

  IF c.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, false, 'Cupom inativo'::text;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, false, 'Cupom expirado'::text;
    RETURN;
  END IF;

  IF c.max_uses IS NOT NULL AND COALESCE(c.uses_count, 0) >= c.max_uses THEN
    RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, false, 'Limite de usos atingido'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_public_coupon(uuid, text) TO anon, authenticated;

-- Recreate create_public_order with optional coupon
DROP FUNCTION IF EXISTS public.create_public_order(uuid, uuid, numeric, text, text, text, numeric, uuid, numeric, jsonb, jsonb);

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
  _items jsonb,
  _coupon_code text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, tracking_token text, discount_applied numeric, final_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_tracking_token uuid;
  v_item jsonb;
  v_active boolean;
  v_payment_status text;
  v_coupon public.coupons%ROWTYPE;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_final_total numeric;
  v_note text;
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

  v_subtotal := GREATEST(_total - COALESCE(_delivery_fee, 0), 0);
  v_final_total := _total;
  v_note := _notes;

  -- Coupon handling
  IF _coupon_code IS NOT NULL AND length(btrim(_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon FROM public.coupons
      WHERE restaurant_id = _restaurant_id AND upper(code) = upper(btrim(_coupon_code))
      FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado'; END IF;
    IF v_coupon.is_active IS NOT TRUE THEN RAISE EXCEPTION 'Cupom inativo'; END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
      RAISE EXCEPTION 'Cupom expirado';
    END IF;
    IF v_coupon.max_uses IS NOT NULL AND COALESCE(v_coupon.uses_count, 0) >= v_coupon.max_uses THEN
      RAISE EXCEPTION 'Cupom sem usos disponíveis';
    END IF;

    IF v_coupon.discount_type = 'percent' THEN
      v_discount := ROUND(v_subtotal * (v_coupon.discount_value / 100.0), 2);
    ELSE
      v_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;
    v_discount := GREATEST(v_discount, 0);
    v_final_total := GREATEST(v_subtotal - v_discount, 0) + COALESCE(_delivery_fee, 0);
    v_note := COALESCE(v_note || E'\n', '') || 'Cupom aplicado: ' || v_coupon.code || ' (-' ||
              CASE WHEN v_coupon.discount_type = 'percent'
                   THEN v_coupon.discount_value::text || '%'
                   ELSE 'R$ ' || v_coupon.discount_value::text
              END || ')';
  END IF;

  v_payment_status := CASE WHEN _payment_method = 'pix' THEN 'pending' ELSE NULL END;

  INSERT INTO public.orders (
    restaurant_id, customer_id, total, notes, order_type, payment_method,
    payment_change_for, table_id, delivery_fee, delivery_address, status, payment_status
  ) VALUES (
    _restaurant_id, _customer_id, v_final_total, v_note, _order_type, _payment_method,
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

  -- Record coupon usage & increment counter
  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_usages (coupon_id, customer_id, order_id)
    VALUES (v_coupon.id, _customer_id, v_order_id);
    UPDATE public.coupons SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = v_coupon.id;
  END IF;

  RETURN QUERY SELECT v_order_id, v_tracking_token::text, v_discount, v_final_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, uuid, numeric, text, text, text, numeric, uuid, numeric, jsonb, jsonb, text) TO anon, authenticated;
