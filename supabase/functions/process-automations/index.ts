import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rotina de disparo em massa: só pode ser acionada pelo agendador interno.
  const cronSecret = Deno.env.get("AUTOMATIONS_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active automation rules
    const { data: rules, error: rulesErr } = await supabase
      .from("automation_rules")
      .select("*, restaurants(name, slug)")
      .eq("is_active", true);

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const currentHour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    let totalSent = 0;
    let totalSkipped = 0;

    for (const rule of rules) {
      // Check send window
      const windowStart = rule.send_window_start ?? "11:00";
      const windowEnd = rule.send_window_end ?? "20:00";
      if (currentHour < windowStart || currentHour > windowEnd) {
        continue;
      }

      // Get settings for this restaurant
      const { data: settings } = await supabase
        .from("settings")
        .select("whatsapp_provider, whatsapp_api_key, whatsapp_sender_id")
        .eq("restaurant_id", rule.restaurant_id)
        .maybeSingle();

      if (settings?.whatsapp_provider !== "meta" || !settings?.whatsapp_api_key || !(settings as any)?.whatsapp_sender_id) {
        continue; // No Meta WhatsApp Cloud API configured
      }


      // Find eligible customers based on trigger
      let customers: any[] = [];
      const rid = rule.restaurant_id;

      if (rule.trigger === "post_purchase_d1") {
        // Customers who ordered yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayStart = yesterday.toISOString().split("T")[0] + "T00:00:00Z";
        const dayEnd = yesterday.toISOString().split("T")[0] + "T23:59:59Z";

        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("restaurant_id", rid)
          .eq("consent_marketing", true)
          .gte("last_order_at", dayStart)
          .lte("last_order_at", dayEnd);
        customers = data ?? [];
      } else if (rule.trigger === "inactive_7d") {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("restaurant_id", rid)
          .eq("consent_marketing", true)
          .lt("last_order_at", sevenDaysAgo.toISOString())
          .gt("total_orders", 0);
        customers = data ?? [];
      } else if (rule.trigger === "inactive_30d") {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("restaurant_id", rid)
          .eq("consent_marketing", true)
          .lt("last_order_at", thirtyDaysAgo.toISOString())
          .gt("total_orders", 0);
        customers = data ?? [];
      }

      // Process each customer
      for (const customer of customers) {
        // Frequency cap: max 1 message per customer per day
        const todayStart = now.toISOString().split("T")[0] + "T00:00:00Z";
        const { count } = await supabase
          .from("message_logs")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", customer.id)
          .eq("restaurant_id", rid)
          .gte("sent_at", todayStart);

        if ((count ?? 0) > 0) {
          totalSkipped++;
          continue;
        }

        // Build message from template
        const restaurantName = rule.restaurants?.name ?? "";
        let message = rule.message_template
          .replace(/\{\{name\}\}/g, customer.name)
          .replace(/\{\{restaurant\}\}/g, restaurantName)
          .replace(/\{\{days\}\}/g, rule.trigger === "inactive_7d" ? "7" : rule.trigger === "inactive_30d" ? "30" : "1")
          .replace(/\{\{coupon\}\}/g, "");

        // Attempt to send via WhatsApp provider
        let status = "sent";
        let providerMessageId: string | null = null;

        try {
          const phone = customer.whatsapp.replace(/\D/g, "");

          // Meta WhatsApp Cloud API
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${(settings as any).whatsapp_sender_id}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.whatsapp_api_key}`,
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { preview_url: true, body: message },
              }),
            },
          );
          if (!res.ok) {
            const errorBody = await res.text();
            console.error(`Meta WhatsApp send failed [${res.status}]: ${errorBody}`);
            status = "failed";
          } else {
            const json = await res.json().catch(() => ({}));
            providerMessageId = json?.messages?.[0]?.id ?? null;
          }
        } catch (err) {

          console.error("Send error:", err);
          status = "failed";
        }

        // Log the message
        await supabase.from("message_logs").insert({
          customer_id: customer.id,
          restaurant_id: rid,
          trigger: rule.trigger,
          message,
          automation_rule_id: rule.id,
          status,
          provider_message_id: providerMessageId,
        } as any);

        totalSent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, skipped: totalSkipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Automation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
