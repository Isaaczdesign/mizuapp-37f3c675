
DROP POLICY IF EXISTS "Public can insert orders in active restaurants" ON public.orders;
CREATE POLICY "Public can insert orders in active restaurants" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_public_restaurant_active(restaurant_id));

CREATE POLICY "Anon can read just-created order" ON public.orders
  FOR SELECT TO anon
  USING (created_at > (now() - interval '30 seconds'));

CREATE POLICY "Anon can read just-created customer" ON public.customers
  FOR SELECT TO anon
  USING (created_at > (now() - interval '30 seconds'));

CREATE POLICY "Anon can read items of just-created order" ON public.order_items
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.created_at > (now() - interval '30 seconds')));
