-- 1. Platform roles
DO $$ BEGIN
  CREATE TYPE public.platform_role AS ENUM ('super_admin', 'admin', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.platform_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.platform_role NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.platform_user_roles TO authenticated;
GRANT ALL ON public.platform_user_roles TO service_role;
ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id uuid, _role public.platform_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_platform_role(uuid, public.platform_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, public.platform_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

CREATE POLICY "platform_roles_self_read" ON public.platform_user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "platform_roles_staff_read" ON public.platform_user_roles
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "platform_roles_superadmin_write" ON public.platform_user_roles
  FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));

-- 2. Plans
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'monthly',
  trial_days integer NOT NULL DEFAULT 7,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_recommended boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_plans TO authenticated;
GRANT INSERT, UPDATE ON public.platform_plans TO authenticated;
GRANT ALL ON public.platform_plans TO service_role;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_staff_read" ON public.platform_plans
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "plans_admin_insert" ON public.platform_plans
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "plans_admin_update" ON public.platform_plans
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER platform_plans_updated_at BEFORE UPDATE ON public.platform_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Internal notes
CREATE TABLE IF NOT EXISTS public.platform_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_notes TO authenticated;
GRANT ALL ON public.platform_notes TO service_role;
ALTER TABLE public.platform_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_staff_read" ON public.platform_notes
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "notes_staff_insert" ON public.platform_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "notes_staff_update" ON public.platform_notes
  FOR UPDATE TO authenticated USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE TRIGGER platform_notes_updated_at BEFORE UPDATE ON public.platform_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Admin audit logs (append-only)
CREATE TABLE IF NOT EXISTS public.platform_admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admin_logs TO authenticated;
GRANT ALL ON public.platform_admin_logs TO service_role;
ALTER TABLE public.platform_admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs_staff_read" ON public.platform_admin_logs
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_platform_action(
  _action text, _entity_type text, _entity_id uuid DEFAULT NULL,
  _old jsonb DEFAULT NULL, _new jsonb DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  INSERT INTO public.platform_admin_logs(actor_id, action, entity_type, entity_id, old_value, new_value, reason)
  VALUES (auth.uid(), left(btrim(_action), 120), left(btrim(_entity_type), 60), _entity_id, _old, _new, left(_reason, 500));
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_platform_action(text, text, uuid, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_platform_action(text, text, uuid, jsonb, jsonb, text) TO authenticated, service_role;

-- 5. Platform settings (singleton)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL DEFAULT 'Mizu',
  logo_url text,
  support_email text,
  support_whatsapp text,
  terms_url text,
  privacy_url text,
  default_trial_days integer NOT NULL DEFAULT 7,
  signups_enabled boolean NOT NULL DEFAULT true,
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text,
  maintenance_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_staff_read" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "settings_admin_write" ON public.platform_settings
  FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Platform staff visibility over existing tenant tables
CREATE POLICY "platform_staff_read_restaurants" ON public.restaurants
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "platform_admin_update_restaurants" ON public.restaurants
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_staff_read_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "platform_staff_read_subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "platform_admin_write_subscriptions" ON public.subscriptions
  FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_staff_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "platform_staff_read_user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

-- 7. Overview stats
CREATE OR REPLACE FUNCTION public.platform_overview_stats(_since timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  SELECT jsonb_build_object(
    'restaurants_total', (SELECT count(*) FROM public.restaurants),
    'restaurants_active', (SELECT count(*) FROM public.restaurants WHERE is_active),
    'restaurants_inactive', (SELECT count(*) FROM public.restaurants WHERE NOT is_active),
    'restaurants_new', (SELECT count(*) FROM public.restaurants WHERE _since IS NULL OR created_at >= _since),
    'users_total', (SELECT count(*) FROM public.profiles),
    'users_new', (SELECT count(*) FROM public.profiles WHERE _since IS NULL OR created_at >= _since),
    'orders_total', (SELECT count(*) FROM public.orders),
    'orders_period', (SELECT count(*) FROM public.orders WHERE _since IS NULL OR created_at >= _since),
    'gmv_period', (SELECT COALESCE(sum(total), 0) FROM public.orders
                    WHERE status::text NOT IN ('canceled') AND (_since IS NULL OR created_at >= _since)),
    'subscriptions_by_plan', (SELECT COALESCE(jsonb_object_agg(plan, cnt), '{}'::jsonb)
                               FROM (SELECT plan, count(*) cnt FROM public.subscriptions GROUP BY plan) s),
    'subscriptions_by_status', (SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
                               FROM (SELECT status, count(*) cnt FROM public.subscriptions GROUP BY status) s)
  ) INTO result;
  RETURN result;
END; $$;
REVOKE EXECUTE ON FUNCTION public.platform_overview_stats(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_overview_stats(timestamptz) TO authenticated, service_role;