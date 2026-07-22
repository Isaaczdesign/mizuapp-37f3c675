CREATE POLICY "Members can view own restaurant files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND ((storage.foldername(name))[1])::uuid = public.get_user_restaurant_id(auth.uid())
);
