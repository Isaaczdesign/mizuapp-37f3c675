
REVOKE ALL ON FUNCTION public.recalc_customer_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_orders_update_customer_stats() FROM PUBLIC, anon, authenticated;
