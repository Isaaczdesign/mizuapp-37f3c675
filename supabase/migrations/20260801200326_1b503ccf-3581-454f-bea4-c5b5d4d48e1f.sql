ALTER TABLE public.platform_announcements
  ADD COLUMN IF NOT EXISTS media_poster TEXT,
  ADD COLUMN IF NOT EXISTS media_loop BOOLEAN NOT NULL DEFAULT true;

CREATE POLICY "platform_media_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'platform-media');

CREATE POLICY "platform_media_insert_staff"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'platform-media'
  AND (public.has_platform_role(auth.uid(), 'admin') OR public.has_platform_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "platform_media_update_staff"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'platform-media'
  AND (public.has_platform_role(auth.uid(), 'admin') OR public.has_platform_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "platform_media_delete_staff"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'platform-media'
  AND (public.has_platform_role(auth.uid(), 'admin') OR public.has_platform_role(auth.uid(), 'super_admin'))
);