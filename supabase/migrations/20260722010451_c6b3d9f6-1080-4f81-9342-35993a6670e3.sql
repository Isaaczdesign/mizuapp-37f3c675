-- Remove broad SELECT policy that permits listing all files in the public menu-images bucket.
-- Public URLs (/object/public/...) continue to work because the bucket is public;
-- only the list endpoint requires a SELECT policy on storage.objects.
DROP POLICY IF EXISTS "Public can read menu images" ON storage.objects;
DROP POLICY IF EXISTS "Public read menu-images" ON storage.objects;