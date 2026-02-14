
-- Fix: orders already in realtime publication, skip that line
-- This migration only adds the realtime publication for tables not yet added
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
