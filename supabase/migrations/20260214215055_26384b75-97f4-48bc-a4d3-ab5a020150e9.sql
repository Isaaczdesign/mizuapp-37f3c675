
-- Table to track menu import jobs
CREATE TABLE public.menu_import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  parsed_result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage import jobs"
ON public.menu_import_jobs FOR ALL
USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE TRIGGER update_menu_import_jobs_updated_at
BEFORE UPDATE ON public.menu_import_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
