CREATE OR REPLACE FUNCTION public.cancel_public_order(_token uuid, _reason text DEFAULT NULL::text)
RETURNS TABLE(order_id uuid, status text, payment_status text, refund_needed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT *
    INTO v_order
    FROM public.orders
   WHERE tracking_token = _token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status::text = 'canceled' THEN
    order_id := v_order.id;
    status := v_order.status::text;
    payment_status := v_order.payment_status;
    refund_needed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_order.status::text <> 'new' THEN
    RAISE EXCEPTION 'Este pedido já está em preparo e não pode mais ser cancelado';
  END IF;

  UPDATE public.orders AS updated_order
     SET status = 'canceled',
         notes = COALESCE(updated_order.notes || E'\n', '') || 'Cancelado pelo cliente'
                 || CASE WHEN _reason IS NOT NULL AND length(btrim(_reason)) > 0
                         THEN ': ' || btrim(_reason) ELSE '' END
   WHERE updated_order.id = v_order.id
   RETURNING updated_order.id, updated_order.status::text, updated_order.payment_status
        INTO order_id, status, payment_status;

  refund_needed := (v_order.mp_payment_id IS NOT NULL AND v_order.payment_status IN ('approved', 'paid'));
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_public_order(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_public_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_public_order(uuid, text) TO service_role;