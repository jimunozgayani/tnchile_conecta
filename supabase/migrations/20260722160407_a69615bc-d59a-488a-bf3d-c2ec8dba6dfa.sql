
CREATE TABLE public.space_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('switched','lost-all','gained')),
  from_space TEXT,
  to_space TEXT,
  added_roles TEXT[] NOT NULL DEFAULT '{}',
  removed_roles TEXT[] NOT NULL DEFAULT '{}',
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.space_audit_log TO authenticated;
GRANT ALL ON public.space_audit_log TO service_role;

ALTER TABLE public.space_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.space_audit_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own_insert" ON public.space_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX space_audit_log_user_created_idx
  ON public.space_audit_log (user_id, created_at DESC);
