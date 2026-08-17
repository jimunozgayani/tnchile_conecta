CREATE TABLE IF NOT EXISTS public.job_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.job_secrets TO service_role;
ALTER TABLE public.job_secrets ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo accesible con service_role (backend).

INSERT INTO public.job_secrets (name, value)
VALUES ('email_alertas', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE v_secret text;
BEGIN
  SELECT value INTO v_secret FROM public.job_secrets WHERE name = 'email_alertas';
  PERFORM cron.unschedule('enviar-alertas-vencimiento')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-alertas-vencimiento');
  PERFORM cron.schedule(
    'enviar-alertas-vencimiento',
    '30 12 * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://conecta.tnchile.com/api/public/alertas-vencimiento',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
        body := '{}'::jsonb
      );
    $cmd$, v_secret)
  );
END $$;