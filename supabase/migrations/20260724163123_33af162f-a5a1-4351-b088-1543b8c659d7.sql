
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS prep_time_minutes integer NOT NULL DEFAULT 10;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS preparing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_order_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'preparing' AND NEW.preparing_started_at IS NULL THEN
      NEW.preparing_started_at := now();
    END IF;
    IF NEW.status = 'ready' AND NEW.ready_at IS NULL THEN
      NEW.ready_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_status_timestamps ON public.orders;
CREATE TRIGGER trg_set_order_status_timestamps
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_status_timestamps();
