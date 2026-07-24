
CREATE OR REPLACE FUNCTION public.is_restaurant_open_now(_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours jsonb;
  v_now timestamptz := now();
  v_dow int;
  v_prev_dow int;
  v_cur_min int;
  v_keys text[] := ARRAY['sun','mon','tue','wed','thu','fri','sat'];
  v_key text;
  v_day jsonb;
  v_open_min int;
  v_close_min int;
  function_check_day int;
BEGIN
  SELECT operating_hours INTO v_hours
  FROM public.settings WHERE restaurant_id = _restaurant_id;

  IF v_hours IS NULL OR jsonb_typeof(v_hours) <> 'object' THEN
    RETURN true; -- no config = always open
  END IF;

  -- day-of-week in America/Sao_Paulo: 0=Sun..6=Sat
  v_dow := EXTRACT(DOW FROM (v_now AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_cur_min := EXTRACT(HOUR FROM (v_now AT TIME ZONE 'America/Sao_Paulo'))::int * 60
             + EXTRACT(MINUTE FROM (v_now AT TIME ZONE 'America/Sao_Paulo'))::int;

  -- helper inline: check today
  v_key := v_keys[v_dow + 1];
  v_day := v_hours -> v_key;
  IF v_day IS NOT NULL AND COALESCE((v_day->>'closed')::boolean, false) = false THEN
    v_open_min  := split_part(v_day->>'open',':',1)::int * 60 + split_part(v_day->>'open',':',2)::int;
    v_close_min := split_part(v_day->>'close',':',1)::int * 60 + split_part(v_day->>'close',':',2)::int;
    IF v_close_min > v_open_min THEN
      IF v_cur_min >= v_open_min AND v_cur_min < v_close_min THEN RETURN true; END IF;
    ELSE
      -- overnight window
      IF v_cur_min >= v_open_min OR v_cur_min < v_close_min THEN RETURN true; END IF;
    END IF;
  END IF;

  -- check previous day's overnight tail
  v_prev_dow := (v_dow + 6) % 7;
  v_key := v_keys[v_prev_dow + 1];
  v_day := v_hours -> v_key;
  IF v_day IS NOT NULL AND COALESCE((v_day->>'closed')::boolean, false) = false THEN
    v_open_min  := split_part(v_day->>'open',':',1)::int * 60 + split_part(v_day->>'open',':',2)::int;
    v_close_min := split_part(v_day->>'close',':',1)::int * 60 + split_part(v_day->>'close',':',2)::int;
    IF v_close_min <= v_open_min AND v_cur_min < v_close_min THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;

-- Patch create_public_order to also enforce operating hours
CREATE OR REPLACE FUNCTION public.create_public_order(_restaurant_id uuid, _customer_id uuid, _total numeric, _notes text, _order_type text, _payment_method text, _payment_change_for numeric, _table_id uuid, _delivery_fee numeric, _delivery_address jsonb, _items jsonb, _coupon_code text DEFAULT NULL::text)
 RETURNS TABLE(order_id uuid, tracking_token text, discount_applied numeric, final_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid; v_tracking_token uuid; v_item jsonb; v_active boolean; v_accepting boolean;
  v_payment_status text; v_payment_expires timestamptz;
  v_coupon public.coupons%ROWTYPE;
  v_subtotal numeric; v_discount numeric := 0; v_final_total numeric; v_note text;
BEGIN
  SELECT r.is_active, COALESCE(r.accepting_orders, true)
    INTO v_active, v_accepting
    FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF v_active IS NULL OR v_active = false THEN RAISE EXCEPTION 'Restaurante indisponível'; END IF;
  IF v_accepting = false THEN RAISE EXCEPTION 'Estabelecimento fechado — não estamos aceitando novos pedidos'; END IF;
  IF public.is_restaurant_open_now(_restaurant_id) = false THEN
    RAISE EXCEPTION 'Fora do horário de funcionamento — novos pedidos só serão aceitos no próximo horário de abertura';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.restaurant_id = _restaurant_id) THEN
    RAISE EXCEPTION 'Cliente inválido';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens';
  END IF;

  v_subtotal := GREATEST(_total - COALESCE(_delivery_fee, 0), 0);
  v_final_total := _total; v_note := _notes;

  IF _coupon_code IS NOT NULL AND length(btrim(_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon FROM public.coupons
      WHERE restaurant_id = _restaurant_id AND upper(code) = upper(btrim(_coupon_code)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado'; END IF;
    IF v_coupon.is_active IS NOT TRUE THEN RAISE EXCEPTION 'Cupom inativo'; END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN RAISE EXCEPTION 'Cupom expirado'; END IF;
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
                   ELSE 'R$ ' || v_coupon.discount_value::text END || ')';
  END IF;

  v_payment_status := CASE WHEN _payment_method IN ('pix', 'credit_card_online') THEN 'pending' ELSE NULL END;
  v_payment_expires := CASE WHEN _payment_method IN ('pix', 'credit_card_online') THEN now() + interval '15 minutes' ELSE NULL END;

  INSERT INTO public.orders (
    restaurant_id, customer_id, total, notes, order_type, payment_method,
    payment_change_for, table_id, delivery_fee, delivery_address, status,
    payment_status, payment_expires_at
  ) VALUES (
    _restaurant_id, _customer_id, v_final_total, v_note, _order_type, _payment_method,
    _payment_change_for,
    CASE WHEN _order_type = 'dine_in' THEN _table_id ELSE NULL END,
    COALESCE(_delivery_fee, 0),
    CASE WHEN _order_type = 'delivery' THEN _delivery_address ELSE NULL END,
    'new', v_payment_status, v_payment_expires
  )
  RETURNING public.orders.id, public.orders.tracking_token INTO v_order_id, v_tracking_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, notes)
    VALUES (v_order_id, NULLIF(v_item->>'menu_item_id', '')::uuid, v_item->>'name',
      GREATEST((v_item->>'quantity')::int, 1), (v_item->>'unit_price')::numeric, NULLIF(v_item->>'notes', ''));
  END LOOP;

  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_usages (coupon_id, customer_id, order_id) VALUES (v_coupon.id, _customer_id, v_order_id);
    UPDATE public.coupons SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = v_coupon.id;
  END IF;

  RETURN QUERY SELECT v_order_id, v_tracking_token::text, v_discount, v_final_total;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.is_restaurant_open_now(uuid) TO anon, authenticated;
