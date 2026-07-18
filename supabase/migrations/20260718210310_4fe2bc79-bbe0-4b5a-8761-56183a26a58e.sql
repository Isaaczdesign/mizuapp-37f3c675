CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _restaurant_id uuid,
  _name text,
  _whatsapp text,
  _consent boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _active boolean;
BEGIN
  SELECT is_active INTO _active FROM public.restaurants WHERE id = _restaurant_id;
  IF _active IS NOT TRUE THEN
    RAISE EXCEPTION 'Restaurant not active';
  END IF;

  SELECT id INTO _id FROM public.customers
    WHERE restaurant_id = _restaurant_id AND whatsapp = _whatsapp
    LIMIT 1;

  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  INSERT INTO public.customers (restaurant_id, name, whatsapp, consent_marketing)
    VALUES (_restaurant_id, _name, _whatsapp, _consent)
    RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_customer(uuid, text, text, boolean) TO anon, authenticated;