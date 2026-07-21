
-- 1) Tighten customers policies: split ALL into role-scoped writes + member reads
DROP POLICY IF EXISTS "Members can view customers" ON public.customers;

CREATE POLICY "Members can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));

CREATE POLICY "Owners and managers can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (
  restaurant_id = public.get_user_restaurant_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Owners and managers can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (
  restaurant_id = public.get_user_restaurant_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  restaurant_id = public.get_user_restaurant_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Owners and managers can delete customers"
ON public.customers FOR DELETE
TO authenticated
USING (
  restaurant_id = public.get_user_restaurant_id(auth.uid())
  AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
);

-- 2) Explicit SELECT policy for menu-images bucket (public read of menu images only)
DROP POLICY IF EXISTS "Public can read menu images" ON storage.objects;
CREATE POLICY "Public can read menu images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'menu-images');
