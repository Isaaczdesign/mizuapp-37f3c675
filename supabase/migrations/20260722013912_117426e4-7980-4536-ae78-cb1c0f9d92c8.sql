
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_change_for numeric,
  ADD COLUMN IF NOT EXISTS delivery_address jsonb,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_time timestamptz;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('dine_in','pickup','delivery'));

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.validate_order_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_type = 'dine_in' AND NEW.table_id IS NULL THEN
    RAISE EXCEPTION 'Pedidos para consumo no local exigem número da mesa';
  END IF;
  IF NEW.order_type = 'delivery' AND (NEW.delivery_address IS NULL OR NEW.delivery_address::text = '{}') THEN
    RAISE EXCEPTION 'Pedidos de delivery exigem endereço de entrega';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_validate_type ON public.orders;
CREATE TRIGGER trg_orders_validate_type
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_type();

DROP POLICY IF EXISTS "Members can manage orders" ON public.orders;
CREATE POLICY "Members can manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can manage order items" ON public.order_items;
CREATE POLICY "Members can manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.restaurant_id = public.get_user_restaurant_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.restaurant_id = public.get_user_restaurant_id(auth.uid())));

DROP FUNCTION IF EXISTS public.get_public_restaurant_by_slug(text);
CREATE FUNCTION public.get_public_restaurant_by_slug(_slug text)
RETURNS TABLE(
  id uuid, name text, slug text, logo_url text, banner_url text,
  description text, primary_color text,
  pickup_enabled boolean, dine_in_enabled boolean,
  delivery_enabled boolean, delivery_fee numeric,
  payment_methods jsonb, pickup_dine_in_note text,
  owner_phone text, is_active boolean, operating_hours jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.slug, r.logo_url, r.banner_url, r.description, r.primary_color,
         r.pickup_enabled, r.dine_in_enabled, r.delivery_enabled, r.delivery_fee,
         r.payment_methods, r.pickup_dine_in_note, r.owner_phone, r.is_active,
         s.operating_hours
  FROM public.restaurants r
  LEFT JOIN public.settings s ON s.restaurant_id = r.id
  WHERE r.slug = _slug AND r.is_active = true
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_tables(_restaurant_id uuid)
RETURNS TABLE(id uuid, number integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.number
  FROM public.restaurant_tables t
  JOIN public.restaurants r ON r.id = t.restaurant_id
  WHERE t.restaurant_id = _restaurant_id
    AND t.is_active = true
    AND r.is_active = true
  ORDER BY t.number
$$;
GRANT EXECUTE ON FUNCTION public.get_public_tables(uuid) TO anon, authenticated;
