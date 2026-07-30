-- Remove menu_import_jobs from the realtime publication: internal file URLs,
-- parsing logs and error messages should never be broadcast over websockets.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'menu_import_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.menu_import_jobs;
  END IF;
END $$;

-- Keep grants tight: only the owning tenant (authenticated, via RLS) and server code.
REVOKE ALL ON public.menu_import_jobs FROM anon;
REVOKE ALL ON public.menu_import_jobs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_import_jobs TO authenticated;
GRANT ALL ON public.menu_import_jobs TO service_role;

ALTER TABLE public.menu_import_jobs ENABLE ROW LEVEL SECURITY;
