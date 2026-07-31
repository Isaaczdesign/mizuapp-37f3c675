-- Helper: best-effort client IP from request headers
CREATE OR REPLACE FUNCTION public.client_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE h jsonb; v text;
BEGIN
  BEGIN
    h := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN others THEN
    RETURN 'unknown';
  END;
  IF h IS NULL THEN RETURN 'unknown'; END IF;
  v := NULLIF(btrim(split_part(COALESCE(h->>'cf-connecting-ip', ''), ',', 1)), '');
  IF v IS NULL THEN v := NULLIF(btrim(split_part(COALESCE(h->>'x-forwarded-for', ''), ',', 1)), ''); END IF;
  IF v IS NULL THEN v := NULLIF(btrim(COALESCE(h->>'x-real-ip', '')), ''); END IF;
  IF v IS NULL THEN RETURN 'unknown'; END IF;
  RETURN left(v, 64);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.client_ip() FROM PUBLIC;

-- Speed up rate limit counting
CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_identifier_created_idx
  ON public.rate_limit_events (bucket, identifier, created_at DESC);

-- 1) Coupon validation: 15 attempts / 10 min per restaurant+IP
CREATE OR REPLACE FUNCTION public.validate_public_coupon(_restaurant_id uuid, _code text)
 RETURNS TABLE(id uuid, code text, description text, discount_type text, discount_value numeric, is_valid boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, false, 'Informe um código'::text;
    RETURN;
  END IF;

  IF NOT public.check_rate_limit('coupon_validate', _restaurant_id::text || ':' || public.client_ip(), 15, 600) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, false,
      'Muitas tentativas de cupom. Aguarde alguns minutos e tente novamente.'::text;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.coupons AS cp
    WHERE cp.restaurant_id = _restaurant_id AND upper(cp.code) = upper(btrim(_code))
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
$function$;

-- 2) Public order tracking: 240 reads / 5 min per IP
CREATE OR REPLACE FUNCTION public.get_public_order(_token uuid)
 RETURNS TABLE(id uuid, status text, order_type text, total numeric, notes text, created_at timestamp with time zone, delivery_eta timestamp with time zone, delivery_address jsonb, restaurant_address text, restaurant_slug text, items jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.check_rate_limit('public_order_read', public.client_ip(), 240, 300) THEN
    RAISE EXCEPTION 'Muitas consultas. Aguarde alguns instantes e tente novamente.';
  END IF;

  RETURN QUERY
  SELECT o.id, o.status::text, o.order_type::text, o.total, o.notes, o.created_at, o.delivery_eta, o.delivery_address,
    r.address AS restaurant_address,
    r.slug AS restaurant_slug,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'notes', oi.notes))
      FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
  FROM public.orders o
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.tracking_token = _token;
END;
$function$;

