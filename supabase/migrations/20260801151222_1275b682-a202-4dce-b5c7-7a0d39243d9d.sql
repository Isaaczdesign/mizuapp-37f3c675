
CREATE TABLE public.order_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_reviews TO authenticated;
GRANT ALL ON public.order_reviews TO service_role;
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view its reviews" ON public.order_reviews
  FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));

CREATE TABLE public.order_item_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.order_reviews(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, order_item_id)
);

GRANT SELECT ON public.order_item_reviews TO authenticated;
GRANT ALL ON public.order_item_reviews TO service_role;
ALTER TABLE public.order_item_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view its item reviews" ON public.order_item_reviews
  FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()));

CREATE TRIGGER update_order_reviews_updated_at
  BEFORE UPDATE ON public.order_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_order_reviews_restaurant ON public.order_reviews(restaurant_id, created_at DESC);
CREATE INDEX idx_order_item_reviews_menu_item ON public.order_item_reviews(menu_item_id);

-- Public: read existing review by tracking token
CREATE OR REPLACE FUNCTION public.get_public_order_review(_token uuid)
RETURNS TABLE(rating smallint, comment text, created_at timestamptz, items jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT r.rating, r.comment, r.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'order_item_id', ir.order_item_id, 'rating', ir.rating, 'comment', ir.comment))
      FROM public.order_item_reviews ir WHERE ir.review_id = r.id), '[]'::jsonb)
  FROM public.order_reviews r
  JOIN public.orders o ON o.id = r.order_id
  WHERE o.tracking_token = _token;
END; $$;

-- Public: submit review by tracking token
CREATE OR REPLACE FUNCTION public.submit_order_review(_token uuid, _rating integer, _comment text DEFAULT NULL, _items jsonb DEFAULT '[]'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_review_id uuid;
  v_it jsonb;
  v_item_id uuid;
  v_item_rating int;
  v_menu_item_id uuid;
BEGIN
  IF NOT public.check_rate_limit('submit_order_review', public.client_ip(), 20, 600) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE tracking_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF v_order.status::text NOT IN ('completed', 'delivered') THEN
    RAISE EXCEPTION 'O pedido ainda não foi concluído';
  END IF;

  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Nota inválida';
  END IF;

  IF EXISTS (SELECT 1 FROM public.order_reviews WHERE order_id = v_order.id) THEN
    RAISE EXCEPTION 'Este pedido já foi avaliado';
  END IF;

  INSERT INTO public.order_reviews (order_id, restaurant_id, customer_id, rating, comment)
  VALUES (v_order.id, v_order.restaurant_id, v_order.customer_id, _rating,
          NULLIF(left(btrim(COALESCE(_comment, '')), 1000), ''))
  RETURNING id INTO v_review_id;

  IF _items IS NOT NULL AND jsonb_typeof(_items) = 'array' THEN
    FOR v_it IN SELECT * FROM jsonb_array_elements(_items) LOOP
      v_item_id := NULLIF(v_it->>'order_item_id', '')::uuid;
      v_item_rating := NULLIF(v_it->>'rating', '')::int;
      IF v_item_id IS NULL OR v_item_rating IS NULL THEN CONTINUE; END IF;
      IF v_item_rating < 1 OR v_item_rating > 5 THEN CONTINUE; END IF;

      SELECT oi.menu_item_id INTO v_menu_item_id
        FROM public.order_items oi WHERE oi.id = v_item_id AND oi.order_id = v_order.id;
      IF NOT FOUND THEN CONTINUE; END IF;

      INSERT INTO public.order_item_reviews (review_id, restaurant_id, order_item_id, menu_item_id, rating, comment)
      VALUES (v_review_id, v_order.restaurant_id, v_item_id, v_menu_item_id, v_item_rating,
              NULLIF(left(btrim(COALESCE(v_it->>'comment', '')), 500), ''))
      ON CONFLICT (review_id, order_item_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_review_id;
END; $$;

-- Public order items (id + name) for rating UI
CREATE OR REPLACE FUNCTION public.get_public_order_items(_token uuid)
RETURNS TABLE(id uuid, name text, quantity integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.id, oi.name, oi.quantity
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.tracking_token = _token
  ORDER BY oi.name
$$;
