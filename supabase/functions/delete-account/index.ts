import { createClient } from "npm:@supabase/supabase-js@2";
import { purgeRestaurantData, purgeUser } from "../_shared/purgeRestaurant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await admin
      .from("profiles").select("restaurant_id").eq("user_id", user.id).maybeSingle();
    const restaurantId = profile?.restaurant_id ?? null;

    // Excluir a conta sempre remove também o restaurante vinculado e os demais acessos.
    if (restaurantId) {
      const memberIds = await purgeRestaurantData(admin, restaurantId);
      const ids = new Set([...memberIds, user.id]);
      for (const id of ids) await purgeUser(admin, id);
      return json({ success: true, scope: "restaurant" });
    }

    await purgeUser(admin, user.id);
    return json({ success: true, scope: "user" });
  } catch (e) {
    console.error("delete-account error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
