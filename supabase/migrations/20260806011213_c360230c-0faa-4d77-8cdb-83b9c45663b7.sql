-- 1. PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  annual_price_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_recommended boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT USING (true);
CREATE POLICY "plans_admin_write" ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. PLAN FEATURES
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL REFERENCES public.plans(code) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, feature_key)
);
GRANT SELECT ON public.plan_features TO anon, authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_features_public_read" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "plan_features_admin_write" ON public.plan_features FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- 3. SUBSCRIPTIONS (extend existing)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_plan text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_idx
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_restaurant_idx ON public.subscriptions (restaurant_id);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SUBSCRIPTION EVENTS
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_event_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_events_provider_event_idx
  ON public.subscription_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_events_admin_read" ON public.subscription_events FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- 5. FEATURE OVERRIDES
CREATE TABLE public.feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, feature_key)
);
GRANT SELECT ON public.feature_overrides TO authenticated;
GRANT ALL ON public.feature_overrides TO service_role;
ALTER TABLE public.feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_overrides_tenant_read" ON public.feature_overrides FOR SELECT TO authenticated
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()) OR public.is_platform_staff(auth.uid()));
CREATE POLICY "feature_overrides_admin_write" ON public.feature_overrides FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

DROP TRIGGER IF EXISTS feature_overrides_updated_at ON public.feature_overrides;
CREATE TRIGGER feature_overrides_updated_at BEFORE UPDATE ON public.feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. PLAN RESOLUTION FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_restaurant_plan_code(_restaurant_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT s.plan FROM public.subscriptions s
     WHERE s.restaurant_id = _restaurant_id
       AND lower(s.status) IN ('active','ativa','ativo','trial','trialing','past_due','paid')
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
       AND (s.expires_at IS NULL OR s.expires_at > now())
     ORDER BY s.started_at DESC
     LIMIT 1
  ), 'starter')
$$;

CREATE OR REPLACE FUNCTION public.restaurant_has_feature(_restaurant_id uuid, _feature_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_override boolean; v_enabled boolean;
BEGIN
  IF _restaurant_id IS NULL OR _feature_key IS NULL THEN RETURN false; END IF;

  SELECT enabled INTO v_override FROM public.feature_overrides
   WHERE restaurant_id = _restaurant_id AND feature_key = _feature_key
     AND (expires_at IS NULL OR expires_at > now());
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  SELECT pf.enabled INTO v_enabled FROM public.plan_features pf
   WHERE pf.plan_code = public.get_restaurant_plan_code(_restaurant_id)
     AND pf.feature_key = _feature_key;
  RETURN COALESCE(v_enabled, false);
END; $$;

CREATE OR REPLACE FUNCTION public.has_feature(_feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.restaurant_has_feature(public.get_user_restaurant_id(auth.uid()), _feature_key)
$$;

CREATE OR REPLACE FUNCTION public.get_my_plan()
RETURNS TABLE(
  plan_code text, plan_name text, status text, billing_cycle text,
  monthly_price_cents integer, annual_price_cents integer,
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean, scheduled_plan text, features text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rid uuid; v_code text; v_sub public.subscriptions%ROWTYPE;
BEGIN
  v_rid := public.get_user_restaurant_id(auth.uid());
  IF v_rid IS NULL THEN RETURN; END IF;
  v_code := public.get_restaurant_plan_code(v_rid);

  SELECT * INTO v_sub FROM public.subscriptions s
   WHERE s.restaurant_id = v_rid ORDER BY s.started_at DESC LIMIT 1;

  RETURN QUERY
  SELECT v_code,
         COALESCE((SELECT p.name FROM public.plans p WHERE p.code = v_code), 'Mizu Starter'),
         COALESCE(v_sub.status, 'none'),
         COALESCE(v_sub.billing_cycle, 'monthly'),
         COALESCE((SELECT p.monthly_price_cents FROM public.plans p WHERE p.code = v_code), 0),
         COALESCE((SELECT p.annual_price_cents FROM public.plans p WHERE p.code = v_code), 0),
         v_sub.current_period_start, v_sub.current_period_end,
         COALESCE(v_sub.cancel_at_period_end, false), v_sub.scheduled_plan,
         COALESCE(ARRAY(
           SELECT f.feature_key FROM (
             SELECT pf.feature_key, pf.enabled FROM public.plan_features pf WHERE pf.plan_code = v_code
             UNION
             SELECT fo.feature_key, fo.enabled FROM public.feature_overrides fo
              WHERE fo.restaurant_id = v_rid AND (fo.expires_at IS NULL OR fo.expires_at > now())
           ) f
           WHERE f.enabled
             AND NOT EXISTS (
               SELECT 1 FROM public.feature_overrides o
                WHERE o.restaurant_id = v_rid AND o.feature_key = f.feature_key
                  AND o.enabled = false AND (o.expires_at IS NULL OR o.expires_at > now())
             )
         ), ARRAY[]::text[]);
END; $$;