
-- Public can view restaurants (needed for QR menu slug resolution)
CREATE POLICY "Public can view restaurants" ON public.restaurants FOR SELECT USING (true);

-- Public can view restaurant_tables (needed for token validation on QR menu)
CREATE POLICY "Public can view tables" ON public.restaurant_tables FOR SELECT USING (true);
