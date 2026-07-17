
-- ---------- restaurants ----------
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;

CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT id, name, slug, logo_url, banner_url, description, primary_color,
       pickup_enabled, dine_in_enabled, payment_methods, pickup_dine_in_note
FROM public.restaurants;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;

REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (id, name, slug, logo_url, banner_url, description, primary_color,
              pickup_enabled, dine_in_enabled, payment_methods, pickup_dine_in_note,
              created_at, updated_at)
  ON public.restaurants TO anon;

CREATE POLICY "Public can lookup restaurant"
ON public.restaurants FOR SELECT TO anon USING (true);

-- ---------- restaurant_tables ----------
DROP POLICY IF EXISTS "Public can view tables" ON public.restaurant_tables;
CREATE POLICY "Public can view table by id"
ON public.restaurant_tables FOR SELECT TO anon USING (true);

-- ---------- is_active flag ----------
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------- menu_* restringido a restaurantes ativos ----------
DROP POLICY IF EXISTS "Public can view items" ON public.menu_items;
CREATE POLICY "Public can view items of active restaurants"
ON public.menu_items FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_items.restaurant_id AND r.is_active));

DROP POLICY IF EXISTS "Public can view categories" ON public.menu_categories;
CREATE POLICY "Public can view categories of active restaurants"
ON public.menu_categories FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_categories.restaurant_id AND r.is_active));

DROP POLICY IF EXISTS "Public can view addons" ON public.menu_item_addons;
CREATE POLICY "Public can view addons of active restaurants"
ON public.menu_item_addons FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.menu_items mi JOIN public.restaurants r ON r.id = mi.restaurant_id
               WHERE mi.id = menu_item_addons.menu_item_id AND r.is_active));

DROP POLICY IF EXISTS "Public can view variations" ON public.menu_item_variations;
CREATE POLICY "Public can view variations of active restaurants"
ON public.menu_item_variations FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.menu_items mi JOIN public.restaurants r ON r.id = mi.restaurant_id
               WHERE mi.id = menu_item_variations.menu_item_id AND r.is_active));

-- ---------- orders / order_items — remover leitura pública em massa ----------
DROP POLICY IF EXISTS "Public can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON public.orders(tracking_token);

CREATE OR REPLACE FUNCTION public.get_public_order(_token uuid)
RETURNS TABLE (id uuid, status text, total numeric, notes text, created_at timestamptz, items jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.status::text, o.total, o.notes, o.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'notes', oi.notes))
      FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
  FROM public.orders o WHERE o.tracking_token = _token
$$;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;

-- ---------- INSERT público restringido ----------
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Public can insert customers" ON public.customers;

CREATE POLICY "Public can insert customers in active restaurants"
ON public.customers FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = customers.restaurant_id AND r.is_active));

CREATE POLICY "Public can insert orders in active restaurants"
ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.is_active)
  AND status = 'new'
);

CREATE POLICY "Public can insert order items via recent order"
ON public.order_items FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = order_items.order_id AND r.is_active
    AND o.created_at > now() - interval '5 minutes'
));

-- ---------- Rate limiting ----------
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  identifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON public.rate_limit_events(bucket, identifier, created_at DESC);
GRANT ALL ON public.rate_limit_events TO service_role;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only rate_limit"
ON public.rate_limit_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket text, _identifier text, _max_events int, _window_seconds int
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.rate_limit_events
  WHERE bucket = _bucket AND identifier = _identifier
    AND created_at > now() - (_window_seconds || ' seconds')::interval;
  IF _count >= _max_events THEN RETURN false; END IF;
  INSERT INTO public.rate_limit_events(bucket, identifier) VALUES (_bucket, _identifier);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, int, int) TO service_role;

-- ---------- LGPD: opt-in ----------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS opt_in_text_version text,
  ADD COLUMN IF NOT EXISTS opt_out_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_customers_opt_out_token ON public.customers(opt_out_token);
