
-- Ensure Data API grants on core config tables (were missing, causing writes to fail)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

-- Rewrite settings policy with explicit WITH CHECK so INSERT works reliably
DROP POLICY IF EXISTS "Owner can manage settings" ON public.settings;

CREATE POLICY "Owners view settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid())
         AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners insert settings"
  ON public.settings FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid())
              AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid())
         AND public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid())
              AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners delete settings"
  ON public.settings FOR DELETE
  TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid())
         AND public.has_role(auth.uid(), 'owner'::app_role));
