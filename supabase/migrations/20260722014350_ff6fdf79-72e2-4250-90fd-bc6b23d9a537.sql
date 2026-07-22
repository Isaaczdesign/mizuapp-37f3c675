
-- restaurants
DROP POLICY IF EXISTS "Members can view restaurant" ON public.restaurants;
CREATE POLICY "Members can view restaurant" ON public.restaurants
  FOR SELECT TO authenticated
  USING (id = public.get_user_restaurant_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can update restaurant" ON public.restaurants;
CREATE POLICY "Owners can update restaurant" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (id = public.get_user_restaurant_id(auth.uid()) AND public.has_role(auth.uid(),'owner'))
  WITH CHECK (id = public.get_user_restaurant_id(auth.uid()) AND public.has_role(auth.uid(),'owner'));

-- restaurant_tables
DROP POLICY IF EXISTS "Members can view tables" ON public.restaurant_tables;
CREATE POLICY "Members can view tables" ON public.restaurant_tables
  FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));

DROP POLICY IF EXISTS "Managers can manage tables" ON public.restaurant_tables;
CREATE POLICY "Managers can manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));

-- appointments
DROP POLICY IF EXISTS "Members can manage appointments" ON public.appointments;
CREATE POLICY "Members can manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- automation_rules
DROP POLICY IF EXISTS "Managers can manage automations" ON public.automation_rules;
CREATE POLICY "Managers can manage automations" ON public.automation_rules
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));

-- coupons / coupon_usages
DROP POLICY IF EXISTS "Managers can manage coupons" ON public.coupons;
CREATE POLICY "Managers can manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));

DROP POLICY IF EXISTS "Members can view coupons" ON public.coupons;
CREATE POLICY "Members can view coupons" ON public.coupons
  FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can view coupon usages" ON public.coupon_usages;
CREATE POLICY "Members can view coupon usages" ON public.coupon_usages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_usages.coupon_id AND c.restaurant_id = public.get_user_restaurant_id(auth.uid())));

DROP POLICY IF EXISTS "Managers can insert coupon usages" ON public.coupon_usages;
CREATE POLICY "Managers can insert coupon usages" ON public.coupon_usages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_usages.coupon_id AND c.restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))));

-- menu_import_jobs
DROP POLICY IF EXISTS "Members can manage import jobs" ON public.menu_import_jobs;
CREATE POLICY "Members can manage import jobs" ON public.menu_import_jobs
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- message_logs
DROP POLICY IF EXISTS "Managers can view logs" ON public.message_logs;
CREATE POLICY "Managers can view logs" ON public.message_logs
  FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager')));

-- Restore audit trigger
ALTER TABLE public.orders ENABLE TRIGGER trg_orders_audit;
