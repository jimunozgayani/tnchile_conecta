import { supabase } from "@/integrations/supabase/client";

export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
