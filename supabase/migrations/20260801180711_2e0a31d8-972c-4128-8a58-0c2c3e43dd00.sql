ALTER TABLE public.platform_announcements
  ADD COLUMN IF NOT EXISTS target_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_restaurant_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.platform_announcements
  ADD CONSTRAINT platform_announcements_target_scope_check
  CHECK (target_scope IN ('all','restaurants'));

DROP POLICY IF EXISTS "Authenticated can read active announcements" ON public.platform_announcements;

CREATE POLICY "Authenticated can read active announcements"
ON public.platform_announcements FOR SELECT TO authenticated
USING (
  (
    active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
    AND (
      target_scope = 'all'
      OR public.get_user_restaurant_id(auth.uid()) = ANY (target_restaurant_ids)
    )
  )
  OR public.has_platform_role(auth.uid(), 'admin')
  OR public.has_platform_role(auth.uid(), 'super_admin')
);