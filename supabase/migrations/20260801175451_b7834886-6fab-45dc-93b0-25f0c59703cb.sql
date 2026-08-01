CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  variant text NOT NULL DEFAULT 'update',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_announcements_variant_check CHECK (variant IN ('info','update','warning','maintenance'))
);

GRANT SELECT ON public.platform_announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_announcements TO authenticated;
GRANT ALL ON public.platform_announcements TO service_role;

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active announcements"
ON public.platform_announcements FOR SELECT TO authenticated
USING (
  (active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()))
  OR public.has_platform_role(auth.uid(), 'admin')
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Platform admins manage announcements"
ON public.platform_announcements FOR ALL TO authenticated
USING (public.has_platform_role(auth.uid(), 'admin') OR public.has_platform_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_platform_role(auth.uid(), 'admin') OR public.has_platform_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_platform_announcements_active ON public.platform_announcements (active, starts_at DESC);

CREATE TRIGGER update_platform_announcements_updated_at
BEFORE UPDATE ON public.platform_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();