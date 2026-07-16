-- ============================================================
-- SQL Policies for Supabase Storage objects in 'menu-images'
-- Run this in your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. SELECT (Public read access)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-images');

-- 2. INSERT (Authenticated upload access)
CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

-- 3. UPDATE (Authenticated replace access)
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-images');

-- 4. DELETE (Authenticated remove access)
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');
