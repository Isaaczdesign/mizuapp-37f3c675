CREATE OR REPLACE FUNCTION public.cancel_public_order(_token uuid, _reason text DEFAULT NULL)
RETURNS TABLE(order_id uuid, status text, payment_status text, refund_needed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE tracking_token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF o.status::text = 'canceled' THEN
    RETURN QUERY SELECT o.id, o.status::text, o.payment_status, false;
    RETURN;
  END IF;

  IF o.status::text <> 'new' THEN
    RAISE EXCEPTION 'Este pedido já está em preparo e não pode mais ser cancelado';
  END IF;

  UPDATE public.orders
     SET status = 'canceled',
         notes = COALESCE(notes || E'\n', '') || 'Cancelado pelo cliente'
                 || CASE WHEN _reason IS NOT NULL AND length(btrim(_reason)) > 0
                         THEN ': ' || btrim(_reason) ELSE '' END
   WHERE id = o.id
   RETURNING id, status::text, payment_status
   INTO order_id, status, payment_status;

  refund_needed := (o.mp_payment_id IS NOT NULL AND o.payment_status IN ('approved', 'paid'));
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_public_order(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_public_order(uuid, text) TO anon, authenticated, service_role;