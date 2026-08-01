DROP POLICY IF EXISTS "platform_media_read_authenticated" ON storage.objects;

CREATE POLICY "platform_media_read_staff"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'platform-media' AND public.is_platform_staff(auth.uid()));