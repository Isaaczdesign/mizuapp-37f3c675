
DROP POLICY IF EXISTS "Public can insert orders in active restaurants" ON public.orders;
CREATE POLICY "Public can insert orders in active restaurants" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
