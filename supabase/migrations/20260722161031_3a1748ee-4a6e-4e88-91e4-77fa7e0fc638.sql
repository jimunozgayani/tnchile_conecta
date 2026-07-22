ALTER TABLE public.space_audit_log ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS idx_space_audit_log_source ON public.space_audit_log(source);