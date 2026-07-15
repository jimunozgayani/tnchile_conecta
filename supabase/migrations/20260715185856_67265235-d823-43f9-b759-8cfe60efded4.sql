
-- Add cliente and chofer roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chofer';
