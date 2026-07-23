
CREATE OR REPLACE FUNCTION public.validate_public_coupon(_restaurant_id uuid, _code text)
 RETURNS TABLE(id uuid, code text, description text, discount_type text, discount_value numeric, is_valid boolean, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) = 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, false, 'Informe um código'::text;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.coupons AS cp
    WHERE cp.restaurant_id = _restaurant_id AND upper(cp.code) = upper(btrim(_code))
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, false, 'Cupom não encontrado'::text;
    RETURN;
  END IF;

  IF c.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, false, 'Cupom inativo'::text;
    RETURN;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, false, 'Cupom expirado'::text;
    RETURN;
  END IF;

  IF c.max_uses IS NOT NULL AND COALESCE(c.uses_count, 0) >= c.max_uses THEN
    RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, false, 'Limite de usos atingido'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT c.id, c.code, c.description, c.discount_type, c.discount_value, true, NULL::text;
END;
$function$;
