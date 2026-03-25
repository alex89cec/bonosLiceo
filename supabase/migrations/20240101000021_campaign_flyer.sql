-- Add flyer_url column to campaigns for campaign flyer images
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS flyer_url text;

-- Create the campaign-flyers storage bucket (public for reads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-flyers', 'campaign-flyers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access on campaign-flyers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-flyers');

-- Allow admins to upload
CREATE POLICY "Admin upload to campaign-flyers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-flyers'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to update (replace)
CREATE POLICY "Admin update campaign-flyers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'campaign-flyers'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to delete
CREATE POLICY "Admin delete from campaign-flyers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'campaign-flyers'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
