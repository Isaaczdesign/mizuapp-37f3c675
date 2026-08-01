CREATE TABLE public.platform_announcement_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.platform_announcement_views TO authenticated;
GRANT ALL ON public.platform_announcement_views TO service_role;

ALTER TABLE public.platform_announcement_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own announcement views"
ON public.platform_announcement_views FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own announcement views"
ON public.platform_announcement_views FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own announcement views"
ON public.platform_announcement_views FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Platform staff read all announcement views"
ON public.platform_announcement_views FOR SELECT TO authenticated
USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER update_platform_announcement_views_updated_at
BEFORE UPDATE ON public.platform_announcement_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pav_announcement ON public.platform_announcement_views(announcement_id);