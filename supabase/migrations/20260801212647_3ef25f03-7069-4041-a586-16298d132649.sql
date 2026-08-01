CREATE POLICY "platform_media_read_announcements"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'platform-media' AND name LIKE 'announcements/%');