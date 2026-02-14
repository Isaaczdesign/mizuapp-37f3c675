
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS operating_hours jsonb DEFAULT '{}';
