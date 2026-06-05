-- Fix 1: Realtime authorization — scope channel subscriptions per user
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own topic" ON realtime.messages;
CREATE POLICY "Users subscribe to own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Fix 2: Admin storage access for documents and driver-photos
DROP POLICY IF EXISTS "Admins read all documents storage" ON storage.objects;
CREATE POLICY "Admins read all documents storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins read all driver photos storage" ON storage.objects;
CREATE POLICY "Admins read all driver photos storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);