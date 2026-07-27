-- 1) Broaden order audit trigger: log edits too
CREATE OR REPLACE FUNCTION public.log_order_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(restaurant_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.restaurant_id, auth.uid(), 'order.created', 'order', NEW.id,
      jsonb_build_object('total', NEW.total, 'status', NEW.status, 'order_type', NEW.order_type));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.audit_logs(restaurant_id, user_id, action, entity_type, entity_id, metadata)
      VALUES (NEW.restaurant_id, auth.uid(), 'order.status_changed', 'order', NEW.id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;

    IF NEW.total IS DISTINCT FROM OLD.total THEN
      v_changes := v_changes || jsonb_build_object('total', jsonb_build_object('from', OLD.total, 'to', NEW.total));
    END IF;
    IF NEW.order_type IS DISTINCT FROM OLD.order_type THEN
      v_changes := v_changes || jsonb_build_object('order_type', jsonb_build_object('from', OLD.order_type, 'to', NEW.order_type));
    END IF;
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
      v_changes := v_changes || jsonb_build_object('payment_method', jsonb_build_object('from', OLD.payment_method, 'to', NEW.payment_method));
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      v_changes := v_changes || jsonb_build_object('payment_status', jsonb_build_object('from', OLD.payment_status, 'to', NEW.payment_status));
    END IF;
    IF NEW.delivery_address IS DISTINCT FROM OLD.delivery_address THEN
      v_changes := v_changes || jsonb_build_object('delivery_address', jsonb_build_object('changed', true));
    END IF;
    IF NEW.delivery_eta IS DISTINCT FROM OLD.delivery_eta THEN
      v_changes := v_changes || jsonb_build_object('delivery_eta', jsonb_build_object('from', OLD.delivery_eta, 'to', NEW.delivery_eta));
    END IF;
    IF NEW.table_id IS DISTINCT FROM OLD.table_id THEN
      v_changes := v_changes || jsonb_build_object('table_id', jsonb_build_object('from', OLD.table_id, 'to', NEW.table_id));
    END IF;

    IF v_changes <> '{}'::jsonb THEN
      INSERT INTO public.audit_logs(restaurant_id, user_id, action, entity_type, entity_id, metadata)
      VALUES (NEW.restaurant_id, auth.uid(), 'order.updated', 'order', NEW.id, v_changes);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Audit order item changes
CREATE OR REPLACE FUNCTION public.log_order_items_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_restaurant_id uuid;
  v_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
    v_row := jsonb_build_object('name', OLD.name, 'quantity', OLD.quantity, 'unit_price', OLD.unit_price);
  ELSE
    v_order_id := NEW.order_id;
    v_row := jsonb_build_object('name', NEW.name, 'quantity', NEW.quantity, 'unit_price', NEW.unit_price);
  END IF;

  SELECT o.restaurant_id INTO v_restaurant_id FROM public.orders o WHERE o.id = v_order_id;

  INSERT INTO public.audit_logs(restaurant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_restaurant_id, auth.uid(), 'order.item_' || lower(TG_OP), 'order_item', v_order_id, v_row);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_order_items_audit ON public.order_items;
CREATE TRIGGER trg_order_items_audit
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.log_order_items_audit();

-- 3) Sensitive read auditing, always scoped to the caller's own tenant
CREATE OR REPLACE FUNCTION public.log_data_access(_action text, _entity_type text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_rid uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN; -- anonymous callers cannot write tenant audit entries
  END IF;
  IF _action IS NULL OR length(btrim(_action)) = 0 THEN
    RAISE EXCEPTION 'action is required';
  END IF;

  v_rid := public.get_user_restaurant_id(v_uid);
  IF v_rid IS NULL THEN
    RETURN;
  END IF;

  -- rate limit noisy read logging: max 120 entries per user / 5 min
  IF NOT public.check_rate_limit('audit_read', v_uid::text, 120, 300) THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_logs(restaurant_id, user_id, action, entity_type, metadata)
  VALUES (v_rid, v_uid, left(btrim(_action), 80), COALESCE(NULLIF(btrim(_entity_type), ''), 'unknown'),
          COALESCE(_metadata, '{}'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.log_data_access(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_data_access(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_data_access(text, text, jsonb) TO service_role;