
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.work_shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON public.orders(shift_id);

CREATE OR REPLACE FUNCTION public.set_order_shift_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shift_id IS NULL THEN
    SELECT id INTO NEW.shift_id
      FROM public.work_shifts
     WHERE restaurant_id = NEW.restaurant_id
       AND status IN ('open','service_closed')
     ORDER BY opened_at DESC
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_shift_id ON public.orders;
CREATE TRIGGER trg_set_order_shift_id
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_shift_id();

-- Backfill existing orders into their matching shift by time window
UPDATE public.orders o
SET shift_id = ws.id
FROM public.work_shifts ws
WHERE o.shift_id IS NULL
  AND o.restaurant_id = ws.restaurant_id
  AND o.created_at >= ws.opened_at
  AND o.created_at <= COALESCE(ws.financial_closed_at, ws.service_closed_at, now());