-- 3) Customer-side cancellation: 10 attempts / 10 min per IP
CREATE OR REPLACE FUNCTION public.cancel_public_order(_token uuid, _reason text DEFAULT NULL::text)
 RETURNS TABLE(order_id uuid, status text, payment_status text, refund_needed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.check_rate_limit('public_order_cancel', public.client_ip(), 10, 600) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  END IF;

  SELECT *
    INTO v_order
    FROM public.orders
   WHERE tracking_token = _token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status::text = 'canceled' THEN
    order_id := v_order.id;
    status := v_order.status::text;
    payment_status := v_order.payment_status;
    refund_needed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_order.status::text <> 'new' THEN
    RAISE EXCEPTION 'Este pedido já está em preparo e não pode mais ser cancelado';
  END IF;

  UPDATE public.orders AS updated_order
     SET status = 'canceled',
         notes = COALESCE(updated_order.notes || E'\n', '') || 'Cancelado pelo cliente'
                 || CASE WHEN _reason IS NOT NULL AND length(btrim(_reason)) > 0
                         THEN ': ' || btrim(_reason) ELSE '' END
   WHERE updated_order.id = v_order.id
   RETURNING updated_order.id, updated_order.status::text, updated_order.payment_status
        INTO order_id, status, payment_status;

  refund_needed := (v_order.mp_payment_id IS NOT NULL AND v_order.payment_status IN ('approved', 'paid'));
  RETURN NEXT;
END;
$function$;

-- 4) Order creation: 8 orders / 10 min per restaurant+IP
CREATE OR REPLACE FUNCTION public.create_public_order(_restaurant_id uuid, _customer_id uuid, _total numeric, _notes text, _order_type text, _payment_method text, _payment_change_for numeric, _table_id uuid, _delivery_fee numeric, _delivery_address jsonb, _items jsonb, _coupon_code text DEFAULT NULL::text)
 RETURNS TABLE(order_id uuid, tracking_token text, discount_applied numeric, final_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid; v_tracking_token uuid; v_item jsonb;
  v_active boolean; v_accepting boolean; v_delivery_enabled boolean; v_restaurant_fee numeric;
  v_payment_status text; v_payment_expires timestamptz;
  v_coupon public.coupons%ROWTYPE;
  v_subtotal numeric := 0; v_discount numeric := 0; v_fee numeric := 0; v_final_total numeric;
  v_note text;
  v_mi public.menu_items%ROWTYPE;
  v_qty int; v_unit numeric; v_delta numeric; v_addons numeric; v_addon_names text;
  v_variation_id uuid; v_addon_ids uuid[]; v_item_name text;
BEGIN
  IF NOT public.check_rate_limit('create_public_order', _restaurant_id::text || ':' || public.client_ip(), 8, 600) THEN
    RAISE EXCEPTION 'Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente.';
  END IF;

  SELECT r.is_active, COALESCE(r.accepting_orders, true), COALESCE(r.delivery_enabled, false), COALESCE(r.delivery_fee, 0)
    INTO v_active, v_accepting, v_delivery_enabled, v_restaurant_fee
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
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'Pedido com itens demais'; END IF;
  IF _order_type NOT IN ('dine_in', 'pickup', 'delivery') THEN RAISE EXCEPTION 'Tipo de pedido inválido'; END IF;

  v_note := _notes;
  IF v_note IS NOT NULL AND length(v_note) > 2000 THEN v_note := left(v_note, 2000); END IF;

  v_fee := CASE WHEN _order_type = 'delivery' AND v_delivery_enabled THEN v_restaurant_fee ELSE 0 END;

  INSERT INTO public.orders (
    restaurant_id, customer_id, total, notes, order_type, payment_method,
    payment_change_for, table_id, delivery_fee, delivery_address, status,
    payment_status, payment_expires_at
  ) VALUES (
    _restaurant_id, _customer_id, 0, v_note, _order_type, _payment_method,
    _payment_change_for,
    CASE WHEN _order_type = 'dine_in' THEN _table_id ELSE NULL END,
    v_fee,
    CASE WHEN _order_type = 'delivery' THEN _delivery_address ELSE NULL END,
    'new', NULL, NULL
  )
  RETURNING public.orders.id, public.orders.tracking_token INTO v_order_id, v_tracking_token;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO v_mi FROM public.menu_items mi
      WHERE mi.id = NULLIF(v_item->>'menu_item_id', '')::uuid
        AND mi.restaurant_id = _restaurant_id
        AND mi.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item indisponível no cardápio'; END IF;

    v_qty := LEAST(GREATEST(COALESCE((v_item->>'quantity')::int, 1), 1), 99);
    v_delta := 0; v_addons := 0; v_addon_names := NULL;

    v_variation_id := NULLIF(v_item->>'variation_id', '')::uuid;
    IF v_variation_id IS NOT NULL THEN
      SELECT COALESCE(price_delta, 0) INTO v_delta FROM public.menu_item_variations
        WHERE id = v_variation_id AND menu_item_id = v_mi.id AND is_active = true;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variação indisponível'; END IF;
    END IF;

    IF jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      SELECT array_agg(value::uuid) INTO v_addon_ids
        FROM jsonb_array_elements_text(v_item->'addon_ids') WHERE value <> '';
    ELSE
      v_addon_ids := NULL;
    END IF;

    IF v_addon_ids IS NOT NULL AND array_length(v_addon_ids, 1) > 0 THEN
      SELECT COALESCE(SUM(price), 0), string_agg(name, ', ' ORDER BY sort_order)
        INTO v_addons, v_addon_names
        FROM public.menu_item_addons
        WHERE id = ANY(v_addon_ids) AND menu_item_id = v_mi.id AND is_active = true;
      IF (SELECT count(*) FROM public.menu_item_addons
            WHERE id = ANY(v_addon_ids) AND menu_item_id = v_mi.id AND is_active = true)
         <> array_length(v_addon_ids, 1) THEN
        RAISE EXCEPTION 'Adicional indisponível';
      END IF;
    END IF;

    v_unit := ROUND(v_mi.price + COALESCE(v_delta, 0) + COALESCE(v_addons, 0), 2);
    v_subtotal := v_subtotal + (v_unit * v_qty);

    v_item_name := v_mi.name;
    IF v_variation_id IS NOT NULL THEN
      v_item_name := v_item_name || ' (' ||
        (SELECT name FROM public.menu_item_variations WHERE id = v_variation_id) || ')';
    END IF;
    IF v_addon_names IS NOT NULL THEN
      v_item_name := v_item_name || ' + ' || v_addon_names;
    END IF;

    INSERT INTO public.order_items (order_id, menu_item_id, name, quantity, unit_price, notes)
    VALUES (v_order_id, v_mi.id, left(v_item_name, 300), v_qty, v_unit,
            left(NULLIF(btrim(COALESCE(v_item->>'notes', '')), ''), 300));
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);

  IF _coupon_code IS NOT NULL AND length(btrim(_coupon_code)) > 0 THEN
    IF NOT public.check_rate_limit('coupon_redeem', _restaurant_id::text || ':' || public.client_ip(), 10, 600) THEN
      RAISE EXCEPTION 'Muitas tentativas de cupom. Aguarde alguns minutos e tente novamente.';
    END IF;
    SELECT * INTO v_coupon FROM public.coupons
      WHERE restaurant_id = _restaurant_id AND upper(code) = upper(btrim(_coupon_code)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado'; END IF;
    IF v_coupon.is_active IS NOT TRUE THEN RAISE EXCEPTION 'Cupom inativo'; END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN RAISE EXCEPTION 'Cupom expirado'; END IF;
    IF v_coupon.max_uses IS NOT NULL AND COALESCE(v_coupon.uses_count, 0) >= v_coupon.max_uses THEN
      RAISE EXCEPTION 'Cupom sem usos disponíveis';
    END IF;
    IF v_coupon.discount_type = 'percent' THEN
      v_discount := ROUND(v_subtotal * (LEAST(GREATEST(v_coupon.discount_value, 0), 100) / 100.0), 2);
    ELSE
      v_discount := LEAST(GREATEST(v_coupon.discount_value, 0), v_subtotal);
    END IF;
    v_note := COALESCE(v_note || E'\n', '') || 'Cupom aplicado: ' || v_coupon.code || ' (-' ||
              CASE WHEN v_coupon.discount_type = 'percent'
                   THEN v_coupon.discount_value::text || '%'
                   ELSE 'R$ ' || v_coupon.discount_value::text END || ')';
  END IF;

  v_final_total := ROUND(GREATEST(v_subtotal - v_discount, 0) + v_fee, 2);

  v_payment_status := CASE WHEN _payment_method IN ('pix', 'credit_card_online') THEN 'pending' ELSE NULL END;
  v_payment_expires := CASE WHEN _payment_method IN ('pix', 'credit_card_online') THEN now() + interval '15 minutes' ELSE NULL END;

  UPDATE public.orders
     SET total = v_final_total, notes = v_note,
         payment_status = v_payment_status, payment_expires_at = v_payment_expires
   WHERE id = v_order_id;

  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_usages (coupon_id, customer_id, order_id) VALUES (v_coupon.id, _customer_id, v_order_id);
    UPDATE public.coupons SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = v_coupon.id;
  END IF;

  RETURN QUERY SELECT v_order_id, v_tracking_token::text, v_discount, v_final_total;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_public_coupon(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_public_order(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, uuid, numeric, text, text, text, numeric, uuid, numeric, jsonb, jsonb, text) TO anon, authenticated;