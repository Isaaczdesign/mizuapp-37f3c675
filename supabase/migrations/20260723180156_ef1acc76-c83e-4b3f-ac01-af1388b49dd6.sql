
CREATE OR REPLACE FUNCTION public.recalc_customer_stats(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _customer_id IS NULL THEN RETURN; END IF;
  UPDATE public.customers c
  SET
    total_orders = COALESCE(agg.cnt, 0),
    total_spent = COALESCE(agg.sum_total, 0),
    last_order_at = agg.last_at
  FROM (
    SELECT
      COUNT(*)::int AS cnt,
      COALESCE(SUM(total), 0)::numeric AS sum_total,
      MAX(created_at) AS last_at
    FROM public.orders
    WHERE customer_id = _customer_id
      AND status NOT IN ('canceled')
  ) agg
  WHERE c.id = _customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_stats(OLD.customer_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_customer_stats(NEW.customer_id);
  IF TG_OP = 'UPDATE' AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    PERFORM public.recalc_customer_stats(OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_update_customer_stats ON public.orders;
CREATE TRIGGER orders_update_customer_stats
AFTER INSERT OR UPDATE OF total, status, customer_id OR DELETE
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_update_customer_stats();

-- Backfill existing customers so the CRM shows accurate numbers immediately.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.customers LOOP
    PERFORM public.recalc_customer_stats(r.id);
  END LOOP;
END $$;
