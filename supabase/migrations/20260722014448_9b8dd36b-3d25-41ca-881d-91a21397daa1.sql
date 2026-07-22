
DROP POLICY IF EXISTS "Public can insert orders in active restaurants" ON public.orders;
CREATE POLICY "Public can insert orders in active restaurants" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_public_restaurant_active(restaurant_id) AND status = 'new'::order_status);

DROP POLICY IF EXISTS "Public can insert customers in active restaurants" ON public.customers;
CREATE POLICY "Public can insert customers in active restaurants" ON public.customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_public_restaurant_active(restaurant_id));

DROP POLICY IF EXISTS "Public can insert order items via recent order" ON public.order_items;
CREATE POLICY "Public can insert order items via recent order" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.is_public_restaurant_active(o.restaurant_id)
      AND o.created_at > (now() - interval '5 minutes')
  ));
