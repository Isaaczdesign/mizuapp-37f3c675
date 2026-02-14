
-- Coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, code)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view coupons"
  ON public.coupons FOR SELECT
  USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "Managers can manage coupons"
  ON public.coupons FOR ALL
  USING (restaurant_id = get_user_restaurant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

-- Coupon usages table
CREATE TABLE public.coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view coupon usages"
  ON public.coupon_usages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coupons c
    WHERE c.id = coupon_usages.coupon_id
    AND c.restaurant_id = get_user_restaurant_id(auth.uid())
  ));

CREATE POLICY "Managers can insert coupon usages"
  ON public.coupon_usages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coupons c
    WHERE c.id = coupon_usages.coupon_id
    AND c.restaurant_id = get_user_restaurant_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  ));

-- Add status and provider_message_id to message_logs
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Add send_window columns to automation_rules if not present
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS send_window_start TEXT DEFAULT '11:00';
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS send_window_end TEXT DEFAULT '20:00';
