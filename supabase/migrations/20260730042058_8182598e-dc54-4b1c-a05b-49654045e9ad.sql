CREATE TABLE IF NOT EXISTS public.internal_cron_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_cron_secrets TO service_role;

ALTER TABLE public.internal_cron_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only cron secrets"
  ON public.internal_cron_secrets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.internal_cron_secrets (key, value)
VALUES ('automations', '1befc06c238da9c13be34b5cb0b4a50ab9bf22668be9a4dd14aa40dcd0be1f82')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT cron.unschedule('process-automations-daily');

SELECT cron.schedule(
  'process-automations-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rfeljyjaebgoehnlxxxk.supabase.co/functions/v1/process-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.internal_cron_secrets WHERE key = 'automations')
    ),
    body := '{}'::jsonb
  );
  $$
);