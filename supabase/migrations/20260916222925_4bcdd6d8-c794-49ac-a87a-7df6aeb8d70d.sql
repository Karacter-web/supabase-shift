DROP POLICY IF EXISTS "Users read own voice samples" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own voice samples" ON storage.objects;
DROP POLICY IF EXISTS "Users update own voice samples" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own voice samples" ON storage.objects;

CREATE POLICY "Users read own voice samples" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own voice samples" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own voice samples" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own voice samples" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users read own call recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own call recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users update own call recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own call recordings" ON storage.objects;

CREATE POLICY "Users read own call recordings" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'call-recordings' AND (auth.uid()::text = (storage.foldername(name))[1] OR private.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Users upload own call recordings" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own call recordings" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own call recordings" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);