ALTER TABLE public.platform_announcements
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS show_modal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_url text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_announcements;