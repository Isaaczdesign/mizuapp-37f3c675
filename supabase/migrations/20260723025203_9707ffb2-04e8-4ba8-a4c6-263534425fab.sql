CREATE OR REPLACE FUNCTION public.validate_order_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_type = 'dine_in'
     AND NEW.table_id IS NULL
     AND NEW.notes = 'Pedido de teste do onboarding' THEN
    NEW.order_type = 'pickup';
  END IF;

  IF NEW.order_type = 'dine_in' AND NEW.table_id IS NULL THEN
    RAISE EXCEPTION 'Pedidos para consumo no local exigem número da mesa';
  END IF;

  IF NEW.order_type = 'delivery' AND (NEW.delivery_address IS NULL OR NEW.delivery_address::text = '{}') THEN
    RAISE EXCEPTION 'Pedidos de delivery exigem endereço de entrega';
  END IF;

  RETURN NEW;
END;
$function$;