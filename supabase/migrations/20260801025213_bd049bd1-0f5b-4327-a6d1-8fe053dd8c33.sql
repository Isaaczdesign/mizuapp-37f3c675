-- 1) Soft delete for platform notes
ALTER TABLE public.platform_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

DROP POLICY IF EXISTS "notes_staff_read" ON public.platform_notes;
CREATE POLICY "notes_staff_read" ON public.platform_notes FOR SELECT TO authenticated
USING (
  public.is_platform_staff(auth.uid())
  AND (deleted_at IS NULL OR public.has_platform_role(auth.uid(), 'super_admin'))
);

DROP POLICY IF EXISTS "notes_staff_update" ON public.platform_notes;
CREATE POLICY "notes_staff_update" ON public.platform_notes FOR UPDATE TO authenticated
USING (public.is_platform_staff(auth.uid()) AND deleted_at IS NULL)
WITH CHECK (
  public.is_platform_staff(auth.uid())
  AND deleted_at IS NULL
  AND deleted_by IS NULL
);

REVOKE DELETE ON public.platform_notes FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_delete_platform_note(_note_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_note public.platform_notes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão';
  END IF;
  SELECT * INTO v_note FROM public.platform_notes WHERE id = _note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Observação não encontrada'; END IF;
  IF v_note.deleted_at IS NOT NULL THEN RETURN; END IF;

  UPDATE public.platform_notes
     SET deleted_at = now(), deleted_by = auth.uid(), deletion_reason = left(btrim(_reason), 500)
   WHERE id = _note_id;

  INSERT INTO public.platform_admin_logs(actor_id, action, entity_type, entity_id, old_value, new_value, reason)
  VALUES (auth.uid(), 'note.deleted', 'platform_note', _note_id,
          jsonb_build_object('body', v_note.body, 'status', v_note.status, 'restaurant_id', v_note.restaurant_id),
          jsonb_build_object('deleted', true), left(btrim(_reason), 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_restore_platform_note(_note_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_note public.platform_notes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_platform_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  SELECT * INTO v_note FROM public.platform_notes WHERE id = _note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Observação não encontrada'; END IF;

  UPDATE public.platform_notes
     SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL
   WHERE id = _note_id;

  INSERT INTO public.platform_admin_logs(actor_id, action, entity_type, entity_id, old_value, new_value, reason)
  VALUES (auth.uid(), 'note.restored', 'platform_note', _note_id,
          jsonb_build_object('deleted_at', v_note.deleted_at, 'deleted_by', v_note.deleted_by,
                             'deletion_reason', v_note.deletion_reason),
          jsonb_build_object('deleted', false), left(btrim(_reason), 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_purge_platform_note(_note_id uuid, _reason text, _confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_note public.platform_notes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_platform_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF upper(btrim(COALESCE(_confirmation, ''))) <> 'EXCLUIR DEFINITIVAMENTE' THEN
    RAISE EXCEPTION 'Frase de confirmação inválida';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo';
  END IF;
  SELECT * INTO v_note FROM public.platform_notes WHERE id = _note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Observação não encontrada'; END IF;
  IF v_note.deleted_at IS NULL THEN RAISE EXCEPTION 'Exclua a observação antes de apagá-la em definitivo'; END IF;

  INSERT INTO public.platform_admin_logs(actor_id, action, entity_type, entity_id, old_value, new_value, reason)
  VALUES (auth.uid(), 'note.purged', 'platform_note', _note_id,
          jsonb_build_object('body', v_note.body, 'restaurant_id', v_note.restaurant_id,
                             'deleted_at', v_note.deleted_at, 'deleted_by', v_note.deleted_by),
          NULL, left(btrim(_reason), 500));

  DELETE FROM public.platform_notes WHERE id = _note_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_platform_note(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_restore_platform_note(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_purge_platform_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_platform_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_platform_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_platform_note(uuid, text, text) TO authenticated;

-- 2) Addon quantities in public order creation
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
  v_variation_id uuid; v_addons_json jsonb; v_item_name text;
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
    v_delta := 0; v_addons := 0; v_addon_names := NULL; v_addons_json := NULL;

    v_variation_id := NULLIF(v_item->>'variation_id', '')::uuid;
    IF v_variation_id IS NOT NULL THEN
      SELECT COALESCE(price_delta, 0) INTO v_delta FROM public.menu_item_variations
        WHERE id = v_variation_id AND menu_item_id = v_mi.id AND is_active = true;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variação indisponível'; END IF;
    END IF;

    -- addon_ids accepts legacy ["uuid", ...] or [{"id":"uuid","quantity":2}, ...]
    IF jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      SELECT jsonb_agg(jsonb_build_object('id', aid, 'qty', aqty))
        INTO v_addons_json
        FROM (
          SELECT
            CASE WHEN jsonb_typeof(e) = 'object' THEN e->>'id' ELSE e #>> '{}' END AS aid,
            LEAST(GREATEST(COALESCE(
              CASE WHEN jsonb_typeof(e) = 'object' THEN NULLIF(e->>'quantity','')::int END, 1), 1), 99) AS aqty
          FROM jsonb_array_elements(v_item->'addon_ids') e
        ) s
       WHERE COALESCE(s.aid, '') <> '';
    END IF;

    IF v_addons_json IS NOT NULL AND jsonb_array_length(v_addons_json) > 0 THEN
      IF (SELECT count(*) FROM jsonb_array_elements(v_addons_json) a
            JOIN public.menu_item_addons m
              ON m.id = (a->>'id')::uuid AND m.menu_item_id = v_mi.id AND m.is_active = true)
         <> jsonb_array_length(v_addons_json) THEN
        RAISE EXCEPTION 'Adicional indisponível';
      END IF;

      SELECT COALESCE(SUM(m.price * (a->>'qty')::int), 0),
             string_agg(CASE WHEN (a->>'qty')::int > 1 THEN (a->>'qty') || 'x ' || m.name ELSE m.name END,
                        ', ' ORDER BY m.sort_order)
        INTO v_addons, v_addon_names
        FROM jsonb_array_elements(v_addons_json) a
        JOIN public.menu_item_addons m ON m.id = (a->>'id')::uuid;
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