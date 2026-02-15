ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS whatsapp_sender_id TEXT;

NOTIFY pgrst, 'reload schema';