-- Create feedback storage bucket
-- Note: This needs to be run in Supabase SQL Editor or via Supabase CLI
-- The feedback table already exists, so this migration only sets up the storage bucket

-- First, create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback',
  'feedback',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload feedback screenshots to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Service role has full access to feedback bucket" ON storage.objects;

-- RLS Policies for the feedback bucket

-- Policy 1: Allow authenticated users to upload files to their own email folder
CREATE POLICY "Users can upload feedback screenshots to their folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback' AND
  (storage.foldername(name))[1] = auth.jwt()->>'email'
);

-- Policy 2: Allow users to read files from their own email folder
CREATE POLICY "Users can view their own feedback screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback' AND
  (storage.foldername(name))[1] = auth.jwt()->>'email'
);

-- Policy 3: Allow users to delete files from their own email folder
CREATE POLICY "Users can delete their own feedback screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback' AND
  (storage.foldername(name))[1] = auth.jwt()->>'email'
);

-- Policy 4: Allow service role (admin) full access
CREATE POLICY "Service role has full access to feedback bucket"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'feedback')
WITH CHECK (bucket_id = 'feedback');

-- Note: Feedback table RLS policies should already be configured
-- If not, you can enable them with:
-- ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- And create appropriate policies for SELECT, INSERT, UPDATE, DELETE
