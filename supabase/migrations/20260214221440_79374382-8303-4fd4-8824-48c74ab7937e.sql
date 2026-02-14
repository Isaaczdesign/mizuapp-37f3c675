
-- Add missing columns to menu_items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS ingredients text;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS allergens text;

-- Create menu_item_variations table
CREATE TABLE IF NOT EXISTS public.menu_item_variations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage variations" ON public.menu_item_variations FOR ALL
  USING (EXISTS (SELECT 1 FROM menu_items mi WHERE mi.id = menu_item_variations.menu_item_id AND mi.restaurant_id = get_user_restaurant_id(auth.uid())));

CREATE POLICY "Public can view variations" ON public.menu_item_variations FOR SELECT
  USING (true);

-- Create menu_item_addons table
CREATE TABLE IF NOT EXISTS public.menu_item_addons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage addons" ON public.menu_item_addons FOR ALL
  USING (EXISTS (SELECT 1 FROM menu_items mi WHERE mi.id = menu_item_addons.menu_item_id AND mi.restaurant_id = get_user_restaurant_id(auth.uid())));

CREATE POLICY "Public can view addons" ON public.menu_item_addons FOR SELECT
  USING (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
