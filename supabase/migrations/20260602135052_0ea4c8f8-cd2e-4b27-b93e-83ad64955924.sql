ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_current ON public.documents(user_id, tipo, related_id) WHERE is_current AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_previous_version ON public.documents(previous_version_id);
