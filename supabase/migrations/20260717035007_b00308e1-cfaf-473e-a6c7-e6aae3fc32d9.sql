
GRANT SELECT (owner_phone) ON public.restaurants TO anon;
-- Atualiza a view pública para incluir o telefone de contato
CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT id, name, slug, logo_url, banner_url, description, primary_color,
       pickup_enabled, dine_in_enabled, payment_methods, pickup_dine_in_note,
       owner_phone, is_active
FROM public.restaurants;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;
