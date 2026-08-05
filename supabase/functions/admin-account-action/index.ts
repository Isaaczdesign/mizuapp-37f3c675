import { createClient } from "npm:@supabase/supabase-js@2";
import { purgeRestaurantData, purgeUser } from "../_shared/purgeRestaurant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FOREVER = "876000h"; // ~100 anos

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
    const actor = userData?.user;
    if (userErr || !actor) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: role } = await admin
      .from("platform_user_roles").select("role").eq("user_id", actor.id);
    const roles = (role ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    if (!isAdmin) return json({ error: "Não autorizado" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const restaurantId = String(body?.restaurant_id ?? "");
    const reason = String(body?.reason ?? "").trim().slice(0, 500);

    if (!["ban", "unban", "delete"].includes(action)) return json({ error: "Ação inválida" }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(restaurantId)) return json({ error: "Restaurante inválido" }, 400);
    if (action !== "unban" && reason.length < 3) return json({ error: "Informe o motivo" }, 400);

    const { data: restaurant } = await admin
      .from("restaurants").select("id, name, slug").eq("id", restaurantId).maybeSingle();
    if (!restaurant) return json({ error: "Restaurante não encontrado" }, 404);

    const { data: members } = await admin.from("profiles").select("user_id").eq("restaurant_id", restaurantId);
    const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (memberIds.includes(actor.id)) return json({ error: "Você não pode aplicar esta ação na sua própria conta" }, 400);

    if (action === "delete") {
      const ids = await purgeRestaurantData(admin, restaurantId);
      for (const id of new Set([...ids, ...memberIds])) await purgeUser(admin, id);
    } else {
      const banDuration = action === "ban" ? FOREVER : "none";
      for (const id of memberIds) {
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: banDuration });
        if (error) console.error(`ban ${id} failed:`, error.message);
      }
      await admin.from("restaurants").update({ is_active: action !== "ban" }).eq("id", restaurantId);
    }

    await admin.from("platform_admin_logs").insert({
      actor_id: actor.id,
      action: action === "delete" ? "restaurant.deleted" : action === "ban" ? "restaurant.banned" : "restaurant.unbanned",
      entity_type: "restaurant",
      entity_id: restaurantId,
      old_value: { name: restaurant.name, slug: restaurant.slug, members: memberIds.length },
      new_value: { action },
      reason: reason || null,
    });

    return json({ success: true, action, members: memberIds.length });
  } catch (e) {
    console.error("admin-account-action error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
