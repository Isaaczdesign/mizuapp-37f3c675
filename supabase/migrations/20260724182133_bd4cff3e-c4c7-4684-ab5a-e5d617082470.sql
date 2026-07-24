ALTER TABLE public.menu_import_jobs
  ADD COLUMN IF NOT EXISTS pages_total int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_processed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_found int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_import_jobs TO authenticated;
GRANT ALL ON public.menu_import_jobs TO service_role;

ALTER TABLE public.menu_import_jobs REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_import_jobs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;