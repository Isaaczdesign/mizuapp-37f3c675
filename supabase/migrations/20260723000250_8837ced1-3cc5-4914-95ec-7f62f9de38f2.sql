
-- Restaurant-level Mercado Pago credentials (per-tenant)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS mp_public_key TEXT,
  ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN NOT NULL DEFAULT false;

-- Order-level payment tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS mp_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS mp_ticket_url TEXT;

-- Payment status check
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending','in_process','approved','rejected','refunded','cancelled','not_required'));

CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON public.orders(mp_payment_id);

-- Public RPC to expose only the safe payment fields (never token)
CREATE OR REPLACE FUNCTION public.get_order_payment_status(_token uuid)
RETURNS TABLE(
  id uuid,
  payment_status text,
  mp_qr_code text,
  mp_qr_code_base64 text,
  mp_ticket_url text,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.payment_status, o.mp_qr_code, o.mp_qr_code_base64, o.mp_ticket_url, o.status::text
  FROM public.orders o
  WHERE o.tracking_token = _token
$$;

GRANT EXECUTE ON FUNCTION public.get_order_payment_status(uuid) TO anon, authenticated;

-- Helper for edge functions: fetch restaurant MP credentials by order id (service role only, via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_restaurant_mp_credentials(_restaurant_id uuid)
RETURNS TABLE(access_token text, public_key text, enabled boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT mp_access_token, mp_public_key, mp_enabled
  FROM public.restaurants
  WHERE id = _restaurant_id
$$;

-- Only service_role should call this (contains sensitive token)
REVOKE ALL ON FUNCTION public.get_restaurant_mp_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_restaurant_mp_credentials(uuid) TO service_role;
