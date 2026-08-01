import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

    let isOwner = false;
    if (restaurantId) {
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "owner").maybeSingle();
      isOwner = !!role;
    }

    // Owner deletes the whole restaurant workspace; other members leave only their own account.
    if (restaurantId && isOwner) {
      const { data: orders } = await admin.from("orders").select("id").eq("restaurant_id", restaurantId);
      const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
      if (orderIds.length) {
        await admin.from("order_items").delete().in("order_id", orderIds);
        await admin.from("coupon_usages").delete().in("order_id", orderIds);
      }

      const { data: items } = await admin.from("menu_items").select("id").eq("restaurant_id", restaurantId);
      const itemIds = (items ?? []).map((i: { id: string }) => i.id);
      if (itemIds.length) {
        await admin.from("menu_item_addons").delete().in("menu_item_id", itemIds);
        await admin.from("menu_item_variations").delete().in("menu_item_id", itemIds);
      }

      const { data: customers } = await admin.from("customers").select("id").eq("restaurant_id", restaurantId);
      const customerIds = (customers ?? []).map((c: { id: string }) => c.id);
      if (customerIds.length) await admin.from("coupon_usages").delete().in("customer_id", customerIds);

      for (const table of [
        "message_logs", "appointments", "orders", "menu_items", "menu_categories",
        "menu_import_jobs", "coupons", "customers", "automation_rules", "restaurant_tables",
        "shift_cash_counts", "shift_cash_movements", "shift_audit_logs", "work_shifts",
        "settings", "subscriptions", "audit_logs", "platform_notes",
      ]) {
        const { error } = await admin.from(table).delete().eq("restaurant_id", restaurantId);
        if (error) console.error(`delete ${table} failed:`, error.message);
      }

      const { data: members } = await admin.from("profiles").select("user_id").eq("restaurant_id", restaurantId);
      const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

      await admin.from("user_roles").delete().eq("restaurant_id", restaurantId);
      await admin.from("profiles").delete().eq("restaurant_id", restaurantId);
      await admin.from("restaurants").delete().eq("id", restaurantId);

      for (const id of memberIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) console.error(`deleteUser ${id} failed:`, error.message);
      }
      if (!memberIds.includes(user.id)) await admin.auth.admin.deleteUser(user.id);

      return json({ success: true, scope: "restaurant" });
    }

    await admin.from("notification_preferences").delete().eq("user_id", user.id);
    await admin.from("user_roles").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("user_id", user.id);
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("deleteUser failed:", delErr.message);
      return json({ error: "Falha ao excluir a conta", details: delErr.message }, 500);
    }
    return json({ success: true, scope: "user" });
  } catch (e) {
    console.error("delete-account error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
