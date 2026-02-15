
-- Add onboarding_complete flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- Add payment_methods and pickup/dine-in preferences to restaurants
ALTER TABLE public.restaurants 
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#F97316',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dine_in_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '[]'::jsonb;
