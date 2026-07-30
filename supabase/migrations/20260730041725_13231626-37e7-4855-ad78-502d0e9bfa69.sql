-- 1) Remove gravação pública direta (bypass das funções validadas)
DROP POLICY IF EXISTS "Public can insert orders in active restaurants" ON public.orders;
DROP POLICY IF EXISTS "Public can insert order items via recent order" ON public.order_items;
DROP POLICY IF EXISTS "Public can insert customers in active restaurants" ON public.customers;

REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;
REVOKE INSERT ON public.customers FROM anon;

-- 2) Rotina de manutenção não deve ser acionável pelo público
REVOKE EXECUTE ON FUNCTION public.cancel_expired_pending_payments() FROM anon, authenticated;

-- 3) Preço calculado no servidor
CREATE OR REPLACE FUNCTION public.create_public_order(
  _restaurant_id uuid, _customer_id uuid, _total numeric, _notes text, _order_type text,
  _payment_method text, _payment_change_for numeric, _table_id uuid, _delivery_fee numeric,
  _delivery_address jsonb, _items jsonb, _coupon_code text DEFAULT NULL::text)
RETURNS TABLE(order_id uuid, tracking_token text, discount_applied numeric, final_total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  -- Taxa de entrega vem do cadastro do restaurante, nunca do cliente
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

-- 4) Recuperação de pedido exige nome + telefone, com limite de tentativas
DROP FUNCTION IF EXISTS public.get_active_orders_by_whatsapp(uuid, text);

CREATE OR REPLACE FUNCTION public.get_active_orders_by_whatsapp(
  _restaurant_id uuid, _whatsapp text, _name text DEFAULT NULL)
RETURNS TABLE(tracking_token text, status text, order_type text, total numeric,
              created_at timestamp with time zone, restaurant_slug text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_digits text;
  v_name text;
BEGIN
  v_digits := regexp_replace(COALESCE(_whatsapp, ''), '\D', '', 'g');
  v_name := lower(btrim(COALESCE(_name, '')));

  IF length(v_digits) < 10 THEN
    RAISE EXCEPTION 'Número de WhatsApp inválido';
  END IF;
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome usado no pedido';
  END IF;

  IF NOT public.check_rate_limit('recover_orders', _restaurant_id::text || ':' || v_digits, 8, 900) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  END IF;

  RETURN QUERY
  SELECT o.tracking_token::text, o.status::text, o.order_type::text, o.total, o.created_at, r.slug
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.restaurant_id = _restaurant_id
    AND regexp_replace(COALESCE(c.whatsapp, ''), '\D', '', 'g') = v_digits
    AND lower(btrim(c.name)) LIKE v_name || '%'
    AND o.created_at > now() - interval '24 hours'
    AND o.status::text NOT IN ('completed', 'delivered', 'canceled', 'cancelled')
  ORDER BY o.created_at DESC
  LIMIT 5;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_active_orders_by_whatsapp(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_active_orders_by_whatsapp(uuid, text, text) TO anon, authenticated, service_role;