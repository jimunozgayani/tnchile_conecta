
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "driver photos read" ON storage.objects;
CREATE POLICY "driver photos read by owner" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
