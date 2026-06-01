CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (lower(user_email), attempted_at DESC);

GRANT SELECT, INSERT ON public.login_attempts TO anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated login form) can insert attempts and read
-- attempts for a given email — needed for the lockout check before sign-in.
CREATE POLICY "anyone can insert login attempts"
  ON public.login_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anyone can read login attempts"
  ON public.login_attempts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Helper RPC returns whether an email is currently locked out
-- (5+ failed attempts in the last 15 min with no successful attempt since).
CREATE OR REPLACE FUNCTION public.is_email_locked(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT success, attempted_at
    FROM public.login_attempts
    WHERE lower(user_email) = lower(_email)
      AND attempted_at > now() - interval '15 minutes'
    ORDER BY attempted_at DESC
    LIMIT 20
  ),
  last_success AS (
    SELECT max(attempted_at) AS ts FROM recent WHERE success
  )
  SELECT (
    SELECT count(*) FROM recent
    WHERE success = false
      AND attempted_at > COALESCE((SELECT ts FROM last_success), 'epoch'::timestamptz)
  ) >= 5;
$$;

GRANT EXECUTE ON FUNCTION public.is_email_locked(TEXT) TO anon, authenticated;