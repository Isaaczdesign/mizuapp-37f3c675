ALTER TABLE public.restaurants ADD COLUMN pickup_dine_in_note text DEFAULT NULL;

NOTIFY pgrst, 'reload schema';