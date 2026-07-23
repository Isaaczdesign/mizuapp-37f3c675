// Mercado Pago webhook receiver — updates order payment_status.
// Public (no JWT). MP sends notifications for events (payment.updated, etc).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* MP sometimes GET-pings */ }

    // MP sends { type: "payment", data: { id } } or ?topic=payment&id=...
    const paymentId =
      body?.data?.id ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");
    const topic = body?.type ?? url.searchParams.get("topic") ?? url.searchParams.get("type");

    if (!paymentId || (topic && topic !== "payment")) {
      return new Response("ok", { headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up local order via mp_payment_id to get restaurant_id → token
    const { data: order } = await admin
      .from("orders")
      .select("id, restaurant_id")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (!order) {
      // Payment created but not yet linked — ack anyway so MP stops retrying
      console.warn("Webhook received for unknown payment_id", paymentId);
      return new Response("ok", { headers: corsHeaders });
    }

    const { data: creds } = await admin.rpc("get_restaurant_mp_credentials", {
      _restaurant_id: order.restaurant_id,
    });
    const cred = Array.isArray(creds) ? creds[0] : creds;
    if (!cred?.access_token) {
      console.error("No MP token for restaurant", order.restaurant_id);
      return new Response("ok", { headers: corsHeaders });
    }

    // Fetch full payment info from MP
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${cred.access_token}` },
    });
    const payment = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP fetch failed", payment);
      return new Response("ok", { headers: corsHeaders });
    }

    await admin.from("orders").update({
      payment_status: payment.status ?? "pending",
    }).eq("id", order.id);

    console.log(`Order ${order.id} payment_status -> ${payment.status}`);
    return new Response("ok", { headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response("ok", { headers: corsHeaders });
  }
});
