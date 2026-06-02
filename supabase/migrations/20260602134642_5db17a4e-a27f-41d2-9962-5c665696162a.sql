
ALTER TYPE public.invitation_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TABLE public.supplier_invitations ADD COLUMN IF NOT EXISTS notes text;
