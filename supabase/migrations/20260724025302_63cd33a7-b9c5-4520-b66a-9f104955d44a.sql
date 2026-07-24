
-- 1. Restaurant status columns
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS closed_message text;

-- 2. work_shifts
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','service_closed','financial_closed','reopened')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid,
  service_closed_at timestamptz,
  service_closed_by uuid,
  financial_closed_at timestamptz,
  financial_closed_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  reopen_reason text,
  responsible_name text,
  notes text,
  divergence_justification text,
  pending_orders_justification text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_cash numeric NOT NULL DEFAULT 0,
  informed_cash numeric NOT NULL DEFAULT 0,
  cash_diff numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_shifts_restaurant ON public.work_shifts(restaurant_id, opened_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_shifts_open_per_restaurant
  ON public.work_shifts(restaurant_id) WHERE status IN ('open','service_closed');

GRANT SELECT, INSERT, UPDATE ON public.work_shifts TO authenticated;
GRANT ALL ON public.work_shifts TO service_role;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift select own restaurant" ON public.work_shifts;
CREATE POLICY "shift select own restaurant" ON public.work_shifts FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));
DROP POLICY IF EXISTS "shift insert owner/manager" ON public.work_shifts;
CREATE POLICY "shift insert owner/manager" ON public.work_shifts FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
  );
DROP POLICY IF EXISTS "shift update owner/manager" ON public.work_shifts;
CREATE POLICY "shift update owner/manager" ON public.work_shifts FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
  );

DROP TRIGGER IF EXISTS trg_work_shifts_updated_at ON public.work_shifts;
CREATE TRIGGER trg_work_shifts_updated_at
  BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. shift_cash_counts
CREATE TABLE IF NOT EXISTS public.shift_cash_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  expected numeric NOT NULL DEFAULT 0,
  informed numeric NOT NULL DEFAULT 0,
  diff numeric NOT NULL DEFAULT 0,
  orders_count int NOT NULL DEFAULT 0,
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, payment_method)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_cash_counts TO authenticated;
GRANT ALL ON public.shift_cash_counts TO service_role;
ALTER TABLE public.shift_cash_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_counts select own" ON public.shift_cash_counts;
CREATE POLICY "cash_counts select own" ON public.shift_cash_counts FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));
DROP POLICY IF EXISTS "cash_counts write owner/manager" ON public.shift_cash_counts;
CREATE POLICY "cash_counts write owner/manager" ON public.shift_cash_counts FOR ALL TO authenticated
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
  )
  WITH CHECK (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
  );

DROP TRIGGER IF EXISTS trg_cash_counts_updated_at ON public.shift_cash_counts;
CREATE TRIGGER trg_cash_counts_updated_at
  BEFORE UPDATE ON public.shift_cash_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. shift_cash_movements
CREATE TABLE IF NOT EXISTS public.shift_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('sangria','suprimento','retirada','despesa','ajuste')),
  amount numeric NOT NULL,
  description text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_shift ON public.shift_cash_movements(shift_id);
GRANT SELECT, INSERT, DELETE ON public.shift_cash_movements TO authenticated;
GRANT ALL ON public.shift_cash_movements TO service_role;
ALTER TABLE public.shift_cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movements select own" ON public.shift_cash_movements;
CREATE POLICY "movements select own" ON public.shift_cash_movements FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));
DROP POLICY IF EXISTS "movements insert owner/manager" ON public.shift_cash_movements;
CREATE POLICY "movements insert owner/manager" ON public.shift_cash_movements FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
  );
DROP POLICY IF EXISTS "movements delete owner/manager" ON public.shift_cash_movements;
CREATE POLICY "movements delete owner/manager" ON public.shift_cash_movements FOR DELETE TO authenticated
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
  );

-- 5. shift_audit_logs (immutable)
CREATE TABLE IF NOT EXISTS public.shift_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_audit_restaurant ON public.shift_audit_logs(restaurant_id, created_at DESC);
GRANT SELECT, INSERT ON public.shift_audit_logs TO authenticated;
GRANT ALL ON public.shift_audit_logs TO service_role;
ALTER TABLE public.shift_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit select own" ON public.shift_audit_logs;
CREATE POLICY "audit select own" ON public.shift_audit_logs FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));
DROP POLICY IF EXISTS "audit insert own" ON public.shift_audit_logs;
CREATE POLICY "audit insert own" ON public.shift_audit_logs FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- 6. get_current_shift
CREATE OR REPLACE FUNCTION public.get_current_shift(_restaurant_id uuid)
RETURNS SETOF public.work_shifts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.work_shifts
  WHERE restaurant_id = _restaurant_id AND status IN ('open','service_closed')
  ORDER BY opened_at DESC LIMIT 1
$$;

-- 7. Block public order creation when restaurant closed
CREATE OR REPLACE FUNCTION public.create_public_order(_restaurant_id uuid, _customer_id uuid, _total numeric, _notes text, _order_type text, _payment_method text, _payment_change_for numeric, _table_id uuid, _delivery_fee numeric, _delivery_address jsonb, _items jsonb, _coupon_code text DEFAULT NULL::text)
 RETURNS TABLE(order_id uuid, tracking_token text, discount_applied numeric, final_total numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid; v_tracking_token uuid; v_item jsonb; v_active boolean; v_accepting boolean;
  v_payment_status text; v_payment_expires timestamptz;
  v_coupon public.coupons%ROWTYPE;
  v_subtotal numeric; v_discount numeric := 0; v_final_total numeric; v_note text;
BEGIN
  SELECT r.is_active, COALESCE(r.accepting_orders, true) INTO v_active, v_accepting FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF v_active IS NULL OR v_active = false THEN RAISE EXCEPTION 'Restaurante indisponível'; END IF;
  IF v_accepting IS NOT TRUE THEN RAISE EXCEPTION 'Estabelecimento fechado no momento. Novos pedidos não estão sendo aceitos.'; END IF;
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

-- 8. Update get_public_restaurant_by_slug
DROP FUNCTION IF EXISTS public.get_public_restaurant_by_slug(text);
CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(_slug text)
 RETURNS TABLE(id uuid, name text, slug text, logo_url text, banner_url text, description text, primary_color text, pickup_enabled boolean, dine_in_enabled boolean, delivery_enabled boolean, delivery_fee numeric, payment_methods jsonb, pickup_dine_in_note text, owner_phone text, is_active boolean, operating_hours jsonb, mp_enabled boolean, accepting_orders boolean, closed_message text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.id, r.name, r.slug, r.logo_url, r.banner_url, r.description, r.primary_color,
         r.pickup_enabled, r.dine_in_enabled, r.delivery_enabled, r.delivery_fee,
         r.payment_methods, r.pickup_dine_in_note, r.owner_phone, r.is_active,
         s.operating_hours,
         COALESCE(r.mp_enabled, false) AS mp_enabled,
         COALESCE(r.accepting_orders, true) AS accepting_orders,
         r.closed_message
  FROM public.restaurants r
  LEFT JOIN public.settings s ON s.restaurant_id = r.id
  WHERE r.slug = _slug AND r.is_active = true
  LIMIT 1
$function$;
